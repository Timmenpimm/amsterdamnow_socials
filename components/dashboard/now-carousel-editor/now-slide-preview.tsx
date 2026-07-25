"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

import type { NowSlideRenderState } from "./types";

interface NowSlidePreviewProps {
  render: NowSlideRenderState | undefined;
  /** Template dimensions from the manifest — 1080x1350 for feed, 1080x1920 for stories. */
  dimensions: { width: number; height: number };
  onRetry: () => void;
}

/**
 * PNG preview of one NOW slide, in the template's own aspect ratio. Shows a
 * skeleton while rendering; on failure it shows the server's Dutch message
 * plus, for a 422, the exact validation problems — so a slide that can't be
 * rendered explains itself instead of blanking out the editor.
 */
export function NowSlidePreview({
  render,
  dimensions,
  onRetry,
}: NowSlidePreviewProps) {
  const aspectRatio = `${dimensions.width} / ${dimensions.height}`;

  if (render?.status === "ready" && render.dataUrl) {
    return (
      <div
        className="mx-auto w-full max-w-xs overflow-hidden rounded-lg border border-border bg-muted"
        style={{ aspectRatio }}
      >
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
      <div
        className="mx-auto flex w-full max-w-xs flex-col items-center justify-center gap-3 overflow-y-auto rounded-lg border border-dashed border-destructive/50 bg-destructive/5 px-4 py-6 text-center"
        style={{ aspectRatio }}
      >
        <AlertTriangle className="size-6 shrink-0 text-destructive" />
        <p className="text-sm text-destructive">{render.error}</p>
        {render.issues && render.issues.length > 0 && (
          <ul className="flex list-disc flex-col gap-1 pl-4 text-left text-xs text-destructive">
            {render.issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw />
          Opnieuw proberen
        </Button>
      </div>
    );
  }

  return (
    <Skeleton
      className="mx-auto w-full max-w-xs rounded-lg"
      style={{ aspectRatio }}
    />
  );
}
