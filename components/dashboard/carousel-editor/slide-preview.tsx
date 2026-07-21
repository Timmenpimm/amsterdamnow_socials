"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import type { SlideRenderState } from "./types";

interface SlidePreviewProps {
  render: SlideRenderState | undefined;
  onRetry: () => void;
}

/**
 * Large preview of the currently selected slide's rendered PNG. Shows a
 * skeleton while (re-)rendering and a scoped retry button on failure, so a
 * broken render never takes down the rest of the editor.
 */
export function SlidePreview({ render, onRetry }: SlidePreviewProps) {
  if (render?.status === "ready" && render.dataUrl) {
    return (
      <div className="mx-auto aspect-[4/5] w-full max-w-sm overflow-hidden rounded-lg border border-border bg-muted">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={render.dataUrl}
          alt="Slide preview"
          className="size-full object-cover"
        />
      </div>
    );
  }

  if (render?.status === "error") {
    return (
      <div className="mx-auto flex aspect-[4/5] w-full max-w-sm flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-destructive/50 bg-destructive/5 px-6 text-center">
        <AlertTriangle className="size-6 text-destructive" />
        <p className="text-sm text-destructive">{render.error}</p>
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw />
          Opnieuw proberen
        </Button>
      </div>
    );
  }

  return (
    <Skeleton className="mx-auto aspect-[4/5] w-full max-w-sm rounded-lg" />
  );
}
