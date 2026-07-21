import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { renderCarousel, renderSlide } from "@/lib/renderer";
import { isTemplateId } from "@/templates";
import type { BrandSettings, CarouselContent } from "@/types/carousel";

import { renderRequestSchema, slidesSchema } from "./schema";

// satori + @resvg/resvg-js use native/Node APIs (fs, native bindings) and
// cannot run on the Edge runtime.
export const runtime = "nodejs";

/**
 * TODO (Phase 6+): there is no persisted Brand model yet — the dashboard's
 * "Merkinstellingen" section (components/dashboard/brand-settings-section.tsx)
 * is still a placeholder. Until brand settings are stored per-user/per-
 * connection, every render uses this fixed default (black/white + the
 * project's accent red). Swap this out for a real lookup once that model
 * exists; the renderer and templates already accept any BrandSettings.
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

  const brand = DEFAULT_BRAND_SETTINGS;

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
