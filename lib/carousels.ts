import "server-only";

import type { Carousel, CarouselStatus, Prisma } from "@prisma/client";

import { db } from "@/lib/db";

import type { CarouselUpdateInput } from "./carousel-schema";

/**
 * CRUD + status-transition business logic for carousels. Kept out of the
 * app/api route handlers so those stay thin (session/zod/HTTP-status glue
 * only) — see CLAUDE.md's "business logic outside components/routes" rule.
 *
 * Ownership model: Carousel has no userId of its own — ownership flows
 * through Carousel -> Article -> WordPressConnection -> User. Every lookup
 * below filters on that chain so a carousel belonging to another user is
 * indistinguishable from one that doesn't exist (never leak existence).
 */

export class CarouselNotFoundError extends Error {
  constructor() {
    super("Carousel not found.");
    this.name = "CarouselNotFoundError";
  }
}

export class InvalidStatusTransitionError extends Error {
  constructor(from: CarouselStatus, to: CarouselStatus) {
    super(`Cannot change carousel status from ${from} to ${to}.`);
    this.name = "InvalidStatusTransitionError";
  }
}

export class CarouselDeleteNotAllowedError extends Error {
  constructor(status: CarouselStatus) {
    super(`Carousel in status ${status} cannot be deleted.`);
    this.name = "CarouselDeleteNotAllowedError";
  }
}

/**
 * Allowed CarouselStatus transitions reachable through this CRUD API.
 * PUBLISHING and PUBLISHED are deliberately absent as *targets* here — they
 * are only ever set by the (future, Phase 6) publish pipeline, never by a
 * plain PATCH from the editor.
 */
const STATUS_TRANSITIONS: Record<CarouselStatus, CarouselStatus[]> = {
  DRAFT: ["APPROVED"],
  APPROVED: ["DRAFT"],
  PUBLISHING: [],
  PUBLISHED: [],
  FAILED: [],
};

/** Pure helper (no I/O) so it can be unit-tested without a database. */
export function isValidStatusTransition(
  from: CarouselStatus,
  to: CarouselStatus
): boolean {
  if (from === to) return true; // no-op is always allowed
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

function isLockedForEditing(status: CarouselStatus): boolean {
  return status === "PUBLISHING" || status === "PUBLISHED";
}

/** Pure helper (no I/O) so it can be unit-tested without a database. */
export function canDeleteCarousel(status: CarouselStatus): boolean {
  return !isLockedForEditing(status);
}

/**
 * Whether a carousel's content (slides/caption/hashtags/template) may still
 * be changed — false once it's PUBLISHING or PUBLISHED. Used by the slide
 * regeneration endpoint; plain PATCH field edits are governed by the zod
 * schema + status-transition rules only, per the Phase 5 spec.
 */
export function canMutateCarouselContent(status: CarouselStatus): boolean {
  return !isLockedForEditing(status);
}

/** Shared include: pulls in just enough of Article for a title/preview. */
const withArticleTitle = {
  article: { select: { id: true, title: true, imageUrl: true } },
} satisfies Prisma.CarouselInclude;

export type CarouselWithArticle = Prisma.CarouselGetPayload<{
  include: typeof withArticleTitle;
}>;

/** All carousels belonging to `userId`, newest first. */
export async function listCarouselsForUser(
  userId: string
): Promise<CarouselWithArticle[]> {
  return db.carousel.findMany({
    where: { article: { connection: { userId } } },
    include: withArticleTitle,
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Loads a single carousel owned by `userId`. Throws CarouselNotFoundError
 * (map to 404) if it doesn't exist or belongs to someone else.
 */
export async function getCarouselForUser(
  carouselId: string,
  userId: string
): Promise<CarouselWithArticle> {
  const carousel = await db.carousel.findFirst({
    where: { id: carouselId, article: { connection: { userId } } },
    include: withArticleTitle,
  });

  if (!carousel) {
    throw new CarouselNotFoundError();
  }

  return carousel;
}

/**
 * Applies a partial update to a carousel owned by `userId`.
 *
 * Throws CarouselNotFoundError if the carousel doesn't exist/isn't theirs,
 * or InvalidStatusTransitionError if `input.status` isn't a legal move from
 * the carousel's current status (see STATUS_TRANSITIONS above).
 */
export async function updateCarouselForUser(
  carouselId: string,
  userId: string,
  input: CarouselUpdateInput
): Promise<CarouselWithArticle> {
  const existing = await db.carousel.findFirst({
    where: { id: carouselId, article: { connection: { userId } } },
  });

  if (!existing) {
    throw new CarouselNotFoundError();
  }

  if (
    input.status !== undefined &&
    !isValidStatusTransition(existing.status, input.status)
  ) {
    throw new InvalidStatusTransitionError(existing.status, input.status);
  }

  const data: Prisma.CarouselUpdateInput = {};
  if (input.slides !== undefined) {
    data.slides = input.slides as unknown as Prisma.InputJsonValue;
  }
  if (input.caption !== undefined) data.caption = input.caption;
  if (input.hashtags !== undefined) data.hashtags = input.hashtags;
  if (input.template !== undefined) data.template = input.template;
  if (input.status !== undefined) data.status = input.status;

  return db.carousel.update({
    where: { id: carouselId },
    data,
    include: withArticleTitle,
  });
}

/**
 * Deletes a carousel owned by `userId`.
 *
 * Throws CarouselNotFoundError if it doesn't exist/isn't theirs, or
 * CarouselDeleteNotAllowedError if it's currently PUBLISHING or PUBLISHED.
 */
export async function deleteCarouselForUser(
  carouselId: string,
  userId: string
): Promise<Carousel> {
  const existing = await db.carousel.findFirst({
    where: { id: carouselId, article: { connection: { userId } } },
  });

  if (!existing) {
    throw new CarouselNotFoundError();
  }

  if (!canDeleteCarousel(existing.status)) {
    throw new CarouselDeleteNotAllowedError(existing.status);
  }

  return db.carousel.delete({ where: { id: carouselId } });
}
