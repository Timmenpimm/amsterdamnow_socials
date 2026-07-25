"use client";

import { useState, type FormEvent } from "react";
import { ClipboardPaste, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { UploadedTemplate } from "@/components/dashboard/uploaded-templates-card";
import {
  extractApiError,
  FormAlert,
  SuccessNote,
  type TemplateImportModeProps,
} from "@/components/dashboard/template-import-shared";

const DEFAULT_WIDTH = "1080";
const DEFAULT_HEIGHT = "1350";
const FALLBACK_NAME = "Geplakte template";

/** Naam uit de <title> van de geplakte HTML, anders een vaste fallback. */
function deriveNameFromHtml(html: string): string {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = match?.[1]?.replace(/\s+/g, " ").trim();
  return title || FALLBACK_NAME;
}

/**
 * Modus "Plakken": HTML rechtstreeks uit Claude Design plakken. Dit is de
 * enige modus met handmatige breedte/hoogte, omdat er geen bestand of bron-URL
 * is waar de engine het formaat uit kan afleiden.
 */
export function TemplateImportPaste({ onImported }: TemplateImportModeProps) {
  const [html, setHtml] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  function reset() {
    setHtml("");
    setName("");
    setDescription("");
    setWidth(DEFAULT_WIDTH);
    setHeight(DEFAULT_HEIGHT);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSummary(null);

    if (!html.trim()) {
      setError("Plak eerst de HTML van je template.");
      return;
    }

    const finalName = name.trim() || deriveNameFromHtml(html);
    const parsedWidth = Number.parseInt(width, 10);
    const parsedHeight = Number.parseInt(height, 10);

    setSubmitting(true);
    try {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: finalName,
          description: description.trim() || undefined,
          html,
          width:
            Number.isFinite(parsedWidth) && parsedWidth > 0
              ? parsedWidth
              : undefined,
          height:
            Number.isFinite(parsedHeight) && parsedHeight > 0
              ? parsedHeight
              : undefined,
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
      reset();
      setSummary(`Template “${finalName}” geïmporteerd.`);
    } catch {
      setError("Importeren mislukt. Probeer het opnieuw.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="import-paste-html">HTML</Label>
        <Textarea
          id="import-paste-html"
          value={html}
          rows={10}
          className="font-mono text-xs"
          placeholder="Plak hier de HTML uit Claude Design"
          onChange={(event) => {
            setSummary(null);
            setHtml(event.target.value);
          }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="import-paste-name">Naam (optioneel)</Label>
        <Input
          id="import-paste-name"
          value={name}
          placeholder="Leeg laten? Dan pakken we de <title> uit de HTML."
          onChange={(event) => {
            setSummary(null);
            setName(event.target.value);
          }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="import-paste-description">
          Omschrijving (optioneel)
        </Label>
        <Textarea
          id="import-paste-description"
          value={description}
          rows={2}
          placeholder="Waar gebruik je deze template voor?"
          onChange={(event) => {
            setSummary(null);
            setDescription(event.target.value);
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="import-paste-width">Breedte (px)</Label>
          <Input
            id="import-paste-width"
            type="number"
            min={1}
            value={width}
            onChange={(event) => {
              setSummary(null);
              setWidth(event.target.value);
            }}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="import-paste-height">Hoogte (px)</Label>
          <Input
            id="import-paste-height"
            type="number"
            min={1}
            value={height}
            onChange={(event) => {
              setSummary(null);
              setHeight(event.target.value);
            }}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Standaard 1080 × 1350 (feed). Event-formaat = 1080 × 1920.
      </p>

      {error && <FormAlert>{error}</FormAlert>}
      {summary && !error && <SuccessNote>{summary}</SuccessNote>}

      <div>
        <Button type="submit" disabled={submitting}>
          {submitting ? <Loader2 className="animate-spin" /> : <ClipboardPaste />}
          Template opslaan
        </Button>
      </div>
    </form>
  );
}
