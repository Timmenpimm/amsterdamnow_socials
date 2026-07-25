"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import {
  ClipboardPaste,
  FileUp,
  Link2,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { UploadedTemplate } from "@/components/dashboard/uploaded-templates-card";
import { TemplateImportBuiltin } from "@/components/dashboard/template-import-builtin";
import { TemplateImportFiles } from "@/components/dashboard/template-import-files";
import { TemplateImportPaste } from "@/components/dashboard/template-import-paste";
import { TemplateImportUrl } from "@/components/dashboard/template-import-url";

type ImportMode = "files" | "paste" | "url" | "builtin";

const MODES: { id: ImportMode; label: string; icon: LucideIcon }[] = [
  { id: "files", label: "Bestanden", icon: FileUp },
  { id: "paste", label: "Plakken", icon: ClipboardPaste },
  { id: "url", label: "Link", icon: Link2 },
  { id: "builtin", label: "Ingebouwd", icon: Sparkles },
];

interface TemplateImportPanelProps {
  /** Zet nieuwe templates vooraan in het grid van de parent. */
  onImported: (templates: UploadedTemplate[]) => void;
}

/**
 * Importpaneel met vier modi. De tabbalk is met de hand gebouwd (buttons met
 * actieve styling): dit project heeft geen tabs-primitive en we willen er geen
 * Radix-dependency voor toevoegen. Alle panelen blijven gemount zodat een
 * halfingevuld formulier niet verdwijnt bij het wisselen van tab.
 */
export function TemplateImportPanel({ onImported }: TemplateImportPanelProps) {
  const [mode, setMode] = useState<ImportMode>("files");
  const tabRefs = useRef<Partial<Record<ImportMode, HTMLButtonElement | null>>>(
    {}
  );

  function handleTabKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();

    const current = MODES.findIndex((item) => item.id === mode);
    const offset = event.key === "ArrowRight" ? 1 : -1;
    const next = MODES[(current + offset + MODES.length) % MODES.length];

    setMode(next.id);
    tabRefs.current[next.id]?.focus();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Templates importeren</CardTitle>
        <CardDescription>
          Haal je afgeronde ontwerpen binnen als bestand, geplakte HTML of link.
          Placeholders zoals {"{{titel}}"} worden automatisch herkend.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div
          role="tablist"
          aria-label="Manier van importeren"
          className="flex flex-wrap gap-1 rounded-md bg-muted p-1"
          onKeyDown={handleTabKeyDown}
        >
          {MODES.map(({ id, label, icon: Icon }) => {
            const active = mode === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`template-import-tab-${id}`}
                aria-selected={active}
                aria-controls={`template-import-panel-${id}`}
                tabIndex={active ? 0 : -1}
                ref={(node) => {
                  tabRefs.current[id] = node;
                }}
                onClick={() => setMode(id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-sm px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            );
          })}
        </div>

        {MODES.map(({ id }) => (
          <div
            key={id}
            role="tabpanel"
            id={`template-import-panel-${id}`}
            aria-labelledby={`template-import-tab-${id}`}
            hidden={mode !== id}
          >
            {id === "files" && <TemplateImportFiles onImported={onImported} />}
            {id === "paste" && <TemplateImportPaste onImported={onImported} />}
            {id === "url" && <TemplateImportUrl onImported={onImported} />}
            {id === "builtin" && (
              <TemplateImportBuiltin onImported={onImported} />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
