import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveApiUserId } from "@/lib/api-auth";
import { getBrandSettings } from "@/lib/connections/brand";
import { db } from "@/lib/db";
import {
  nowStoredSlidesSchema,
  parseNowTemplateId,
  validateNowSlides,
  type NowStoredSlide,
} from "@/lib/now-carousel";
import { renderCarousel, renderSlide } from "@/lib/renderer";
import {
  isNowRendererUnavailable,
  renderNowCarousel,
  renderNowSlide,
  type RenderNowSlideInput,
} from "@/lib/renderer-now";
import { isTemplateId } from "@/templates";
import type { NowTemplateFamily } from "@/templates/now/manifest";
import type { BrandSettings, CarouselContent } from "@/types/carousel";

import { renderRequestSchema, slidesSchema } from "./schema";

// satori + @resvg/resvg-js use native/Node APIs (fs, native bindings) and
// cannot run on the Edge runtime; the NOW path additionally spawns a headless
// Chromium (lib/renderer-now.ts), which is Node-only too.
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Fallback used when the user hasn't configured brand settings yet
 * (components/dashboard/brand-settings-section.tsx / getBrandSettings()
 * returns null for a first-time user). Real per-user brand settings are
 * now looked up via lib/connections/brand.ts below.
 */
const DEFAULT_BRAND_SETTINGS: BrandSettings = {
  name: "",
  primaryColor: "#d0342c",
  secondaryColor: "#111111",
  textColor: "#111111",
  backgroundColor: "#ffffff",
  fontFamily: "Inter",
};

function toDataUrl(png: Buffer): string {
  return `data:image/png;base64,${png.toString("base64")}`;
}

const NOW_RENDER_FAILED =
  "Er ging iets mis bij het renderen van de NOW-carrousel.";
const NOW_RENDER_UNAVAILABLE =
  "NOW-rendering is niet beschikbaar in deze omgeving: er kon geen headless browser worden gestart. Probeer het later opnieuw of render lokaal.";

/**
 * Renders a `now:<family>` carousel through the Playwright/HTML pipeline
 * (lib/renderer-now.ts) instead of satori. The response shape is identical to
 * the satori path, so the preview editor doesn't need to know the difference.
 */
async function renderNowCarouselResponse(
  family: NowTemplateFamily,
  rawSlides: unknown,
  slideIndex: number | undefined
): Promise<NextResponse> {
  const parsed = nowStoredSlidesSchema.safeParse(rawSlides);
  if (!parsed.success) {
    console.error("NOW Carousel.slides failed validation:", parsed.error);
    return NextResponse.json(
      {
        error:
          "De inhoud van deze NOW-carrousel is beschadigd en kan niet worden gerenderd.",
      },
      { status: 500 }
    );
  }

  // The schema only guarantees `slideType: string`; validateNowSlides is what
  // actually proves each one exists for this family (and that every declared
  // token is present), so the renderer is never called with an invalid slide.
  const slides = parsed.data as NowStoredSlide[];
  const issues = validateNowSlides(family, slides);
  if (issues.length > 0) {
    return NextResponse.json(
      {
        error: `Deze NOW-carrousel (${family}) is nog niet renderbaar.`,
        issues,
      },
      { status: 422 }
    );
  }

  const toInput = (slide: NowStoredSlide): RenderNowSlideInput => ({
    family,
    slideType: slide.slideType,
    values: slide.values,
  });

  try {
    if (slideIndex !== undefined) {
      const slide = slides.find((s) => s.index === slideIndex);
      if (!slide) {
        return NextResponse.json(
          { error: `No slide with index ${slideIndex} on this carousel.` },
          { status: 400 }
        );
      }

      const png = await renderNowSlide(toInput(slide));
      return NextResponse.json({
        slides: [{ index: slide.index, dataUrl: toDataUrl(png) }],
      });
    }

    const buffers = await renderNowCarousel(slides.map(toInput));
    return NextResponse.json({
      slides: buffers.map((png, i) => ({
        index: slides[i].index,
        dataUrl: toDataUrl(png),
      })),
    });
  } catch (error) {
    console.error("NOW carousel render failed:", error);
    return isNowRendererUnavailable(error)
      ? NextResponse.json({ error: NOW_RENDER_UNAVAILABLE }, { status: 503 })
      : NextResponse.json({ error: NOW_RENDER_FAILED }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userId = await resolveApiUserId(request);

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

  const parsed = renderRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }
  const { carouselId, slideIndex } = parsed.data;

  let carousel;
  try {
    carousel = await db.carousel.findUnique({
      where: { id: carouselId },
      include: { article: { include: { connection: true } } },
    });
  } catch (error) {
    console.error("Failed to load carousel for render:", error);
    return NextResponse.json(
      { error: "Something went wrong while loading the carousel." },
      { status: 500 }
    );
  }

  // Same 404 for "doesn't exist" and "isn't yours" — don't leak which one.
  if (!carousel || carousel.article.connection.userId !== userId) {
    return NextResponse.json({ error: "Carousel not found." }, { status: 404 });
  }

  // Two renderers behind one endpoint: `now:<family>` goes to the pixel-perfect
  // HTML/Playwright path, every other (known) id to the generic satori path.
  const nowFamily = parseNowTemplateId(carousel.template);
  if (nowFamily) {
    return renderNowCarouselResponse(nowFamily, carousel.slides, slideIndex);
  }

  if (!isTemplateId(carousel.template)) {
    return NextResponse.json(
      { error: `Carousel has an unknown template id "${carousel.template}".` },
      { status: 400 }
    );
  }
  const templateId = carousel.template;

  const slidesResult = slidesSchema.safeParse(carousel.slides);
  if (!slidesResult.success) {
    console.error("Carousel.slides failed validation:", slidesResult.error);
    return NextResponse.json(
      { error: "Carousel content is corrupted and cannot be rendered." },
      { status: 500 }
    );
  }
  const slides = slidesResult.data;

  const content: CarouselContent = {
    title: carousel.article.title,
    slides,
    caption: carousel.caption,
    hashtags: carousel.hashtags,
  };

  const brand = (await getBrandSettings(userId)) ?? DEFAULT_BRAND_SETTINGS;

  try {
    if (slideIndex !== undefined) {
      const slide = content.slides.find((s) => s.index === slideIndex);
      if (!slide) {
        return NextResponse.json(
          { error: `No slide with index ${slideIndex} on this carousel.` },
          { status: 400 }
        );
      }

      const png = await renderSlide(slide, templateId, brand, {
        index: slide.index,
        total: content.slides.length,
        imageUrl: slide.imageUrl,
      });

      return NextResponse.json({
        slides: [{ index: slide.index, dataUrl: toDataUrl(png) }],
      });
    }

    const buffers = await renderCarousel(content, templateId, brand);
    return NextResponse.json({
      slides: buffers.map((png, i) => ({
        index: content.slides[i].index,
        dataUrl: toDataUrl(png),
      })),
    });
  } catch (error) {
    console.error("Carousel render failed:", error);
    return NextResponse.json(
      { error: "Something went wrong while rendering the carousel." },
      { status: 500 }
    );
  }

  // TODO (Phase 6): persist rendered PNGs to Supabase Storage and return
  // storage URLs instead of (or alongside) inline base64 data URLs, which
  // don't scale well for repeated/cached access.
}
