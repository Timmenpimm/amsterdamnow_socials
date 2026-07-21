"use client";

import { useCallback, useState } from "react";

import type { SlideRenderState } from "./types";

interface RenderSuccessResponse {
  slides: { index: number; dataUrl: string }[];
}

interface RenderErrorResponse {
  error: string;
}

/**
 * Tracks a per-slide render status/result and knows how to (re-)render one
 * slide of a carousel via POST /api/render. Slides are rendered one at a
 * time (rather than the batch endpoint) so a single failing slide's error
 * + retry button stays scoped to that slide instead of failing the whole
 * strip — see the render API's slideIndex param in app/api/render/route.ts.
 */
export function useSlideRenders(carouselId: string) {
  const [renders, setRenders] = useState<Record<number, SlideRenderState>>({});

  const renderSlide = useCallback(
    async (slideIndex: number) => {
      setRenders((prev) => ({ ...prev, [slideIndex]: { status: "loading" } }));

      try {
        const response = await fetch("/api/render", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ carouselId, slideIndex }),
        });

        const data = (await response.json()) as
          | RenderSuccessResponse
          | RenderErrorResponse;

        if (!response.ok || !("slides" in data)) {
          const message =
            "error" in data ? data.error : "Renderen is mislukt.";
          setRenders((prev) => ({
            ...prev,
            [slideIndex]: { status: "error", error: message },
          }));
          return;
        }

        const dataUrl = data.slides[0]?.dataUrl;
        if (!dataUrl) {
          setRenders((prev) => ({
            ...prev,
            [slideIndex]: { status: "error", error: "Geen afbeelding ontvangen." },
          }));
          return;
        }

        setRenders((prev) => ({
          ...prev,
          [slideIndex]: { status: "ready", dataUrl },
        }));
      } catch {
        setRenders((prev) => ({
          ...prev,
          [slideIndex]: {
            status: "error",
            error: "Kon niet renderen. Controleer je verbinding.",
          },
        }));
      }
    },
    [carouselId]
  );

  const renderSlides = useCallback(
    (indices: number[]) => {
      for (const index of indices) {
        void renderSlide(index);
      }
    },
    [renderSlide]
  );

  return { renders, renderSlide, renderSlides };
}
