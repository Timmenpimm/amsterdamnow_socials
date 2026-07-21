// Note: deliberately NOT importing "server-only" here. That package
// unconditionally throws unless it's required through Next's webpack build
// (which aliases it away for server compilations) — it would break
// `scripts/test-render.ts`, which runs this module directly under Node via
// tsx. Node-only APIs (fs, Buffer) already make misuse from a Client
// Component fail loudly at build time regardless.
import { readFile } from "node:fs/promises";
import path from "node:path";

import { Resvg } from "@resvg/resvg-js";
import satori from "satori";

import { getTemplate } from "@/templates";
import { SLIDE_HEIGHT, SLIDE_WIDTH, type SlideMeta } from "@/templates/types";
import type { BrandSettings, CarouselContent, Slide } from "@/types/carousel";

const FONT_DIR = path.join(process.cwd(), "assets", "fonts");

interface LoadedFonts {
  regular: Buffer;
  bold: Buffer;
}

/**
 * Fonts are read from disk once per server process and reused for every
 * render after that. Cache the in-flight promise (not just the result) so
 * concurrent renderSlide() calls during a burst don't all hit the disk.
 */
let fontsPromise: Promise<LoadedFonts> | null = null;

function loadFonts(): Promise<LoadedFonts> {
  if (!fontsPromise) {
    fontsPromise = (async () => {
      const [regular, bold] = await Promise.all([
        readFile(path.join(FONT_DIR, "Inter-Regular.ttf")),
        readFile(path.join(FONT_DIR, "Inter-Bold.ttf")),
      ]);
      return { regular, bold };
    })().catch((error) => {
      // Reset so a transient failure (e.g. read during a deploy) doesn't
      // permanently poison the cache for the life of the process.
      fontsPromise = null;
      throw error;
    });
  }

  return fontsPromise;
}

const IMAGE_FETCH_TIMEOUT_MS = 10_000;

/**
 * Satori cannot fetch remote images itself — `<img src="https://...">`
 * would render as a blank box. Resolve any http(s) URL to a base64 data URI
 * before it reaches a template. Returns undefined (instead of throwing) on
 * any failure so a broken/slow image degrades to a template's solid-color
 * fallback rather than failing the whole render.
 */
async function resolveImageToDataUri(url: string | undefined): Promise<string | undefined> {
  if (!url) return undefined;
  if (url.startsWith("data:")) return url;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      console.warn(`renderer: image fetch failed (${response.status}) for ${url}`);
      return undefined;
    }

    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${bytes.toString("base64")}`;
  } catch (error) {
    console.warn(`renderer: could not resolve image ${url}:`, error);
    return undefined;
  } finally {
    clearTimeout(timeout);
  }
}

async function svgToPng(svg: string): Promise<Buffer> {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: SLIDE_WIDTH },
  });
  return resvg.render().asPng();
}

/**
 * Renders a single slide: template JSX -> satori SVG -> resvg PNG.
 * `meta.imageUrl`, if present, is resolved to a data URI first (see
 * resolveImageToDataUri) so templates never have to deal with I/O.
 */
export async function renderSlide(
  slide: Slide,
  templateId: string,
  brand: BrandSettings,
  meta: SlideMeta
): Promise<Buffer> {
  const template = getTemplate(templateId);
  const fonts = await loadFonts();
  const resolvedImageUrl = await resolveImageToDataUri(meta.imageUrl);

  const jsx = template(slide, brand, { ...meta, imageUrl: resolvedImageUrl });

  const svg = await satori(jsx, {
    width: SLIDE_WIDTH,
    height: SLIDE_HEIGHT,
    fonts: [
      { name: "Inter", data: fonts.regular, weight: 400, style: "normal" },
      { name: "Inter", data: fonts.bold, weight: 700, style: "normal" },
    ],
  });

  return svgToPng(svg);
}

/**
 * Renders every slide of a carousel with the same template + brand.
 * Slides are rendered sequentially (not Promise.all) to keep peak memory
 * predictable — satori + resvg both hold full raster buffers in memory,
 * and carousels can have 8-10 slides.
 */
export async function renderCarousel(
  content: CarouselContent,
  templateId: string,
  brand: BrandSettings
): Promise<Buffer[]> {
  const total = content.slides.length;
  const buffers: Buffer[] = [];

  for (const slide of content.slides) {
    const buffer = await renderSlide(slide, templateId, brand, {
      index: slide.index,
      total,
      imageUrl: slide.imageUrl,
    });
    buffers.push(buffer);
  }

  return buffers;
}
