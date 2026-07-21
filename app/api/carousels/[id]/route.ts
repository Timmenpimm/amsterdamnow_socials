import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { carouselUpdateSchema } from "@/lib/carousel-schema";
import {
  CarouselDeleteNotAllowedError,
  CarouselNotFoundError,
  InvalidStatusTransitionError,
  deleteCarouselForUser,
  getCarouselForUser,
  updateCarouselForUser,
} from "@/lib/carousels";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** GET /api/carousels/[id] — one carousel, with its parent article. */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const carousel = await getCarouselForUser(id, userId);
    return NextResponse.json({ carousel });
  } catch (error) {
    if (error instanceof CarouselNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    console.error("Failed to load carousel:", error);
    return NextResponse.json(
      { error: "Something went wrong while loading the carousel." },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/carousels/[id]
 * Body (all optional, at least one required): slides, caption, hashtags,
 * template, status. `status` is only accepted for the DRAFT<->APPROVED
 * toggle — see lib/carousels.ts's transition table.
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const parsed = carouselUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const carousel = await updateCarouselForUser(id, userId, parsed.data);
    return NextResponse.json({ carousel });
  } catch (error) {
    if (error instanceof CarouselNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof InvalidStatusTransitionError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error("Failed to update carousel:", error);
    return NextResponse.json(
      { error: "Something went wrong while updating the carousel." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/carousels/[id]
 * Refuses to delete carousels currently PUBLISHING or PUBLISHED.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;

  try {
    await deleteCarouselForUser(id, userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof CarouselNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    if (error instanceof CarouselDeleteNotAllowedError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }

    console.error("Failed to delete carousel:", error);
    return NextResponse.json(
      { error: "Something went wrong while deleting the carousel." },
      { status: 500 }
    );
  }
}
