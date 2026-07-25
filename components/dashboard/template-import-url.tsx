"use client";

import { useState, type FormEvent } from "react";
import { Link2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UploadedTemplate } from "@/components/dashboard/uploaded-templates-card";
import {
  extractApiError,
  FormAlert,
  SuccessNote,
  WarningNote,
  type TemplateImportModeProps,
} from "@/components/dashboard/template-import-shared";

/**
 * Modus "Link": de backend haalt de HTML zelf op (bijv. een gepubliceerde
 * Claude Design-pagina) en levert naast de template ook waarschuwingen op,
 * bijvoorbeeld over externe assets die niet meegenomen konden worden.
 */
export function TemplateImportUrl({ onImported }: TemplateImportModeProps) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSummary(null);
    setWarnings([]);

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError("Vul de URL van de template in.");
      return;
    }
    if (!/^https?:\/\//i.test(trimmedUrl)) {
      setError("Vul een geldige URL in die begint met https://.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/templates/import/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: trimmedUrl,
          name: name.trim() || undefined,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.template) {
        setError(
          extractApiError(data, "Importeren mislukt. Probeer het opnieuw.")
        );
        return;
      }

      onImported([data.template as UploadedTemplate]);
      setWarnings(
        Array.isArray(data?.warnings)
          ? data.warnings.filter(
              (warning: unknown): warning is string =>
                typeof warning === "string"
            )
          : []
      );
      setSummary(
        typeof data?.sourceUrl === "string"
          ? `Template geïmporteerd van ${data.sourceUrl}.`
          : "Template geïmporteerd."
      );
      setUrl("");
      setName("");
    } catch {
      setError("Importeren mislukt. Probeer het opnieuw.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="import-url">URL</Label>
        <Input
          id="import-url"
          type="url"
          inputMode="url"
          value={url}
          placeholder="https://..."
          onChange={(event) => {
            setSummary(null);
            setUrl(event.target.value);
          }}
        />
        <p className="text-xs text-muted-foreground">
          Plak de link naar de gepubliceerde HTML-pagina. Breedte en hoogte
          worden uit de CSS gehaald.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="import-url-name">Naam (optioneel)</Label>
        <Input
          id="import-url-name"
          value={name}
          placeholder="Leeg laten? Dan bepaalt de engine de naam."
          onChange={(event) => {
            setSummary(null);
            setName(event.target.value);
          }}
        />
      </div>

      {error && <FormAlert>{error}</FormAlert>}
      {summary && !error && <SuccessNote>{summary}</SuccessNote>}
      <WarningNote warnings={warnings} />

      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : <Link2 />}
          Ophalen en importeren
        </Button>
      </div>
    </form>
  );
}
