"use client";

import { useState } from "react";
import { Loader2, Save, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Slide } from "@/types/carousel";

interface SlideEditFormProps {
  slide: Slide;
  isSaving: boolean;
  isRegenerating: boolean;
  /** True once the carousel is PUBLISHING/PUBLISHED — a published carousel is never edited again. */
  readOnly?: boolean;
  onSave: (
    patch: Pick<Slide, "headline" | "body" | "imagePrompt">
  ) => Promise<boolean>;
  onRegenerate: () => void;
}

/**
 * Headline/body/imagePrompt editor for the currently selected slide, plus
 * the "regenerate with AI" action. Local field state is reset whenever the
 * underlying slide content changes (initial load, a save, or an AI
 * regeneration all replace it with the canonical server value).
 */
export function SlideEditForm({
  slide,
  isSaving,
  isRegenerating,
  readOnly = false,
  onSave,
  onRegenerate,
}: SlideEditFormProps) {
  const [headline, setHeadline] = useState(slide.headline);
  const [body, setBody] = useState(slide.body ?? "");
  const [imagePrompt, setImagePrompt] = useState(slide.imagePrompt ?? "");

  // Reset the form whenever the canonical slide content changes (a new
  // selection, a successful save, or an AI regeneration) — adjusting state
  // during render per https://react.dev/learn/you-might-not-need-an-effect,
  // rather than in a useEffect that would cause an extra render.
  const slideSignature = `${slide.index}:${slide.headline}:${slide.body ?? ""}:${slide.imagePrompt ?? ""}`;
  const [prevSignature, setPrevSignature] = useState(slideSignature);
  if (prevSignature !== slideSignature) {
    setPrevSignature(slideSignature);
    setHeadline(slide.headline);
    setBody(slide.body ?? "");
    setImagePrompt(slide.imagePrompt ?? "");
  }

  const busy = isSaving || isRegenerating || readOnly;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor={`headline-${slide.index}`}>Kop</Label>
        <Textarea
          id={`headline-${slide.index}`}
          value={headline}
          onChange={(event) => setHeadline(event.target.value)}
          disabled={busy}
          rows={2}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`body-${slide.index}`}>Tekst</Label>
        <Textarea
          id={`body-${slide.index}`}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          disabled={busy}
          rows={4}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`image-prompt-${slide.index}`}>Beeldprompt</Label>
        <Textarea
          id={`image-prompt-${slide.index}`}
          value={imagePrompt}
          onChange={(event) => setImagePrompt(event.target.value)}
          disabled={busy}
          rows={3}
        />
      </div>

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() =>
              onSave({
                headline,
                body: body.trim() || undefined,
                imagePrompt: imagePrompt.trim() || undefined,
              })
            }
            disabled={busy || headline.trim().length === 0}
          >
            {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
            Opslaan
          </Button>
          <Button variant="outline" onClick={onRegenerate} disabled={busy}>
            {isRegenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Regenereer met AI
          </Button>
        </div>
      )}
    </div>
  );
}
