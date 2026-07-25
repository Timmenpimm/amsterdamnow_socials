"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, RefreshCw, Save } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { NowStoredSlide } from "@/lib/now-carousel";
import {
  getNowTemplateSpec,
  type NowSlideType,
  type NowTemplateFamily,
} from "@/templates/now/manifest";

import { NowPlaceholderField } from "./now-placeholder-field";
import { NowSlidePreview } from "./now-slide-preview";
import type { NowSlideRenderState } from "./types";

interface NowSlideCardProps {
  slide: NowStoredSlide;
  family: NowTemplateFamily;
  position: number;
  render: NowSlideRenderState | undefined;
  isSaving: boolean;
  /** True once the carousel is PUBLISHING/PUBLISHED — a published carousel is never edited again. */
  readOnly: boolean;
  /** Called the first time this card scrolls into view, so previews render lazily. */
  onVisible: () => void;
  onRefreshPreview: () => void;
  onSave: (values: Record<string, string>) => Promise<boolean>;
}

/** Dutch labels for the slide types across all NOW families. */
const SLIDE_TYPE_LABEL: Record<string, string> = {
  cover: "Cover",
  detail: "Detail",
  statement: "Statement",
  cta: "Afsluiter",
  item: "Item",
  wat: "Wat is het",
  praktisch: "Praktisch",
  hook: "Hook",
  reason: "Waarom",
  practical: "Praktisch",
  link: "Linksticker",
  "editie-cover": "Editie-cover",
};

/**
 * One slide of a NOW carousel: its rendered PNG next to a form with exactly
 * the placeholders the template declares (templates/now/manifest.ts). The
 * preview only renders once the card is on screen — a full gids carousel is
 * ten headless-browser screenshots, which shouldn't all fire on page load.
 */
export function NowSlideCard({
  slide,
  family,
  position,
  render,
  isSaving,
  readOnly,
  onVisible,
  onRefreshPreview,
  onSave,
}: NowSlideCardProps) {
  const spec = getNowTemplateSpec(family, slide.slideType as NowSlideType);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [values, setValues] = useState<Record<string, string>>(slide.values);

  // Reset the form whenever the canonical slide content changes (initial
  // load or a successful save) — adjusting state during render per
  // https://react.dev/learn/you-might-not-need-an-effect.
  const signature = JSON.stringify(slide.values);
  const [prevSignature, setPrevSignature] = useState(signature);
  if (prevSignature !== signature) {
    setPrevSignature(signature);
    setValues(slide.values);
  }

  // Kept in a ref so the observer below is created once per card, even
  // though the parent passes a fresh closure on every render.
  const onVisibleRef = useRef(onVisible);
  useEffect(() => {
    onVisibleRef.current = onVisible;
  }, [onVisible]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    // No IntersectionObserver (old browser / jsdom): fall back to rendering
    // straight away rather than showing a skeleton forever.
    if (typeof IntersectionObserver === "undefined") {
      onVisibleRef.current();
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onVisibleRef.current();
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const isDirty = signature !== JSON.stringify(values);
  const editableFields = spec.placeholders.filter((placeholder) => !placeholder.zeroPadTo);

  return (
    <Card ref={containerRef}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>Slide {position}</CardTitle>
          <Badge variant="outline">
            {SLIDE_TYPE_LABEL[slide.slideType] ?? slide.slideType}
          </Badge>
        </div>
        <CardDescription>
          {spec.file} — {spec.dimensions.width}x{spec.dimensions.height} px
        </CardDescription>
      </CardHeader>

      <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <NowSlidePreview
          render={render}
          dimensions={spec.dimensions}
          onRetry={onRefreshPreview}
        />

        <div className="flex flex-col gap-4">
          {spec.placeholders.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Deze slide heeft geen invulvelden — het ontwerp staat vast.
            </p>
          )}
          {spec.placeholders.map((placeholder) => (
            <NowPlaceholderField
              key={placeholder.name}
              slideIndex={slide.index}
              spec={placeholder}
              value={values[placeholder.name] ?? ""}
              disabled={isSaving || readOnly}
              onChange={(value) =>
                setValues((prev) => ({ ...prev, [placeholder.name]: value }))
              }
            />
          ))}
        </div>
      </CardContent>

      <CardFooter className="flex flex-wrap gap-2">
        {!readOnly && editableFields.length > 0 && (
          <Button
            onClick={() => onSave(values)}
            disabled={isSaving || !isDirty}
          >
            {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
            Opslaan
          </Button>
        )}
        <Button
          variant="outline"
          onClick={onRefreshPreview}
          disabled={render?.status === "loading"}
        >
          {render?.status === "loading" ? (
            <Loader2 className="animate-spin" />
          ) : (
            <RefreshCw />
          )}
          Vernieuw preview
        </Button>
      </CardFooter>
    </Card>
  );
}
