import "server-only";

import type { CarouselStatus } from "@prisma/client";

import { slidesSchema } from "@/lib/carousel-schema";
import {
  CarouselNotFoundError,
  getCarouselForUser,
  withArticleTitle,
  type CarouselWithArticle,
} from "@/lib/carousels";
import { getInstagramConnectionCredentials } from "@/lib/connections/instagram";
import { db } from "@/lib/db";
import {
  InstagramApiError,
  MOCK_MEDIA_ID,
  MissingInstagramCredentialsError,
  TooFewSlidesError,
  TooManySlidesError,
  graphRequest,
  publishCarousel,
} from "@/lib/instagram";
import { publicSlideUrl } from "@/lib/public-render";

/**
 * Orchestration + Carousel.status transitions for publishing to Instagram.
 * Kept out of app/api/instagram/publish/route.ts so that route stays a thin
 * session/HTTP-status wrapper, per CLAUDE.md's "business logic outside
 * routes" rule (mirrors lib/carousels.ts for the editor CRUD endpoints).
 */

export { CarouselNotFoundError };

/** Thrown when publish is requested on a carousel that isn't APPROVED yet. */
export class CarouselNotApprovedError extends Error {
  constructor(status: CarouselStatus) {
    super(
      `Carousel must be approved before publishing (current status: ${status}).`
    );
    this.name = "CarouselNotApprovedError";
  }
}

/** Thrown when the user has no saved Instagram connection yet. */
export class MissingInstagramConnectionError extends Error {
  constructor() {
    super("Koppel eerst een Instagram-account.");
    this.name = "MissingInstagramConnectionError";
  }
}

/** Thrown when Carousel.slides fails validation (corrupted/legacy content). */
export class CorruptedCarouselContentError extends Error {
  constructor() {
    super("Carousel content is corrupted and cannot be published.");
    this.name = "CorruptedCarouselContentError";
  }
}

/** Hashtags are stored "#"-free (see caption-hashtags-form.tsx); add it back for the caption text. */
function buildCaption(caption: string, hashtags: string[]): string {
  if (hashtags.length === 0) return caption;
  const tags = hashtags.map((tag) => (tag.startsWith("#") ? tag : `#${tag}`));
  return `${caption}\n\n${tags.join(" ")}`;
}

export interface PublishCarouselForUserParams {
  carouselId: string;
  userId: string;
  /** Publicly reachable origin (no trailing slash) Instagram's servers can fetch slide images from. */
  baseUrl: string;
}

export interface PublishCarouselForUserResult {
  carousel: CarouselWithArticle;
  mediaId: string;
}

/**
 * Publishes an APPROVED carousel to Instagram end to end: ownership +
 * status checks, loading the saved Instagram connection, building signed
 * public JPEG URLs for every slide (lib/public-render.ts), calling
 * lib/instagram.ts's publishCarousel(), and moving Carousel.status through
 * PUBLISHING -> PUBLISHED (+ instagramId) or -> FAILED.
 *
 * Status is set to PUBLISHING *before* the network call, so a crash
 * mid-publish leaves the carousel visibly stuck rather than silently
 * APPROVED. That write (and the PUBLISHED/FAILED ones below) go straight
 * through Prisma rather than lib/carousels.ts's updateCarouselForUser(),
 * because its STATUS_TRANSITIONS table deliberately excludes
 * PUBLISHING/PUBLISHED as PATCH targets — this pipeline is the one
 * sanctioned place those statuses get set.
 *
 * Throws CarouselNotFoundError, CarouselNotApprovedError,
 * MissingInstagramConnectionError, CorruptedCarouselContentError, or
 * whatever lib/instagram.ts's publishCarousel() throws (InstagramApiError,
 * MissingInstagramCredentialsError, TooFewSlidesError, TooManySlidesError).
 */
