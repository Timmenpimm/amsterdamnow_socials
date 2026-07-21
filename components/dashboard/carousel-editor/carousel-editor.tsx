"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Toaster } from "sonner";

import { CarouselStatusBadge } from "@/components/dashboard/carousel-status-badge";
import { TemplateSelect } from "@/components/dashboard/template-select";

import { CaptionHashtagsForm } from "./caption-hashtags-form";
import { CarouselActions } from "./carousel-actions";
import { SlideEditForm } from "./slide-edit-form";
import { SlidePreview } from "./slide-preview";
import { SlideStrip } from "./slide-strip";
import { useCarouselEditor } from "./use-carousel-editor";
import type { EditorArticle, EditorCarousel } from "./types";

interface CarouselEditorProps {
  initial: EditorCarousel;
  article: EditorArticle;
}

/**
 * Orchestrates the Phase 5 preview editor: wires useCarouselEditor's state
 * and mutations into the small presentational pieces in this folder. Mounts
 * the single <Toaster/> for this route — leaf components just call
 * sonner's toast() directly.
 */
export function CarouselEditor({ initial, article }: CarouselEditorProps) {
  const {
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
  } = useCarouselEditor(initial);

  const selectedSlide =
    carousel.slides.find((slide) => slide.index === selectedIndex) ??
    carousel.slides[0];

  return (
    <div className="flex flex-1 flex-col gap-6 px-6 py-8 sm:px-8">
      <Toaster richColors position="top-right" />

      <div className="flex flex-col gap-4">
        <Link
          href="/dashboard/carousels"
          className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Terug naar carousels
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold">{article.title}</h1>
            <div className="flex items-center gap-2">
              <CarouselStatusBadge status={carousel.status} />
              <span className="text-sm text-muted-foreground">
                {carousel.slides.length} slides
              </span>
            </div>
          </div>

          <TemplateSelect
            value={carousel.template}
            onSelect={switchTemplate}
            disabled={isSwitchingTemplate}
          />
        </div>
      </div>

      <SlideStrip
        slides={carousel.slides}
        renders={renders}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
      />

      {selectedSlide && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <SlidePreview
            render={renders[selectedSlide.index]}
            onRetry={() => renderSlide(selectedSlide.index)}
          />
          <SlideEditForm
            key={selectedSlide.index}
            slide={selectedSlide}
            isSaving={isSavingSlide}
            isRegenerating={isRegeneratingSlide}
            onSave={(patch) => saveSlideContent(selectedSlide.index, patch)}
            onRegenerate={() => regenerateSlideWithAi(selectedSlide.index)}
          />
        </div>
      )}

      <CaptionHashtagsForm
        caption={carousel.caption}
        hashtags={carousel.hashtags}
        isSaving={isSavingMeta}
        onSave={saveCaptionAndHashtags}
      />

      <CarouselActions
        status={carousel.status}
        isUpdatingStatus={isUpdatingStatus}
        isDeleting={isDeleting}
        onSetStatus={setStatus}
        onDelete={deleteCarousel}
      />
    </div>
  );
}
