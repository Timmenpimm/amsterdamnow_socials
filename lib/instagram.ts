import "server-only";

import { describeFetchError, withTimeout } from "@/lib/connections/shared";

/**
 * Instagram Graph API (v21.0) client for publishing carousels.
 *
 * Carousel publish flow (per Meta's docs):
 *  1. POST /{ig-user-id}/media with image_url + is_carousel_item=true,
 *     once per slide -> each returns an item "creation_id" (container).
 *  2. Poll each item container's status_code until FINISHED.
 *  3. POST /{ig-user-id}/media with media_type=CAROUSEL, children=<ids>,
 *     caption -> a carousel container id.
 *  4. Poll the carousel container's status_code until FINISHED.
 *  5. POST /{ig-user-id}/media_publish with creation_id=<carousel
 *     container id> -> the published media id.
 *
 * Never log accessToken — every error path below surfaces Meta's message
 * and fbtrace_id only.
 */

const GRAPH_API_VERSION = "v21.0";
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const MIN_CAROUSEL_SLIDES = 2;
const MAX_CAROUSEL_SLIDES = 10;

const POLL_INITIAL_DELAY_MS = 1500;
const POLL_MAX_DELAY_MS = 8000;
const POLL_TIMEOUT_MS = 90_000;

export class InstagramApiError extends Error {
  readonly fbtraceId?: string;
  readonly code?: number;

  constructor(message: string, opts: { fbtraceId?: string; code?: number } = {}) {
    super(message);
    this.name = "InstagramApiError";
    this.fbtraceId = opts.fbtraceId;
    this.code = opts.code;
  }
}

export class MissingInstagramCredentialsError extends Error {
  constructor() {
    super("Instagram access token or business account id is missing.");
    this.name = "MissingInstagramCredentialsError";
  }
}

export class TooFewSlidesError extends Error {
  constructor(count: number) {
    super(
      `Instagram carousels need at least ${MIN_CAROUSEL_SLIDES} slides (this carousel has ${count}).`
    );
    this.name = "TooFewSlidesError";
  }
}

export class TooManySlidesError extends Error {
  constructor(count: number) {
    super(
      `Instagram carousels support at most ${MAX_CAROUSEL_SLIDES} slides (this carousel has ${count}).`
    );
    this.name = "TooManySlidesError";
  }
}

interface GraphErrorBody {
  error?: {
    message?: string;
    code?: number;
    fbtrace_id?: string;
  };
}

/** Shared request helper for every Graph API call — exported so lib/instagram-publish.ts can reuse it for its own narrow calls (media permalink lookup). */
export async function graphRequest<T>(
  path: string,
  params: Record<string, string>,
  method: "GET" | "POST"
): Promise<T> {
  const url = new URL(`${GRAPH_API_BASE}${path}`);

  let response: Response;
  try {
    if (method === "GET") {
      for (const [key, value] of Object.entries(params)) {
        url.searchParams.set(key, value);
      }
      response = await fetch(url, { method: "GET", signal: withTimeout() });
    } else {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params).toString(),
        signal: withTimeout(),
      });
    }
  } catch (error) {
    throw new InstagramApiError(describeFetchError(error));
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new InstagramApiError(
      `Meta Graph API returned a non-JSON response (status ${response.status}).`
    );
  }

  const body = data as GraphErrorBody;

  if (!response.ok || body.error) {
    throw new InstagramApiError(
      body.error?.message ?? `Meta Graph API responded with status ${response.status}.`,
      { fbtraceId: body.error?.fbtrace_id, code: body.error?.code }
    );
  }

  return data as T;
}

/** Creates a single carousel-item media container from a public image URL. Returns its container id. */
export async function createItemContainer(
  igUserId: string,
  accessToken: string,
  imageUrl: string
): Promise<string> {
  const data = await graphRequest<{ id: string }>(
    `/${encodeURIComponent(igUserId)}/media`,
    { image_url: imageUrl, is_carousel_item: "true", access_token: accessToken },
    "POST"
  );
  return data.id;
}

/** Creates the parent CAROUSEL container from a set of already-created item container ids. */
export async function createCarouselContainer(
  igUserId: string,
  accessToken: string,
  childrenIds: string[],
  caption: string
): Promise<string> {
  const data = await graphRequest<{ id: string }>(
    `/${encodeURIComponent(igUserId)}/media`,
    {
      media_type: "CAROUSEL",
      children: childrenIds.join(","),
      caption,
      access_token: accessToken,
    },
    "POST"
  );
  return data.id;
}

