"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TemplateImportPanel } from "@/components/dashboard/template-import-panel";
import {
  UploadedTemplatesCard,
  type UploadedTemplate,
} from "@/components/dashboard/uploaded-templates-card";

/**
 * Client-sectie voor eigen HTML-templates: importpaneel (bestanden, plakken,
 * link, ingebouwd) + grid van geïmporteerde templates
 * (GET/POST/DELETE /api/templates).
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

  /** Nieuwe imports komen vooraan; geen refetch nodig. */
  const handleImported = useCallback((imported: UploadedTemplate[]) => {
    if (imported.length === 0) return;
    setTemplates((prev) => {
      const ids = new Set(imported.map((template) => template.id));
      return [...imported, ...prev.filter((template) => !ids.has(template.id))];
    });
  }, []);

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
          Importeer HTML-templates met {"{{placeholder}}"}-tokens om je eigen
          slide-ontwerpen als template te gebruiken.
        </p>
      </div>

      <TemplateImportPanel onImported={handleImported} />

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
          Nog geen eigen templates geïmporteerd.
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
