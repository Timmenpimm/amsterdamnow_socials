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
import { useCarouselPublish } from "./use-carousel-publish";
import type { EditorArticle, EditorCarousel } from "./types";

interface CarouselEditorProps {
  initial: EditorCarousel;
  article: EditorArticle;
  /** The connected Instagram account's @handle, if any — for the "view on Instagram" fallback link. */
  instagramUsername: string | null;
}

/**
 * Orchestrates the carousel editor: wires useCarouselEditor's (Phase 5)
 * and useCarouselPublish's (Phase 6) state and mutations into the small
 * presentational pieces in this folder, and locks editing once the
 * carousel is PUBLISHING/PUBLISHED. Mounts the single <Toaster/> for this
 * route — leaf components just call sonner's toast() directly.
 */
export function CarouselEditor({
  initial,
  article,
  instagramUsername,
}: CarouselEditorProps) {
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
    applyPublishUpdate,
    deleteCarousel,
    isSwitchingTemplate,
    isSavingMeta,
    isSavingSlide,
    isRegeneratingSlide,
    isUpdatingStatus,
    isDeleting,
  } = useCarouselEditor(initial);

  const { publish, isPublishing, permalink } = useCarouselPublish(
    carousel.id,
    initial.status,
    applyPublishUpdate
  );

  const selectedSlide =
    carousel.slides.find((slide) => slide.index === selectedIndex) ??
    carousel.slides[0];

  // A published (or currently publishing) carousel is never edited again.
  const readOnly = carousel.status === "PUBLISHING" || carousel.status === "PUBLISHED";

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
            disabled={isSwitchingTemplate || readOnly}
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
            readOnly={readOnly}
            onSave={(patch) => saveSlideContent(selectedSlide.index, patch)}
            onRegenerate={() => regenerateSlideWithAi(selectedSlide.index)}
          />
        </div>
      )}

      <CaptionHashtagsForm
        caption={carousel.caption}
        hashtags={carousel.hashtags}
        isSaving={isSavingMeta}
        readOnly={readOnly}
        onSave={saveCaptionAndHashtags}
      />

      <CarouselActions
        status={carousel.status}
        instagramUsername={instagramUsername}
        permalink={permalink}
        isUpdatingStatus={isUpdatingStatus}
        isDeleting={isDeleting}
        isPublishing={isPublishing}
        onSetStatus={setStatus}
        onDelete={deleteCarousel}
        onPublish={() => publish(carousel.status)}
      />
    </div>
  );
}
