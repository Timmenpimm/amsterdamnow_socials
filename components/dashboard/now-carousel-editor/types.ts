import type { CarouselStatus } from "@prisma/client";

import type { NowStoredSlide } from "@/lib/now-carousel";
import type { NowTemplateFamily } from "@/templates/now/manifest";

/**
 * Editor state for an Amsterdam NOW carousel (`Carousel.template` =
 * "now:<family>"). Deliberately separate from the satori editor's
 * EditorCarousel: NOW slides are manifest-driven token bags
 * ({index, slideType, values}), not headline/body slides.
 */
export interface NowEditorCarousel {
  id: string;
  family: NowTemplateFamily;
  slides: NowStoredSlide[];
  caption: string;
  hashtags: string[];
  status: CarouselStatus;
  instagramId: string | null;
}

export interface NowEditorArticle {
  id: string;
  title: string;
  imageUrl: string | null;
}

export type NowSlideRenderStatus = "idle" | "loading" | "ready" | "error";

export interface NowSlideRenderState {
  status: NowSlideRenderStatus;
  dataUrl?: string;
  error?: string;
  /**
   * Per-slide problems returned by POST /api/render's 422 branch
   * (validateNowSlides output) — listed under the error message so the
   * editor can see exactly which token blocks the render.
   */
  issues?: string[];
}
