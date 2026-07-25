"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Toaster } from "sonner";

import { CaptionHashtagsForm } from "@/components/dashboard/carousel-editor/caption-hashtags-form";
import { CarouselActions } from "@/components/dashboard/carousel-editor/carousel-actions";
import { useCarouselPublish } from "@/components/dashboard/carousel-editor/use-carousel-publish";
import { CarouselStatusBadge } from "@/components/dashboard/carousel-status-badge";
import { Badge } from "@/components/ui/badge";
import { getNowFamilyPlan } from "@/lib/now-carousel";

import { NowSlideCard } from "./now-slide-card";
import { useNowCarouselEditor } from "./use-now-carousel-editor";
import type { NowEditorArticle, NowEditorCarousel } from "./types";

interface NowCarouselEditorProps {
  initial: NowEditorCarousel;
  article: NowEditorArticle;
  /** The connected Instagram account's @handle, if any — for the "view on Instagram" fallback link. */
  instagramUsername: string | null;
}

/**
 * Editor for Amsterdam NOW carousels (`now:<family>`). Same shell and same
 * publishing flow as the satori editor — it reuses CaptionHashtagsForm,
 * CarouselActions and useCarouselPublish verbatim, since none of those care
 * about the slide shape. What differs is the middle: one card per slide with
 * a form generated from the template manifest, instead of a slide strip with
 * a single headline/body form.
 */
export function NowCarouselEditor({
  initial,
  article,
  instagramUsername,
}: NowCarouselEditorProps) {
  const {
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
  } = useNowCarouselEditor(initial);

  const { publish, isPublishing, permalink } = useCarouselPublish(
    carousel.id,
    initial.status,
    applyPublishUpdate
  );

  const plan = getNowFamilyPlan(carousel.family);

  // A published (or currently publishing) carousel is never edited again.
  const readOnly =
    carousel.status === "PUBLISHING" || carousel.status === "PUBLISHED";

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

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">{article.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <CarouselStatusBadge status={carousel.status} />
            <Badge variant="outline">Amsterdam NOW — {plan.label}</Badge>
            <span className="text-sm text-muted-foreground">
              {carousel.slides.length} slides
            </span>
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {plan.purpose}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {carousel.slides.map((slide, position) => (
          <NowSlideCard
            key={slide.index}
            slide={slide}
            family={carousel.family}
            position={position + 1}
            render={renders[slide.index]}
            isSaving={savingIndex === slide.index}
            readOnly={readOnly}
            onVisible={() => ensureRendered(slide.index)}
            onRefreshPreview={() => void renderSlide(slide.index)}
            onSave={(values) => saveSlideValues(slide.index, values)}
          />
        ))}
      </div>

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
