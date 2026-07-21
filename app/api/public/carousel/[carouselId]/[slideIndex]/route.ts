import { NextResponse } from "next/server";
import sharp from "sharp";

import { getBrandSettings } from "@/lib/connections/brand";
import { slidesSchema } from "@/lib/carousel-schema";
import { db } from "@/lib/db";
import { verifyRenderToken } from "@/lib/public-render";
import { renderSlide } from "@/lib/renderer";
import { isTemplateId } from "@/templates";
import type { BrandSettings } from "@/types/carousel";

// satori + @resvg/resvg-js + sharp all use native/Node APIs and cannot run
// on the Edge runtime — same constraint as /api/render.
export const runtime = "nodejs";

/**
 * Publicly-reachable, HMAC-signed rendering of one carousel slide as a
 * JPEG. This is the only render route with no session check: the Instagram
 * Graph API fetches carousel images itself over a plain GET (see
 * lib/instagram-publish.ts), so it must be reachable without a login.
 * Instead of a session, a valid `?t=` token (see lib/public-render.ts)
 * gates access.
 *
 * Renders through the satori pipeline only (lib/renderer.ts) — the
 * Playwright "NOW" render path (lib/renderer-now.ts) needs a browser
 * binary and cannot run in a serverless function.
 */

interface RouteParams {
  params: Promise<{ carouselId: string; slideIndex: string }>;
}

const DEFAULT_BRAND_SETTINGS: BrandSettings = {
  name: "",
  primaryColor: "#d0342c",
  secondaryColor: "#111111",
  textColor: "#111111",
  backgroundColor: "#ffffff",
  fontFamily: "Inter",
};

const JPEG_QUALITY = 90;
// Slide images only change when the carousel is re-edited, and each
// publish run mints a fresh HMAC token anyway — safe to cache aggressively.
const CACHE_CONTROL = "public, max-age=31536000, immutable";

export async function GET(request: Request, { params }: RouteParams) {
  const { carouselId, slideIndex: slideIndexParam } = await params;
  const slideIndex = Number(slideIndexParam);

  if (!Number.isInteger(slideIndex) || slideIndex < 0) {
    return NextResponse.json({ error: "Slide not found." }, { status: 404 });
  }

  const token = new URL(request.url).searchParams.get("t");
  if (!verifyRenderToken(carouselId, slideIndex, token)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  let carousel;
  try {
    carousel = await db.carousel.findUnique({
      where: { id: carouselId },
      include: { article: { include: { connection: true } } },
    });
  } catch (error) {
    console.error("Failed to load carousel for public render:", error);
    return NextResponse.json(
      { error: "Something went wrong while loading the carousel." },
      { status: 500 }
    );
  }

  if (!carousel) {
    return NextResponse.json({ error: "Carousel not found." }, { status: 404 });
  }

  if (!isTemplateId(carousel.template)) {
    console.error(
      `Carousel ${carousel.id} has an unknown template id "${carousel.template}".`
    );
    return NextResponse.json(
      { error: "Carousel content is corrupted." },
      { status: 500 }
    );
  }
  const templateId = carousel.template;

  const slidesResult = slidesSchema.safeParse(carousel.slides);
  if (!slidesResult.success) {
    console.error("Carousel.slides failed validation:", slidesResult.error);
    return NextResponse.json(
      { error: "Carousel content is corrupted." },
      { status: 500 }
    );
  }
  const slides = slidesResult.data;

  const slide = slides.find((s) => s.index === slideIndex);
  if (!slide) {
    return NextResponse.json({ error: "Slide not found." }, { status: 404 });
  }

  const userId = carousel.article.connection.userId;
  const brand = (await getBrandSettings(userId)) ?? DEFAULT_BRAND_SETTINGS;

  try {
    const png = await renderSlide(slide, templateId, brand, {
      index: slide.index,
      total: slides.length,
      imageUrl: slide.imageUrl,
    });

    // Instagram's Graph API requires JPEG (or a small set of raster
    // formats) for feed media — resvg only produces PNG, so re-encode.
    const jpeg = await sharp(png).jpeg({ quality: JPEG_QUALITY }).toBuffer();

    // Return a plain Uint8Array, NOT the Node Buffer: on the Vercel serverless
    // runtime, passing a Buffer to NextResponse gets coerced to a UTF-8 string,
    // which mangles every byte > 0x7F (each becomes U+FFFD) and produces a
    // corrupt JPEG that Instagram rejects. A Uint8Array is sent as raw bytes.
    const body = new Uint8Array(jpeg);

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(body.byteLength),
        "Cache-Control": CACHE_CONTROL,
      },
    });
  } catch (error) {
    console.error("Public slide render failed:", error);
    return NextResponse.json(
      { error: "Something went wrong while rendering the slide." },
      { status: 500 }
    );
  }
}
