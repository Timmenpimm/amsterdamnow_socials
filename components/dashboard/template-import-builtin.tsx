"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { UploadedTemplate } from "@/components/dashboard/uploaded-templates-card";
import {
  extractApiError,
  FormAlert,
  SuccessNote,
  type TemplateImportModeProps,
} from "@/components/dashboard/template-import-shared";

/**
 * Modus "Ingebouwd": zet de meegeleverde NOW-slides om in bewerkbare eigen
 * templates. De backend slaat bestaande namen over, dus nogmaals klikken
 * maakt geen dubbele templates aan.
 */
export function TemplateImportBuiltin({ onImported }: TemplateImportModeProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]);

  async function handleImport() {
    setError(null);
    setSummary(null);
    setSkipped([]);
    setSubmitting(true);

    try {
      const response = await fetch("/api/templates/import/builtin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          extractApiError(data, "Importeren mislukt. Probeer het opnieuw.")
        );
        return;
      }

      const imported: UploadedTemplate[] = Array.isArray(data?.imported)
        ? data.imported
        : [];
      const skippedNames: string[] = Array.isArray(data?.skipped)
        ? data.skipped.filter(
            (item: unknown): item is string => typeof item === "string"
          )
        : [];

      if (imported.length > 0) onImported(imported);
      setSkipped(skippedNames);
      setSummary(
        skippedNames.length > 0
          ? `${imported.length} geïmporteerd, ${skippedNames.length} overgeslagen (bestonden al).`
          : `${imported.length} geïmporteerd.`
      );
    } catch {
      setError("Importeren mislukt. Probeer het opnieuw.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Zet de meegeleverde Amsterdam NOW-slides om in eigen templates, zodat je
        ze kunt aanpassen en met eigen {"{{placeholders}}"} kunt vullen.
        Templates die je al hebt, worden overgeslagen.
      </p>

      {error && <FormAlert>{error}</FormAlert>}
      {summary && !error && <SuccessNote>{summary}</SuccessNote>}

      {skipped.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Overgeslagen: {skipped.join(", ")}.
        </p>
      )}

      <div>
        <Button type="button" disabled={submitting} onClick={handleImport}>
          {submitting ? <Loader2 className="animate-spin" /> : <Sparkles />}
          NOW-templates importeren
        </Button>
      </div>
    </div>
  );
}
