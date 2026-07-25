"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** DTO zoals GET /api/templates hem teruggeeft. */
export interface UploadedTemplate {
  id: string;
  name: string;
  description: string | null;
  width: number;
  height: number;
  placeholders: string[];
  createdAt: string;
}

interface UploadedTemplatesCardProps {
  template: UploadedTemplate;
  /** Voert de DELETE uit; geeft een foutmelding terug, of null bij succes. */
  onDelete: (id: string) => Promise<string | null>;
}

/**
 * Kaart voor één geüploade template: geschaalde iframe-preview, metadata en
 * een tweestaps verwijderknop (geen dialog-primitive beschikbaar in dit
 * project, dus inline bevestigen — zelfde aanpak als template-select.tsx:
 * hand-rolled i.p.v. extra shadcn-dependencies).
 */
export function UploadedTemplatesCard({
  template,
  onDelete,
}: UploadedTemplatesCardProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Bevestigingsstand vervalt vanzelf weer na een paar seconden.
  useEffect(() => {
    if (!confirming) return;
    const timeout = setTimeout(() => setConfirming(false), 4000);
    return () => clearTimeout(timeout);
  }, [confirming]);

  async function handleDeleteClick() {
    if (!confirming) {
      setDeleteError(null);
      setConfirming(true);
      return;
    }

    setConfirming(false);
    setDeleting(true);
    setDeleteError(null);
    const error = await onDelete(template.id);
    if (error) {
      setDeleteError(error);
      setDeleting(false);
    }
    // Bij succes haalt de parent deze kaart uit de lijst; geen state-reset nodig.
  }

  const createdAt = new Date(template.createdAt);
  const createdAtLabel = Number.isNaN(createdAt.getTime())
    ? null
    : createdAt.toLocaleDateString("nl-NL", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="min-w-0 truncate" title={template.name}>
            {template.name}
          </CardTitle>
          {template.placeholders.length === 0 ? (
            // Import zonder tokens: dan valt er nog niets te vullen.
            <Badge
              variant="outline"
              className="shrink-0 text-muted-foreground"
              title="Voeg {{tokens}} toe om deze template te kunnen vullen"
            >
              Geen placeholders
            </Badge>
          ) : (
            <Badge variant="secondary" className="shrink-0">
              {template.placeholders.length}{" "}
              {template.placeholders.length === 1
                ? "placeholder"
                : "placeholders"}
            </Badge>
          )}
        </div>
        {template.description && (
          <p className="text-sm text-muted-foreground">{template.description}</p>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <ScaledTemplatePreview
          id={template.id}
          name={template.name}
          width={template.width}
          height={template.height}
        />

        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <span>
            {template.width} × {template.height} px
            {createdAtLabel && <> · geüpload op {createdAtLabel}</>}
          </span>
          {template.placeholders.length > 0 && (
            <span
              className="truncate font-mono"
              title={template.placeholders.map((p) => `{{${p}}}`).join(", ")}
            >
              {template.placeholders.map((p) => `{{${p}}}`).join(", ")}
            </span>
          )}
        </div>

        {deleteError && (
          <p role="alert" className="text-sm text-destructive">
            {deleteError}
          </p>
        )}
      </CardContent>

      <CardFooter>
        <Button
          type="button"
          variant={confirming ? "destructive" : "outline"}
          size="sm"
          className="w-full"
          disabled={deleting}
          onClick={handleDeleteClick}
        >
          {deleting ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Trash2 className="size-4" />
          )}
          {deleting
            ? "Verwijderen…"
            : confirming
              ? "Zeker weten? Klik nogmaals"
              : "Verwijderen"}
        </Button>
      </CardFooter>
    </Card>
  );
}

interface ScaledTemplatePreviewProps {
  id: string;
  name: string;
  width: number;
  height: number;
}

/**
 * Rendert de preview-pagina op natuurlijke grootte in een iframe en schaalt
 * hem met transform naar de kaartbreedte. De wrapper houdt via aspect-ratio
 * de juiste verhouding; een ResizeObserver houdt de schaal actueel.
 */
function ScaledTemplatePreview({
  id,
  name,
  width,
  height,
}: ScaledTemplatePreviewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || width <= 0) return;

    const update = () => setScale(wrapper.clientWidth / width);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div
      ref={wrapperRef}
      className="relative w-full overflow-hidden rounded-md border border-border bg-muted"
      style={{ aspectRatio: `${width} / ${height}` }}
    >
      {scale > 0 && (
        <iframe
          src={`/api/templates/${id}/preview`}
          title={`Voorbeeld van template ${name}`}
          sandbox="allow-same-origin"
          loading="lazy"
          className="pointer-events-none absolute left-0 top-0 border-0"
          style={{
            width: `${width}px`,
            height: `${height}px`,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        />
      )}
    </div>
  );
}
