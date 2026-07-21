import type { ReactNode } from "react";

import type { BrandSettings, Slide } from "@/types/carousel";

/** Fixed Instagram-carousel slide size (4:5 portrait). */
export const SLIDE_WIDTH = 1080;
export const SLIDE_HEIGHT = 1350;

/**
 * Per-slide metadata that isn't part of the slide's own content:
 * its position in the carousel, and a resolved image ready to draw
 * (already turned into a data URI by lib/renderer.ts — satori cannot
 * fetch remote images itself).
 */
export interface SlideMeta {
  index: number;
  total: number;
  imageUrl?: string;
}

/**
 * A template is a pure function: content + brand + position in, satori-
 * compatible JSX out. No I/O, no side effects — rendering (satori -> SVG
 * -> resvg -> PNG) happens in lib/renderer.ts.
 */
export type SlideTemplate = (
  slide: Slide,
  brand: BrandSettings,
  meta: SlideMeta
) => ReactNode;