export async function publishCarouselForUser(
  params: PublishCarouselForUserParams
): Promise<PublishCarouselForUserResult> {
  const { carouselId, userId, baseUrl } = params;

  const carousel = await getCarouselForUser(carouselId, userId);

  if (carousel.status !== "APPROVED") {
    throw new CarouselNotApprovedError(carousel.status);
  }

  const credentials = await getInstagramConnectionCredentials(userId);
  if (!credentials) {
    throw new MissingInstagramConnectionError();
  }

  const slidesResult = slidesSchema.safeParse(carousel.slides);
  if (!slidesResult.success) {
    throw new CorruptedCarouselContentError();
  }

  const slideImageUrls = [...slidesResult.data]
    .sort((a, b) => a.index - b.index)
    .map((slide) => publicSlideUrl(baseUrl, carousel.id, slide.index));

  const caption = buildCaption(carousel.caption, carousel.hashtags);

  await setCarouselStatus(carousel.id, "PUBLISHING");

  try {
    const { mediaId } = await publishCarousel({
      igUserId: credentials.businessAccountId,
      accessToken: credentials.accessToken,
      slideImageUrls,
      caption,
    });

    const updated = await setCarouselPublished(carousel.id, mediaId);
    return { carousel: updated, mediaId };
  } catch (error) {
    await setCarouselStatus(carousel.id, "FAILED");
    throw toPublishError(error);
  }
}

function toPublishError(error: unknown): Error {
  if (
    error instanceof InstagramApiError ||
    error instanceof MissingInstagramCredentialsError ||
    error instanceof TooFewSlidesError ||
    error instanceof TooManySlidesError ||
    error instanceof Error
  ) {
    return error;
  }
  return new Error("Publishing to Instagram failed.");
}

async function setCarouselStatus(
  carouselId: string,
  status: CarouselStatus
): Promise<void> {
  await db.carousel.update({ where: { id: carouselId }, data: { status } });
}

async function setCarouselPublished(
  carouselId: string,
  mediaId: string
): Promise<CarouselWithArticle> {
  return db.carousel.update({
    where: { id: carouselId },
    data: { status: "PUBLISHED", instagramId: mediaId },
    include: withArticleTitle,
  });
}

const MOCK_PERMALINK = `https://www.instagram.com/p/${MOCK_MEDIA_ID}/`;

/**
 * Looks up the public permalink for a published media object. `instagramId`
 * is a real Graph API media id (the one publishCarousel() returns), so this
 * is a legitimate follow-up call, not a guess. Returns null instead of
 * throwing on any failure (expired token, deleted post, transient error) —
 * this only backs a "view on Instagram" link, so a lookup failure shouldn't
 * break the publish-status response the editor polls.
 */
async function getMediaPermalink(
  accessToken: string,
  instagramId: string
): Promise<string | null> {
  if (process.env.MOCK_INSTAGRAM === "1") {
    return MOCK_PERMALINK;
  }

  try {
    const data = await graphRequest<{ permalink?: string }>(
      `/${encodeURIComponent(instagramId)}`,
      { fields: "permalink", access_token: accessToken },
      "GET"
    );
    return data.permalink ?? null;
  } catch {
    return null;
  }
}

/** Current status + instagramId + permalink (once known), for the editor's publish-progress polling. */
export interface CarouselPublishStatus {
  status: CarouselStatus;
  instagramId: string | null;
  permalink: string | null;
}

export async function getCarouselPublishStatusForUser(
  carouselId: string,
  userId: string
): Promise<CarouselPublishStatus> {
  const carousel = await getCarouselForUser(carouselId, userId);

  let permalink: string | null = null;
  if (carousel.status === "PUBLISHED" && carousel.instagramId) {
    const credentials = await getInstagramConnectionCredentials(userId);
    if (credentials) {
      permalink = await getMediaPermalink(credentials.accessToken, carousel.instagramId);
    }
  }

  return { status: carousel.status, instagramId: carousel.instagramId, permalink };
}
