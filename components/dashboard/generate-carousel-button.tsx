"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { TemplateSelect } from "@/components/dashboard/template-select";
import { TEMPLATE_METADATA_LIST } from "@/lib/template-metadata";
import type { TemplateId } from "@/templates";

interface GenerateCarouselButtonProps {
  articleId: string;
}

interface GenerateSuccessResponse {
  carousel: { id: string };
}

interface GenerateErrorResponse {
  error: string;
}

/**
 * Per-article-row action: pick one of the satori templates, POST
 * /api/generate, then navigate straight into the new carousel's editor on
 * success. Relies on a <Toaster/> already mounted elsewhere on the posts
 * page (see components/dashboard/posts-import-button.tsx) rather than
 * mounting its own — this button renders once per table row, and multiple
 * <Toaster/> instances on one page would duplicate every toast.
 */
export function GenerateCarouselButton({
  articleId,
}: GenerateCarouselButtonProps) {
  const router = useRouter();
  const [template, setTemplate] = useState<TemplateId>(
    TEMPLATE_METADATA_LIST[0].id
  );
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleGenerate() {
    setIsGenerating(true);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId, template }),
      });

      const data = (await response.json()) as
        | GenerateSuccessResponse
        | GenerateErrorResponse;

      if (!response.ok) {
        const message =
          "error" in data
            ? response.status === 503
              ? `AI-generatie is niet beschikbaar: ${data.error}`
              : data.error
            : "Genereren van de carousel is mislukt.";
        toast.error(message);
        return;
      }

      const result = data as GenerateSuccessResponse;
      toast.success("Carousel gegenereerd.");
      router.push(`/dashboard/carousels/${result.carousel.id}`);
    } catch {
      toast.error("Kon geen verbinding maken met de server.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="flex items-center justify-end gap-2">
      <TemplateSelect value={template} onSelect={setTemplate} disabled={isGenerating} />
      <Button size="sm" onClick={handleGenerate} disabled={isGenerating}>
        {isGenerating ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Sparkles />
        )}
        Genereer carousel
      </Button>
    </div>
  );
}
