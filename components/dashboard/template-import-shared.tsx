"use client";

import type { ReactNode } from "react";

import type { UploadedTemplate } from "@/components/dashboard/uploaded-templates-card";

/** Client-side limieten voor de batch-import (backend bewaakt dit nogmaals). */
export const MAX_IMPORT_FILES = 25;
export const MAX_FILE_BYTES = 5 * 1024 * 1024; // ~5MB

/** Eén mislukt item uit POST /api/templates/batch. */
export interface ImportFailure {
  index: number;
  name: string;
  error: string;
}

/** Elke import-modus krijgt dezelfde callback om het grid bij te werken. */
export interface TemplateImportModeProps {
  /** Voegt zojuist geïmporteerde templates vooraan het grid toe. */
  onImported: (templates: UploadedTemplate[]) => void;
}

/** "1 template" / "6 templates" — voorkomt Denglish in de samenvattingen. */
export function templateCountLabel(count: number): string {
  return `${count} ${count === 1 ? "template" : "templates"}`;
}

/** Bestandsgrootte in NL-notatie (komma als decimaalteken). */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/**
 * Haalt de foutmelding uit een API-response; plakt eventuele zod-issues
 * erachter zodat validatiedetails niet verloren gaan.
 */
export function extractApiError(data: unknown, fallback: string): string {
  const record = data as { error?: unknown; issues?: unknown } | null;
  const base = typeof record?.error === "string" ? record.error : fallback;
  const issues = Array.isArray(record?.issues)
    ? record.issues
        .map((issue: { message?: string }) => issue?.message)
        .filter(Boolean)
        .join(" ")
    : "";
  return [base, issues].filter(Boolean).join(" ");
}

export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm text-destructive">
      {children}
    </p>
  );
}

export function SuccessNote({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm text-emerald-600 dark:text-emerald-400">{children}</p>
  );
}

/**
 * Waarschuwingen bij een geslaagde import (bijv. externe assets die niet
 * mee konden komen). Bewust geen `role="alert"`: dit is geen fout.
 */
export function WarningNote({ warnings }: { warnings: string[] }) {
  if (warnings.length === 0) return null;

  return (
    <div className="flex flex-col gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
      <p className="font-medium">Let op bij deze import:</p>
      <ul className="list-disc pl-4">
        {warnings.map((warning, index) => (
          <li key={`${index}-${warning}`}>{warning}</li>
        ))}
      </ul>
    </div>
  );
}
