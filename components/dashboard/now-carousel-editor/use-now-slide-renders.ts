"use client";

import { useCallback, useRef, useState } from "react";

import type { NowSlideRenderState } from "./types";

interface RenderSuccessResponse {
  slides: { index: number; dataUrl: string }[];
}

interface RenderErrorResponse {
  error: string;
  /** 422 only: the validateNowSlides problems for this carousel. */
  issues?: unknown;
}

/** Keeps only the string entries of an unknown `issues` payload. */
function toIssueList(issues: unknown): string[] | undefined {
  if (!Array.isArray(issues)) return undefined;
  const strings = issues.filter((issue): issue is string => typeof issue === "string");
  return strings.length > 0 ? strings : undefined;
}

/**
 * Per-slide PNG previews for a NOW carousel via POST /api/render
 * ({ carouselId, slideIndex } -> { slides: [{ index, dataUrl }] }).
 *
 * Renders are lazy: `ensureRendered` fires at most one request per slide
 * (the cards call it when they scroll into view), while `renderSlide`
 * always re-renders — that's the "Vernieuw preview" / post-save path.
 * A headless-browser outage (503) and an invalid-content response (422,
 * with `issues`) are both surfaced as scoped per-slide errors instead of
 * taking down the page.
 */
export function useNowSlideRenders(carouselId: string) {
  const [renders, setRenders] = useState<Record<number, NowSlideRenderState>>({});
  const requested = useRef<Set<number>>(new Set());

  const renderSlide = useCallback(
    async (slideIndex: number) => {
      requested.current.add(slideIndex);
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
          const failure = data as RenderErrorResponse;
          setRenders((prev) => ({
            ...prev,
            [slideIndex]: {
              status: "error",
              error:
                typeof failure.error === "string" && failure.error.length > 0
                  ? failure.error
                  : "Renderen is mislukt.",
              issues: toIssueList(failure.issues),
            },
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

  /** Renders a slide the first time it's needed; a no-op afterwards. */
  const ensureRendered = useCallback(
    (slideIndex: number) => {
      if (requested.current.has(slideIndex)) return;
      void renderSlide(slideIndex);
    },
    [renderSlide]
  );

  return { renders, renderSlide, ensureRendered };
}
