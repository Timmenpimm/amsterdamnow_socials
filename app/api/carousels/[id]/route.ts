import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveApiUserId } from "@/lib/api-auth";
import {
  carouselUpdateSchema,
  slidesSchema,
  type CarouselUpdateInput,
} from "@/lib/carousel-schema";
import { nowStoredSlidesSchema } from "@/lib/now-carousel";
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

/**
 * PATCH body. Identical to lib/carousel-schema.ts's carouselUpdateSchema
 * except for `slides`, which additionally accepts the Amsterdam NOW slide
 * shape ({ index, slideType, values } — lib/now-carousel.ts). The satori
 * branch of the union is tried first and is unchanged, so satori carousels
 * validate exactly as before; the NOW editor can now save its own slides
 * through the same endpoint instead of being rejected with 400.
 */
const carouselPatchSchema = z
  .object({
    ...carouselUpdateSchema.shape,
    slides: z.union([slidesSchema, nowStoredSlidesSchema]).optional(),
  })
  .refine(
    (value) =>
      value.slides !== undefined ||
      value.caption !== undefined ||
      value.hashtags !== undefined ||
      value.template !== undefined ||
      value.status !== undefined,
    { message: "At least one field must be provided." }
  );

/** GET /api/carousels/[id] — one carousel, with its parent article. */
export async function GET(request: Request, { params }: RouteParams) {
  const userId = await resolveApiUserId(request);

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
  const userId = await resolveApiUserId(request);

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

  const parsed = carouselPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  try {
    // `slides` is stored as opaque JSON either way (lib/carousels.ts casts it
    // to Prisma.InputJsonValue); the cast only bridges the widened union.
    const carousel = await updateCarouselForUser(
      id,
      userId,
      parsed.data as CarouselUpdateInput
    );
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
export async function DELETE(request: Request, { params }: RouteParams) {
  const userId = await resolveApiUserId(request);

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
