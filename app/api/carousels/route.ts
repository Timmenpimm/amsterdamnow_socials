import { NextResponse } from "next/server";

import { resolveApiUserId } from "@/lib/api-auth";
import { listCarouselsForUser } from "@/lib/carousels";

/**
 * GET /api/carousels?wordpressId=123
 *
 * Lists every carousel belonging to the signed-in user (via
 * Carousel -> Article -> WordPressConnection -> User), newest first, with
 * the parent article's id/wordpressId/title/image attached so the dashboard
 * can render a list without a second round-trip. The optional `wordpressId`
 * query param narrows the list to carousels of that WordPress post.
 */
export async function GET(request: Request) {
  const userId = await resolveApiUserId(request);

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const rawWordpressId = new URL(request.url).searchParams.get("wordpressId");
  let wordpressId: number | undefined;
  if (rawWordpressId !== null) {
    wordpressId = Number(rawWordpressId);
    if (!Number.isInteger(wordpressId) || wordpressId <= 0) {
      return NextResponse.json(
        { error: "wordpressId must be a positive integer." },
        { status: 400 }
      );
    }
  }

  try {
    const carousels = await listCarouselsForUser(userId, { wordpressId });
    return NextResponse.json({ carousels });
  } catch (error) {
    console.error("Failed to list carousels:", error);
    return NextResponse.json(
      { error: "Something went wrong while loading carousels." },
      { status: 500 }
    );
  }
}