/** Publishes a (fully-processed) container, returning the resulting media id. */
export async function publishContainer(
  igUserId: string,
  accessToken: string,
  creationId: string
): Promise<string> {
  const data = await graphRequest<{ id: string }>(
    `/${encodeURIComponent(igUserId)}/media_publish`,
    { creation_id: creationId, access_token: accessToken },
    "POST"
  );
  return data.id;
}

export type PublishingStatusCode =
  | "EXPIRED"
  | "ERROR"
  | "FINISHED"
  | "IN_PROGRESS"
  | "PUBLISHED";

/** Reads a media container's current processing status. */
export async function getPublishingStatus(
  accessToken: string,
  containerId: string
): Promise<PublishingStatusCode> {
  const data = await graphRequest<{ status_code: PublishingStatusCode }>(
    `/${encodeURIComponent(containerId)}`,
    { fields: "status_code", access_token: accessToken },
    "GET"
  );
  return data.status_code;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Polls a container's status_code until it reaches FINISHED (or is already
 * PUBLISHED), using exponential backoff. Throws InstagramApiError if the
 * container reports ERROR/EXPIRED, or if POLL_TIMEOUT_MS elapses first.
 */
async function waitUntilFinished(
  accessToken: string,
  containerId: string
): Promise<void> {
  const startedAt = Date.now();
  let delay = POLL_INITIAL_DELAY_MS;

  while (true) {
    const status = await getPublishingStatus(accessToken, containerId);

    if (status === "FINISHED" || status === "PUBLISHED") return;

    if (status === "ERROR" || status === "EXPIRED") {
      throw new InstagramApiError(
        `Container ${containerId} failed to process (status: ${status}).`
      );
    }

    if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
      throw new InstagramApiError(
        `Timed out waiting for container ${containerId} to finish processing.`
      );
    }

    await sleep(delay);
    delay = Math.min(delay * 1.5, POLL_MAX_DELAY_MS);
  }
}

export interface PublishCarouselParams {
  igUserId: string;
  accessToken: string;
  /** Publicly-fetchable JPEG URLs, in slide order (see lib/public-render.ts). */
  slideImageUrls: string[];
  caption: string;
}

export interface PublishCarouselResult {
  mediaId: string;
}

export const MOCK_MEDIA_ID = "mock-instagram-media-id";

/**
 * Orchestrates the full carousel publish flow described at the top of this
 * file: create + wait on each item container, create + wait on the
 * carousel container, then publish it.
 *
 * Throws MissingInstagramCredentialsError, TooFewSlidesError,
 * TooManySlidesError, or InstagramApiError (from any Graph call/poll).
 *
 * When process.env.MOCK_INSTAGRAM === "1", every Graph API call is skipped
 * and a fixed fake media id is returned instead — mirrors lib/openai.ts's
 * MOCK_AI pattern, so the orchestration (incl. slide-count validation) can
 * be smoke-tested without real Instagram credentials.
 */
export async function publishCarousel(
  params: PublishCarouselParams
): Promise<PublishCarouselResult> {
  const { igUserId, accessToken, slideImageUrls, caption } = params;

  if (!igUserId || !accessToken) {
    throw new MissingInstagramCredentialsError();
  }
  if (slideImageUrls.length < MIN_CAROUSEL_SLIDES) {
    throw new TooFewSlidesError(slideImageUrls.length);
  }
  if (slideImageUrls.length > MAX_CAROUSEL_SLIDES) {
    throw new TooManySlidesError(slideImageUrls.length);
  }

  // --- MOCK PATH (test/dev only) ---
  if (process.env.MOCK_INSTAGRAM === "1") {
    return { mediaId: MOCK_MEDIA_ID };
  }
  // --- END MOCK PATH ---

  const itemContainerIds: string[] = [];
  for (const imageUrl of slideImageUrls) {
    const containerId = await createItemContainer(igUserId, accessToken, imageUrl);
    await waitUntilFinished(accessToken, containerId);
    itemContainerIds.push(containerId);
  }

  const carouselContainerId = await createCarouselContainer(
    igUserId,
    accessToken,
    itemContainerIds,
    caption
  );
  await waitUntilFinished(accessToken, carouselContainerId);

  const mediaId = await publishContainer(igUserId, accessToken, carouselContainerId);

  return { mediaId };
}
