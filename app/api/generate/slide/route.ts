import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { regenerateSlideRequestSchema, slidesSchema } from "@/lib/carousel-schema";
import {
  CarouselNotFoundError,
  canMutateCarouselContent,
  getCarouselForUser,
  updateCarouselForUser,
} from "@/lib/carousels";
import { db } from "@/lib/db";
import {
  InvalidSlideOutputError,
  MissingOpenAiKeyError,
  SlideNotFoundError,
  regenerateSlide,
} from "@/lib/openai";

export const runtime = "nodejs";

/**
 * POST /api/generate/slide
 * Body: { carouselId: string, slideIndex: number }
 *
 * Regenerates one slide of an existing carousel and persists the result
 * (the other slides are left untouched). Mirrors /api/generate's
 * OPENAI_API_KEY / MOCK_AI=1 handling.
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const aiConfigured =
    Boolean(process.env.OPENAI_API_KEY) || process.env.MOCK_AI === "1";
  if (!aiConfigured) {
    return NextResponse.json(
      {
        error:
          "AI generation is not configured: OPENAI_API_KEY is missing on the server.",
      },
      { status: 503 }
    );
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

  const parsed = regenerateSlideRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const { carouselId, slideIndex } = parsed.data;

  let carousel;
  try {
    carousel = await getCarouselForUser(carouselId, userId);
  } catch (error) {
    if (error instanceof CarouselNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Failed to load carousel for slide regeneration:", error);
    return NextResponse.json(
      { error: "Something went wrong while loading the carousel." },
      { status: 500 }
    );
  }

  if (!canMutateCarouselContent(carousel.status)) {
    return NextResponse.json(
      {
        error: `Carousel in status ${carousel.status} cannot have its slides regenerated.`,
      },
      { status: 409 }
    );
  }

  const slidesResult = slidesSchema.safeParse(carousel.slides);
  if (!slidesResult.success) {
    console.error("Carousel.slides failed validation:", slidesResult.error);
    return NextResponse.json(
      { error: "Carousel content is corrupted and cannot be regenerated." },
      { status: 500 }
    );
  }
  const slides = slidesResult.data;

  // getCarouselForUser() only selects a light article projection (title,
  // imageUrl) for list/detail views — fetch content/excerpt separately so
  // regenerateSlide() has the same article context generateCarousel() did.
  const article = await db.article.findUnique({
    where: { id: carousel.articleId },
    select: { title: true, content: true, excerpt: true },
  });

  if (!article) {
    return NextResponse.json(
      { error: "The article behind this carousel no longer exists." },
      { status: 404 }
    );
  }

  try {
    const newSlide = await regenerateSlide(
      article,
      { title: carousel.article.title, slides },
      slideIndex
    );

    const updatedSlides = slides.map((slide) =>
      slide.index === slideIndex ? newSlide : slide
    );

    const updated = await updateCarouselForUser(carouselId, userId, {
      slides: updatedSlides,
    });

    return NextResponse.json({ slide: newSlide, carousel: updated });
  } catch (error) {
    if (error instanceof SlideNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof MissingOpenAiKeyError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    if (error instanceof InvalidSlideOutputError) {
      console.error("Slide regeneration produced invalid output:", error.cause);
      return NextResponse.json(
        {
          error:
            "AI generation did not produce a valid slide structure. Please try again.",
        },
        { status: 502 }
      );
    }

    console.error("Slide regeneration failed unexpectedly:", error);
    return NextResponse.json(
      { error: "Something went wrong while regenerating the slide." },
      { status: 500 }
    );
  }
}
