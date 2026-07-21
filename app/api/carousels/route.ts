import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { listCarouselsForUser } from "@/lib/carousels";

/**
 * GET /api/carousels
 *
 * Lists every carousel belonging to the signed-in user (via
 * Carousel -> Article -> WordPressConnection -> User), newest first, with
 * the parent article's title/image attached so the dashboard can render a
 * list without a second round-trip.
 */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const carousels = await listCarouselsForUser(userId);
    return NextResponse.json({ carousels });
  } catch (error) {
    console.error("Failed to list carousels:", error);
    return NextResponse.json(
      { error: "Something went wrong while loading carousels." },
      { status: 500 }
    );
  }
}
