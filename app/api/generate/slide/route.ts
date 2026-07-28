import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveApiUserId } from "@/lib/api-auth";
import {
  regenerateSlideRequestSchema,
  slidesSchema,
  type CarouselUpdateInput,
} from "@/lib/carousel-schema";
import {
  CarouselNotFoundError,
  canMutateCarouselContent,
  getCarouselForUser,
  updateCarouselForUser,
} from "@/lib/carousels";
import { db } from "@/lib/db";
import {
  nowStoredSlidesSchema,
  parseNowTemplateId,
  validateNowSlides,
  type NowStoredSlide,
} from "@/lib/now-carousel";
import { InvalidNowSlidesError, regenerateNowSlide } from "@/lib/now-generator";
import {
  InvalidSlideOutputError,
  MissingOpenAiKeyError,
  SlideNotFoundError,
  regenerateSlide,
} from "@/lib/openai";
import type { NowTemplateFamily } from "@/templates/now/manifest";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Het artikel zoals beide regeneratiepaden het nodig hebben. */
interface ArticleContext {
  title: string;
  content: string;
  excerpt: string | null;
}

/**
 * Regenereert één slide van een `now:<family>` carousel. NOW-slides zijn
 * manifest-vormig (index/slideType/values) en halen het satori-slidesSchema
 * nooit, dus dit pad valideert met nowStoredSlidesSchema en laat de tekst
 * herschrijven door lib/now-generator.ts. Foto, volgnummer en aantal blijven
 * daarbij staan; alleen de tekstvelden veranderen.
 */
async function regenerateNowSlideResponse(
  carouselId: string,
  userId: string,
  family: NowTemplateFamily,
  rawSlides: unknown,
  slideIndex: number,
  article: ArticleContext
): Promise<NextResponse> {
  const parsed = nowStoredSlidesSchema.safeParse(rawSlides);
  if (!parsed.success) {
    console.error("NOW Carousel.slides failed validation:", parsed.error);
    return NextResponse.json(
      {
        error:
          "De inhoud van deze NOW-carrousel is beschadigd en kan niet worden geregenereerd.",
        issues: z.treeifyError(parsed.error),
      },
      { status: 500 }
    );
  }
  const slides = parsed.data as NowStoredSlide[];

  try {
    const newSlide = await regenerateNowSlide(
      article,
      family,
      slides,
      slideIndex
    );

    const updatedSlides = slides.map((slide) =>
      slide.index === slideIndex ? newSlide : slide
    );

    // De regeneratie zelf controleert alleen de nieuwe slide; dit is de laatste
    // poort voordat de hele lijst weer wordt weggeschreven.
    const issues = validateNowSlides(family, updatedSlides);
    if (issues.length > 0) {
      console.error("NOW slide regeneration produced invalid slides:", issues);
      return NextResponse.json(
        {
          error: `Slide ${slideIndex + 1} van deze NOW-carrousel (${family}) is na regeneratie niet renderbaar.`,
          issues,
        },
        { status: 500 }
      );
    }

    // `slides` wordt hoe dan ook als opake JSON opgeslagen (lib/carousels.ts
    // cast naar Prisma.InputJsonValue); de cast overbrugt alleen dat
    // CarouselUpdateInput de satori-vorm beschrijft — zie
    // app/api/carousels/[id]/route.ts, dat hetzelfde doet.
    const updated = await updateCarouselForUser(carouselId, userId, {
      slides: updatedSlides,
    } as unknown as CarouselUpdateInput);

    return NextResponse.json({ slide: newSlide, carousel: updated });
  } catch (error) {
    if (error instanceof SlideNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (error instanceof MissingOpenAiKeyError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    if (error instanceof InvalidNowSlidesError) {
      return NextResponse.json(
        { error: error.message, issues: error.problems },
        { status: 502 }
      );
    }

    if (error instanceof InvalidSlideOutputError) {
      console.error("NOW slide regeneration produced invalid output:", error.cause);
      return NextResponse.json(
        {
          error:
            "AI generation did not produce a valid slide structure. Please try again.",
        },
        { status: 502 }
      );
    }

    console.error("NOW slide regeneration failed unexpectedly:", error);
    return NextResponse.json(
      { error: "Something went wrong while regenerating the slide." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/generate/slide
 * Body: { carouselId: string, slideIndex: number }
 *
 * Regenerates one slide of an existing carousel and persists the result
 * (the other slides are left untouched). Mirrors /api/generate's
 * OPENAI_API_KEY / MOCK_AI=1 handling.
 */
export async function POST(request: Request) {
  const userId = await resolveApiUserId(request);

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

  // Twee generatoren achter één endpoint, net als /api/render: `now:<family>`
  // gaat naar de manifest-gedreven NOW-generator, elk ander template naar het
  // oorspronkelijke satori-pad.
  const nowFamily = parseNowTemplateId(carousel.template);
  if (nowFamily) {
    return regenerateNowSlideResponse(
      carouselId,
      userId,
      nowFamily,
      carousel.slides,
      slideIndex,
      article
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
