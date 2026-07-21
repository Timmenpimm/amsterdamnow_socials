"use client";

import { AlertTriangle } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Slide } from "@/types/carousel";

import type { SlideRenderState } from "./types";

interface SlideStripProps {
  slides: Slide[];
  renders: Record<number, SlideRenderState>;
  selectedIndex: number;
  onSelect: (index: number) => void;
}

/**
 * Horizontal strip of slide thumbnails. Each thumbnail reflects its own
 * render status independently (skeleton while loading, warning icon on
 * error) so one failing slide never blocks the rest of the strip.
 */
export function SlideStrip({
  slides,
  renders,
  selectedIndex,
  onSelect,
}: SlideStripProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2">
      {slides.map((slide) => {
        const render = renders[slide.index];
        const isSelected = slide.index === selectedIndex;

        return (
          <button
            key={slide.index}
            type="button"
            onClick={() => onSelect(slide.index)}
            className={cn(
              "relative aspect-[4/5] w-24 shrink-0 overflow-hidden rounded-md border-2 bg-muted transition-colors",
              isSelected ? "border-primary" : "border-transparent hover:border-border"
            )}
          >
            {render?.status === "ready" && render.dataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={render.dataUrl}
                alt={`Slide ${slide.index + 1}`}
                className="size-full object-cover"
              />
            ) : render?.status === "error" ? (
              <div className="flex size-full items-center justify-center bg-destructive/10">
                <AlertTriangle className="size-5 text-destructive" />
              </div>
            ) : (
              <Skeleton className="size-full rounded-none" />
            )}

            <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 text-[10px] font-medium text-white">
              {slide.index + 1}
            </span>
          </button>
        );
      })}
    </div>
  );
}
