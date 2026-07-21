import type { CarouselStatus } from "@prisma/client";

import type { TemplateId } from "@/templates";
import type { Slide } from "@/types/carousel";

/** Editor's in-memory shape of a carousel — the subset of the DB row the UI needs. */
export interface EditorCarousel {
  id: string;
  template: TemplateId;
  slides: Slide[];
  caption: string;
  hashtags: string[];
  status: CarouselStatus;
  instagramId: string | null;
}

export interface EditorArticle {
  id: string;
  title: string;
  imageUrl: string | null;
}

export type SlideRenderStatus = "idle" | "loading" | "ready" | "error";

export interface SlideRenderState {
  status: SlideRenderStatus;
  dataUrl?: string;
  error?: string;
}
