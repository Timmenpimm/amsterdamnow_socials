import { NextResponse } from "next/server";

import { auth } from "@/auth";
import {
  CarouselNotFoundError,
  getCarouselPublishStatusForUser,
} from "@/lib/instagram-publish";

/**
 * GET /api/instagram/publish/status?carouselId=...
 *
 * Returns the current Carousel.status + instagramId (+ permalink, once
 * PUBLISHED), for the editor UI to poll while a publish is in flight (POST
 * /api/instagram/publish returns only once the whole Graph API flow
 * finishes, but the UI can start polling this immediately after firing that
 * request if it wants earlier feedback).
 */
export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const carouselId = new URL(request.url).searchParams.get("carouselId");
  if (!carouselId) {
    return NextResponse.json(
      { error: "carouselId query parameter is required." },
      { status: 400 }
    );
  }

  try {
    const result = await getCarouselPublishStatusForUser(carouselId, userId);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof CarouselNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("Failed to load carousel publish status:", error);
    return NextResponse.json(
      { error: "Something went wrong while loading the publish status." },
      { status: 500 }
    );
  }
}
