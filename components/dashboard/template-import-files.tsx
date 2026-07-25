"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { FileUp, Loader2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UploadedTemplate } from "@/components/dashboard/uploaded-templates-card";
import {
  extractApiError,
  formatFileSize,
  FormAlert,
  MAX_FILE_BYTES,
  MAX_IMPORT_FILES,
  SuccessNote,
  templateCountLabel,
  type ImportFailure,
  type TemplateImportModeProps,
} from "@/components/dashboard/template-import-shared";

/**
 * Modus "Bestanden": meerdere .html-bestanden tegelijk kiezen en in één
 * POST /api/templates/batch wegschrijven. Afmetingen worden door de backend
 * uit de CSS gehaald, dus geen breedte/hoogte-velden hier.
 */
export function TemplateImportFiles({ onImported }: TemplateImportModeProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [failures, setFailures] = useState<ImportFailure[]>([]);

  function handleFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? []);
    // Input direct legen zodat hetzelfde bestand opnieuw gekozen kan worden.
    if (inputRef.current) inputRef.current.value = "";
    if (picked.length === 0) return;

    setSummary(null);
    setFailures([]);

    const merged = [...files];
    const rejected: string[] = [];

    for (const file of picked) {
      if (!/\.html?$/i.test(file.name)) {
        rejected.push(`${file.name} (alleen .html- of .htm-bestanden)`);
        continue;
      }
      if (file.size > MAX_FILE_BYTES) {
        rejected.push(`${file.name} (groter dan 5 MB)`);
        continue;
      }
      if (merged.some((f) => f.name === file.name && f.size === file.size)) {
        continue;
      }
      if (merged.length >= MAX_IMPORT_FILES) {
        rejected.push(
          `${file.name} (maximaal ${MAX_IMPORT_FILES} bestanden per import)`
        );
        continue;
      }
      merged.push(file);
    }

    setFiles(merged);
    setError(
      rejected.length > 0 ? `Overgeslagen: ${rejected.join(", ")}.` : null
    );
  }

  function removeFile(index: number) {
    setError(null);
    setSummary(null);
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSummary(null);
    setFailures([]);

    if (files.length === 0) {
      setError("Kies eerst één of meer HTML-bestanden.");
      return;
    }

    setSubmitting(true);
    try {
      const items = await Promise.all(
        files.map(async (file) => ({
          name: file.name.replace(/\.html?$/i, ""),
          html: await file.text(),
        }))
      );

      const response = await fetch("/api/templates/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(
          extractApiError(data, "Importeren mislukt. Probeer het opnieuw.")
        );
        return;
      }

      const created: UploadedTemplate[] = Array.isArray(data?.created)
        ? data.created
        : [];
      const failed: ImportFailure[] = Array.isArray(data?.failed)
        ? data.failed
        : [];

      if (created.length > 0) onImported(created);
      setFailures(failed);
      setSummary(
        failed.length > 0
          ? `${templateCountLabel(created.length)} geïmporteerd, ${failed.length} mislukt.`
          : `${templateCountLabel(created.length)} geïmporteerd.`
      );
      setFiles([]);
    } catch {
      setError("Importeren mislukt. Probeer het opnieuw.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="import-files">HTML-bestanden</Label>
        <Input
          id="import-files"
          ref={inputRef}
          type="file"
          multiple
          accept=".html,.htm"
          onChange={handleFilesChange}
        />
        <p className="text-xs text-muted-foreground">
          Maximaal {MAX_IMPORT_FILES} bestanden, 5 MB per bestand. De naam komt
          uit de bestandsnaam; breedte en hoogte haalt de engine uit de CSS.
        </p>
      </div>

      {files.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-md border border-border p-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center gap-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate" title={file.name}>
                {file.name}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatFileSize(file.size)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7 shrink-0"
                aria-label={`${file.name} uit de selectie halen`}
                disabled={submitting}
                onClick={() => removeFile(index)}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      {error && <FormAlert>{error}</FormAlert>}

      {summary && !error && <SuccessNote>{summary}</SuccessNote>}

      {failures.length > 0 && (
        <div className="flex flex-col gap-1 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="font-medium text-destructive">Niet geïmporteerd:</p>
          <ul className="flex flex-col gap-0.5">
            {failures.map((failure) => (
              <li key={`${failure.index}-${failure.name}`}>
                <span className="font-medium">{failure.name}</span> —{" "}
                <span className="text-muted-foreground">{failure.error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <Button type="submit" disabled={submitting || files.length === 0}>
          {submitting ? <Loader2 className="animate-spin" /> : <FileUp />}
          {files.length > 0
            ? `${templateCountLabel(files.length)} importeren`
            : "Importeren"}
        </Button>
      </div>
    </form>
  );
}
