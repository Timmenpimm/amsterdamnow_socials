import type { Template } from "@prisma/client";

/**
 * Helpers for user-uploaded HTML templates.
 *
 * Templates contain `{{placeholder}}` tokens that are extracted on upload
 * and substituted with sample values for previews.
 */

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

/** 1080x1350 light-grey SVG used as the sample value for image-like tokens. */
const SAMPLE_IMAGE_DATA_URI = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350"><rect width="1080" height="1350" fill="#e2e2e2"/><rect x="490" y="625" width="100" height="100" fill="#c4c4c4" rx="8"/></svg>'
)}`;

/** Known token names → readable Dutch sample values. */
const DUTCH_SAMPLES: Record<string, string> = {
  titel: "Voorbeeldtitel",
  title: "Voorbeeldtitel",
  kop: "Voorbeeldkop",
  headline: "Voorbeeldkop",
  subkop: "Voorbeeldsubkop",
  subtitel: "Voorbeeldsubtitel",
  subtitle: "Voorbeeldsubtitel",
  tekst: "Dit is een voorbeeldtekst voor deze template.",
  text: "Dit is een voorbeeldtekst voor deze template.",
  body: "Dit is een voorbeeldtekst voor deze template.",
  intro: "Dit is een korte voorbeeldintro.",
  excerpt: "Dit is een korte voorbeeldsamenvatting.",
  samenvatting: "Dit is een korte voorbeeldsamenvatting.",
  quote: "Dit is een voorbeeldquote.",
  citaat: "Dit is een voorbeeldquote.",
  auteur: "Naam Achternaam",
  author: "Naam Achternaam",
  naam: "Naam Achternaam",
  name: "Naam Achternaam",
  datum: "25 juli 2026",
  date: "25 juli 2026",
  categorie: "Nieuws",
  category: "Nieuws",
  handle: "@voorbeeld",
  cta: "Lees meer op de site",
  locatie: "Amsterdam",
  location: "Amsterdam",
};

/** "sub_kop-2" → "Sub kop 2" */
function humanizeToken(token: string): string {
  const words = token
    .split(/[._-]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/([a-z])([A-Z])/g, "$1 $2");
  if (!words) {
    return "Voorbeeld";
  }
  return words.charAt(0).toUpperCase() + words.slice(1).toLowerCase();
}

/**
 * Extracts the unique `{{placeholder}}` token names from template HTML,
 * in order of first appearance.
 */
export function extractPlaceholders(html: string): string[] {
  const seen = new Set<string>();
  const placeholders: string[] = [];

  for (const match of html.matchAll(PLACEHOLDER_PATTERN)) {
    const token = match[1];
    if (!seen.has(token)) {
      seen.add(token);
      placeholders.push(token);
    }
  }

  return placeholders;
}

/** Sample value for a single token name, used in previews. */
function sampleValueFor(token: string): string {
  const lower = token.toLowerCase();

  if (/image|img|foto|url|src/.test(lower)) {
    return SAMPLE_IMAGE_DATA_URI;
  }
  if (/number|nummer|index|count/.test(lower)) {
    return "01";
  }

  // Match against the last segment too, so e.g. "slide.titel" works.
  const lastSegment = lower.split(/[._-]/).pop() ?? lower;
  return DUTCH_SAMPLES[lower] ?? DUTCH_SAMPLES[lastSegment] ?? humanizeToken(token);
}

/**
 * Replaces every `{{token}}` occurrence in the HTML with a sample value
 * so the template can be previewed without real content. No tokens are
 * left behind.
 */
export function substituteSampleValues(
  html: string,
  placeholders: string[]
): string {
  const values = new Map<string, string>(
    placeholders.map((token) => [token, sampleValueFor(token)])
  );

  return html.replace(PLACEHOLDER_PATTERN, (full, token: string) => {
    return values.get(token) ?? sampleValueFor(token);
  });
}

export interface TemplateDto {
  id: string;
  name: string;
  description: string | null;
  width: number;
  height: number;
  placeholders: string[];
  createdAt: string;
}

/** Serializes a Template row to its API DTO — deliberately without `html`. */
export function serializeTemplate(t: Template): TemplateDto {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    width: t.width,
    height: t.height,
    placeholders: Array.isArray(t.placeholders)
      ? (t.placeholders as string[])
      : [],
    createdAt: t.createdAt.toISOString(),
  };
}
