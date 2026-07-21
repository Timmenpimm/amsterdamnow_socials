import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import {
  InstagramApiError,
  MissingInstagramCredentialsError,
  TooFewSlidesError,
  TooManySlidesError,
} from "@/lib/instagram";
import {
  CarouselNotApprovedError,
  CarouselNotFoundError,
  CorruptedCarouselContentError,
  MissingInstagramConnectionError,
  publishCarouselForUser,
} from "@/lib/instagram-publish";

// Uses fetch/timers only (no satori/sharp), but shares the request path
// with the render pipeline transitively via lib/instagram-publish.ts, so
// keep it on the Node runtime for consistency.
export const runtime = "nodejs";

const publishRequestSchema = z.object({
  carouselId: z.string().trim().min(1, "carouselId is required"),
});

/**
 * PUBLIC_BASE_URL, if set, is the publicly reachable engine URL — required
 * because Instagram's servers fetch slide images themselves and can't
 * reach a localhost/private origin. Falls back to the incoming request's
 * origin, which works for real deployments accessed directly by their own
 * public URL but not for local dev.
 */
function resolveBaseUrl(request: Request): string {
  const configured = process.env.PUBLIC_BASE_URL;
  if (configured) return configured.replace(/\/+$/, "");
  return new URL(request.url).origin;
}

/**
 * POST /api/instagram/publish
 * Body: { carouselId: string }
 *
 * Publishes an APPROVED carousel owned by the current user to Instagram.
 * All orchestration (status transitions, public JPEG URL building, Graph
 * API calls/polling) lives in lib/instagram-publish.ts — this route is
 * just session handling, input validation, and error-to-HTTP-status
 * mapping.
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const parsed = publishRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const { carousel, mediaId } = await publishCarouselForUser({
      carouselId: parsed.data.carouselId,
      userId,
      baseUrl: resolveBaseUrl(request),
    });

    return NextResponse.json({ carousel, mediaId });
  } catch (error) {
    if (error instanceof CarouselNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof CarouselNotApprovedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    if (error instanceof MissingInstagramConnectionError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    if (error instanceof CorruptedCarouselContentError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (
      error instanceof MissingInstagramCredentialsError ||
      error instanceof TooFewSlidesError ||
      error instanceof TooManySlidesError
    ) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }

    if (error instanceof InstagramApiError) {
      // Never log accessToken — InstagramApiError only ever carries Meta's
      // own message + fbtrace_id, both safe to log.
      console.error(
        `Instagram publish failed (fbtrace_id: ${error.fbtraceId ?? "n/a"}):`,
        error.message
      );
      return NextResponse.json(
        { error: `Publishing to Instagram failed: ${error.message}` },
        { status: 502 }
      );
    }

    console.error("Instagram publish failed unexpectedly:", error);
    return NextResponse.json(
      { error: "Something went wrong while publishing to Instagram." },
      { status: 500 }
    );
  }
}
