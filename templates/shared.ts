import type { BrandSettings } from "@/types/carousel";

/**
 * Only Inter (Regular + Bold) is bundled in assets/fonts for offline satori
 * rendering (see assets/fonts/README.md). BrandSettings.fontFamily is kept
 * in the type contract for a future phase that embeds more fonts, but
 * templates must not reference a family satori hasn't been given — so every
 * template pins its CSS to this constant instead of brand.fontFamily.
 */
export const FONT_FAMILY = "Inter";

/** Nice, neutral defaults used whenever brand fields are missing/empty. */
const DEFAULT_BRAND = {
  name: "",
  primaryColor: "#d0342c",
  secondaryColor: "#111111",
  textColor: "#111111",
  backgroundColor: "#ffffff",
} as const;

export type ResolvedBrand = Required<
  Pick<
    BrandSettings,
    | "name"
    | "primaryColor"
    | "secondaryColor"
    | "textColor"
    | "backgroundColor"
  >
> &
  Pick<BrandSettings, "logoUrl" | "handle">;

/**
 * Fills in sane black/white/accent defaults for any brand field that is
 * missing or an empty string, so templates never have to guard against
 * "" colors. Treat this as the single source of truth for "brand is empty"
 * fallback behaviour across all three templates.
 */
export function resolveBrand(brand: BrandSettings | null | undefined): ResolvedBrand {
  const pick = (value: string | undefined, fallback: string) =>
    value && value.trim().length > 0 ? value : fallback;

  return {
    name: pick(brand?.name, DEFAULT_BRAND.name),
    primaryColor: pick(brand?.primaryColor, DEFAULT_BRAND.primaryColor),
    secondaryColor: pick(brand?.secondaryColor, DEFAULT_BRAND.secondaryColor),
    textColor: pick(brand?.textColor, DEFAULT_BRAND.textColor),
    backgroundColor: pick(brand?.backgroundColor, DEFAULT_BRAND.backgroundColor),
    logoUrl: brand?.logoUrl,
    handle: brand?.handle,
  };
}

/**
 * The `list` layout has no dedicated `items` field on Slide — list items
 * live in `body` as newline-separated text (optionally bullet-prefixed).
 * Shared by all three templates so list parsing stays consistent.
 */
export function parseListItems(body?: string): string[] {
  if (!body) return [];

  return body
    .split("\n")
    .map((line) => line.replace(/^[\s]*[-•*\d.)]+\s*/, "").trim())
    .filter((line) => line.length > 0);
}

/** Formats "3 / 8" style page counters used across templates. */
export function formatPageCounter(index: number, total: number): string {
  return `${index + 1} / ${total}`;
}
