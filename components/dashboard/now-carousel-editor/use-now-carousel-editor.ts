"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { CarouselStatus } from "@prisma/client";
import {
  nowStoredSlidesSchema,
  validateNowSlides,
  type NowStoredSlide,
} from "@/lib/now-carousel";

import { useNowSlideRenders } from "./use-now-slide-renders";
import type { NowEditorCarousel } from "./types";

interface CarouselApiRow {
  caption: string;
  hashtags: string[];
  status: CarouselStatus;
  instagramId: string | null;
  slides: unknown;
}

interface CarouselResponse {
  carousel: CarouselApiRow;
}

interface ErrorResponse {
  error: string;
}

type ApiResult = CarouselResponse | ErrorResponse;

function toErrorMessage(status: number, data: ApiResult): string {
  if (!("error" in data)) return "Er is iets misgegaan.";
  return status === 503 ? `Niet beschikbaar: ${data.error}` : data.error;
}

async function patchCarousel(
  id: string,
  body: Record<string, unknown>
): Promise<{ ok: boolean; status: number; data: ApiResult }> {
  const response = await fetch(`/api/carousels/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as ApiResult;
  return { ok: response.ok, status: response.status, data };
}

/**
 * Client-side data logic for the Amsterdam NOW editor: carousel state,
 * per-slide previews, and every mutation (save one slide's placeholder
 * values, save caption/hashtags, DRAFT<->APPROVED, delete). Mirrors
 * use-carousel-editor.ts for the satori templates — the difference is the
 * slide shape (manifest tokens instead of headline/body) and the
 * client-side validateNowSlides gate before every slide save.
 */
export function useNowCarouselEditor(initial: NowEditorCarousel) {
  const router = useRouter();
  const [carousel, setCarousel] = useState(initial);

  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { renders, renderSlide, ensureRendered } = useNowSlideRenders(carousel.id);

  /**
   * Merges a PATCH response into local state. The API returns the raw DB
   * row, whose `slides` is untyped JSON — re-parsed here, falling back to
   * the slides we just sent if the round trip somehow doesn't validate.
   */
  function applyCarouselResponse(row: CarouselApiRow, fallback: NowStoredSlide[]): void {
    const parsed = nowStoredSlidesSchema.safeParse(row.slides);
    setCarousel((prev) => ({
      ...prev,
      slides: parsed.success ? (parsed.data as NowStoredSlide[]) : fallback,
      caption: row.caption,
      hashtags: row.hashtags,
      status: row.status,
      instagramId: row.instagramId,
    }));
  }

  async function saveSlideValues(
    index: number,
    values: Record<string, string>
  ): Promise<boolean> {
    const updatedSlides = carousel.slides.map((slide) =>
      slide.index === index ? { ...slide, values } : slide
    );

    // Block the save before it reaches the server: the same check the
    // renderer runs (lib/now-carousel.ts), so a broken token never gets
    // stored in the first place.
    const problems = validateNowSlides(carousel.family, updatedSlides);
    if (problems.length > 0) {
      toast.error("Deze carousel is nog niet geldig:", {
        description: problems.slice(0, 5).join(" "),
      });
      return false;
    }

    setSavingIndex(index);
    try {
      const { ok, status, data } = await patchCarousel(carousel.id, {
        slides: updatedSlides,
      });

      if (!ok) {
        toast.error(toErrorMessage(status, data));
        return false;
      }

      applyCarouselResponse((data as CarouselResponse).carousel, updatedSlides);
      toast.success("Slide opgeslagen.");
      void renderSlide(index);
      return true;
    } catch {
      toast.error("Kon geen verbinding maken met de server.");
      return false;
    } finally {
      setSavingIndex(null);
    }
  }

  async function saveCaptionAndHashtags(
    caption: string,
    hashtags: string[]
  ): Promise<boolean> {
    setIsSavingMeta(true);
    try {
      const { ok, status, data } = await patchCarousel(carousel.id, {
        caption,
        hashtags,
      });

      if (!ok) {
        toast.error(toErrorMessage(status, data));
        return false;
      }

      applyCarouselResponse((data as CarouselResponse).carousel, carousel.slides);
      toast.success("Onderschrift en hashtags opgeslagen.");
      return true;
    } catch {
      toast.error("Kon geen verbinding maken met de server.");
      return false;
    } finally {
      setIsSavingMeta(false);
    }
  }

  async function setStatus(status: "DRAFT" | "APPROVED"): Promise<void> {
    setIsUpdatingStatus(true);
    try {
      const { ok, status: httpStatus, data } = await patchCarousel(carousel.id, {
        status,
      });

      if (!ok) {
        toast.error(toErrorMessage(httpStatus, data));
        return;
      }

      applyCarouselResponse((data as CarouselResponse).carousel, carousel.slides);
      toast.success(
        status === "APPROVED"
          ? "Carousel goedgekeurd voor publicatie."
          : "Carousel teruggezet naar concept."
      );
    } catch {
      toast.error("Kon geen verbinding maken met de server.");
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  /** Status/instagramId merge for useCarouselPublish — see the satori editor's twin. */
  function applyPublishUpdate(update: {
    status: CarouselStatus;
    instagramId?: string | null;
  }): void {
    setCarousel((prev) => ({
      ...prev,
      status: update.status,
      ...(update.instagramId !== undefined
        ? { instagramId: update.instagramId }
        : {}),
    }));
  }

  async function deleteCarousel(): Promise<void> {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/carousels/${carousel.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { ok: true } | ErrorResponse;

      if (!response.ok) {
        toast.error("error" in data ? data.error : "Verwijderen is mislukt.");
        return;
      }

      toast.success("Carousel verwijderd.");
      router.push("/dashboard/carousels");
      router.refresh();
    } catch {
      toast.error("Kon geen verbinding maken met de server.");
    } finally {
      setIsDeleting(false);
    }
  }

  return {
    carousel,
    renders,
    renderSlide,
    ensureRendered,
    saveSlideValues,
    saveCaptionAndHashtags,
    setStatus,
    applyPublishUpdate,
    deleteCarousel,
    savingIndex,
    isSavingMeta,
    isUpdatingStatus,
    isDeleting,
  };
}
