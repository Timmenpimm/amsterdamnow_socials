"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { TemplateId } from "@/templates";
import type { Slide } from "@/types/carousel";

import { useSlideRenders } from "./use-slide-renders";
import type { EditorCarousel } from "./types";

interface CarouselResponse {
  carousel: EditorCarousel;
}

interface ErrorResponse {
  error: string;
}

type ApiResult = CarouselResponse | ErrorResponse;

/** Turns a 503 (missing OPENAI_API_KEY) into a clearer message, passes the rest through. */
function toErrorMessage(status: number, data: ApiResult): string {
  if (!("error" in data)) return "Er is iets misgegaan.";
  return status === 503 ? `AI-generatie is niet beschikbaar: ${data.error}` : data.error;
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
 * All client-side data logic for the carousel editor: current carousel
 * state, per-slide render tracking, and every mutation (save slide text,
 * regenerate a slide with AI, switch template, save caption/hashtags,
 * change status, delete). Kept separate from the presentational components
 * under this folder so those stay small and focused.
 */
export function useCarouselEditor(initial: EditorCarousel) {
  const router = useRouter();
  const [carousel, setCarousel] = useState(initial);
  const [selectedIndex, setSelectedIndex] = useState(
    initial.slides[0]?.index ?? 0
  );

  const [isSwitchingTemplate, setIsSwitchingTemplate] = useState(false);
  const [isSavingMeta, setIsSavingMeta] = useState(false);
  const [isSavingSlide, setIsSavingSlide] = useState(false);
  const [isRegeneratingSlide, setIsRegeneratingSlide] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { renders, renderSlide, renderSlides } = useSlideRenders(carousel.id);

  useEffect(() => {
    renderSlides(initial.slides.map((slide) => slide.index));
    // Deliberately mount-only: later re-renders are triggered explicitly by
    // the mutation handlers below (save/regenerate/template switch), not by
    // watching `carousel` in general.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveSlideContent(
    index: number,
    patch: Pick<Slide, "headline" | "body" | "imagePrompt">
  ): Promise<boolean> {
    setIsSavingSlide(true);
    try {
      const updatedSlides = carousel.slides.map((slide) =>
        slide.index === index ? { ...slide, ...patch } : slide
      );
      const { ok, status, data } = await patchCarousel(carousel.id, {
        slides: updatedSlides,
      });

      if (!ok) {
        toast.error(toErrorMessage(status, data));
        return false;
      }

      setCarousel((data as CarouselResponse).carousel);
      toast.success("Slide opgeslagen.");
      void renderSlide(index);
      return true;
    } catch {
      toast.error("Kon geen verbinding maken met de server.");
      return false;
    } finally {
      setIsSavingSlide(false);
    }
  }

  async function regenerateSlideWithAi(index: number): Promise<void> {
    setIsRegeneratingSlide(true);
    try {
      const response = await fetch("/api/generate/slide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ carouselId: carousel.id, slideIndex: index }),
      });
      const data = (await response.json()) as ApiResult;

      if (!response.ok) {
        toast.error(toErrorMessage(response.status, data));
        return;
      }

      setCarousel((data as CarouselResponse).carousel);
      toast.success("Slide opnieuw gegenereerd.");
      void renderSlide(index);
    } catch {
      toast.error("Kon geen verbinding maken met de server.");
    } finally {
      setIsRegeneratingSlide(false);
    }
  }

  async function switchTemplate(template: TemplateId): Promise<void> {
    setIsSwitchingTemplate(true);
    try {
      const { ok, status, data } = await patchCarousel(carousel.id, {
        template,
      });

      if (!ok) {
        toast.error(toErrorMessage(status, data));
        return;
      }

      const updated = (data as CarouselResponse).carousel;
      setCarousel(updated);
      toast.success("Template gewijzigd — slides worden opnieuw gerenderd.");
      renderSlides(updated.slides.map((slide) => slide.index));
    } catch {
      toast.error("Kon geen verbinding maken met de server.");
    } finally {
      setIsSwitchingTemplate(false);
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

      setCarousel((data as CarouselResponse).carousel);
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
      const { ok, status: httpStatus, data } = await patchCarousel(
        carousel.id,
        { status }
      );

      if (!ok) {
        toast.error(toErrorMessage(httpStatus, data));
        return;
      }

      setCarousel((data as CarouselResponse).carousel);
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
    selectedIndex,
    setSelectedIndex,
    renders,
    renderSlide,
    saveSlideContent,
    regenerateSlideWithAi,
    switchTemplate,
    saveCaptionAndHashtags,
    setStatus,
    deleteCarousel,
    isSwitchingTemplate,
    isSavingMeta,
    isSavingSlide,
    isRegeneratingSlide,
    isUpdatingStatus,
    isDeleting,
  };
}
