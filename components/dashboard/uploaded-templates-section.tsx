"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  UploadedTemplatesCard,
  type UploadedTemplate,
} from "@/components/dashboard/uploaded-templates-card";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // ~5MB
const DEFAULT_WIDTH = "1080";
const DEFAULT_HEIGHT = "1350";

/**
 * Client-sectie voor eigen HTML-templates: uploadformulier + grid van
 * geüploade templates (GET/POST/DELETE /api/templates).
 */
export function UploadedTemplatesSection() {
  const [templates, setTemplates] = useState<UploadedTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/templates");
      const data = await response.json();
      if (!response.ok) {
        setLoadError(data?.error ?? "Templates laden mislukt. Probeer het opnieuw.");
        return;
      }
      setTemplates(Array.isArray(data?.templates) ? data.templates : []);
    } catch {
      setLoadError("Templates laden mislukt. Probeer het opnieuw.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = useCallback(async (id: string): Promise<string | null> => {
    try {
      const response = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        return data?.error ?? "Verwijderen mislukt. Probeer het opnieuw.";
      }
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      return null;
    } catch {
      return "Verwijderen mislukt. Probeer het opnieuw.";
    }
  }, []);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Eigen templates</h2>
        <p className="text-sm text-muted-foreground">
          Upload een HTML-bestand met {"{{placeholder}}"}-tokens om je eigen
          slide-ontwerp als template te gebruiken.
        </p>
      </div>

      <UploadForm
        onUploaded={(template) => setTemplates((prev) => [template, ...prev])}
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="aspect-[3/4] w-full" />
          ))}
        </div>
      ) : loadError ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-3 pt-6">
            <p role="alert" className="text-sm text-destructive">
              {loadError}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={load}>
              Opnieuw proberen
            </Button>
          </CardContent>
        </Card>
      ) : templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nog geen eigen templates geüpload.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <UploadedTemplatesCard
              key={template.id}
              template={template}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface UploadFormProps {
  onUploaded: (template: UploadedTemplate) => void;
}

function UploadForm({ onUploaded }: UploadFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [html, setHtml] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setUploadError(null);
    setUploaded(false);

    const file = event.target.files?.[0];
    if (!file) {
      setHtml(null);
      setFileName(null);
      return;
    }

    if (!/\.html?$/i.test(file.name)) {
      setHtml(null);
      setFileName(null);
      setUploadError("Alleen .html- of .htm-bestanden zijn toegestaan.");
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      setHtml(null);
      setFileName(null);
      setUploadError("Bestand is te groot: maximaal 5 MB per template.");
      return;
    }

    try {
      const text = await file.text();
      setHtml(text);
      setFileName(file.name);
      setName((prev) => (prev.trim() ? prev : file.name.replace(/\.html?$/i, "")));
    } catch {
      setHtml(null);
      setFileName(null);
      setUploadError("Bestand lezen mislukt. Probeer het opnieuw.");
    }
  }

  function resetForm() {
    setHtml(null);
    setFileName(null);
    setName("");
    setDescription("");
    setWidth(DEFAULT_WIDTH);
    setHeight(DEFAULT_HEIGHT);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploadError(null);
    setUploaded(false);

    if (!html) {
      setUploadError("Kies eerst een HTML-bestand.");
      return;
    }
    if (!name.trim()) {
      setUploadError("Geef de template een naam.");
      return;
    }

    const parsedWidth = Number.parseInt(width, 10);
    const parsedHeight = Number.parseInt(height, 10);

    setUploading(true);
    try {
      const response = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          html,
          width: Number.isFinite(parsedWidth) && parsedWidth > 0 ? parsedWidth : undefined,
          height: Number.isFinite(parsedHeight) && parsedHeight > 0 ? parsedHeight : undefined,
        }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok || !data?.template) {
        const issues = Array.isArray(data?.issues)
          ? data.issues
              .map((issue: { message?: string }) => issue?.message)
              .filter(Boolean)
              .join(" ")
          : "";
        setUploadError(
          [data?.error ?? "Uploaden mislukt. Probeer het opnieuw.", issues]
            .filter(Boolean)
            .join(" ")
        );
        return;
      }

      onUploaded(data.template as UploadedTemplate);
      resetForm();
      setUploaded(true);
    } catch {
      setUploadError("Uploaden mislukt. Probeer het opnieuw.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Template uploaden</CardTitle>
        <CardDescription>
          Placeholders zoals {"{{titel}}"} worden automatisch herkend na het
          uploaden.
        </CardDescription>
      </CardHeader>

      <form onSubmit={handleSubmit}>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="template-file">HTML-bestand</Label>
            <Input
              id="template-file"
              ref={fileInputRef}
              type="file"
              accept=".html,.htm"
              onChange={handleFileChange}
            />
            {fileName && (
              <p className="text-xs text-muted-foreground">
                Geselecteerd: {fileName}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="template-name">Naam</Label>
            <Input
              id="template-name"
              value={name}
              placeholder="Bijv. Hotspot cover donker"
              onChange={(event) => {
                setUploaded(false);
                setName(event.target.value);
              }}
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="template-description">Omschrijving (optioneel)</Label>
            <Textarea
              id="template-description"
              value={description}
              rows={2}
              placeholder="Waar gebruik je deze template voor?"
              onChange={(event) => {
                setUploaded(false);
                setDescription(event.target.value);
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="template-width">Breedte (px)</Label>
              <Input
                id="template-width"
                type="number"
                min={1}
                value={width}
                onChange={(event) => {
                  setUploaded(false);
                  setWidth(event.target.value);
                }}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="template-height">Hoogte (px)</Label>
              <Input
                id="template-height"
                type="number"
                min={1}
                value={height}
                onChange={(event) => {
                  setUploaded(false);
                  setHeight(event.target.value);
                }}
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Standaard 1080 × 1350 (feed). Voor event-/story-formaat gebruik je
            1080 × 1920.
          </p>

          {uploadError && (
            <p role="alert" className="text-sm text-destructive">
              {uploadError}
            </p>
          )}
          {uploaded && !uploadError && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">
              Template geüpload.
            </p>
          )}
        </CardContent>

        <CardFooter>
          <Button type="submit" disabled={uploading}>
            {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
            Uploaden
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
