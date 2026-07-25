import { extractPlaceholders } from "@/lib/uploaded-templates";

/**
 * Static analysis of raw template HTML, used by the import flows
 * (/api/templates/import/url, /api/templates/batch) to derive sensible
 * defaults and user-facing warnings without rendering anything.
 *
 * Everything here is pure string work: no DOM, no network, no fs. The HTML
 * is untrusted input (it can come from an external URL), so nothing is
 * evaluated — it is only scanned.
 */

export interface TemplateAnalysis {
  /** Unique {{token}} names, in order of first appearance. */
  placeholders: string[];
  /** Trimmed <title> content, or null when absent/empty. */
  title: string | null;
  /** Detected canvas width in px, or null when no width+height pair was found. */
  width: number | null;
  /** Detected canvas height in px, or null when no width+height pair was found. */
  height: number | null;
  /** Absolute http(s) URLs the template references (max 20, deduped). */
  externalResources: string[];
  /** True when the HTML contains a <script> tag. */
  hasScripts: boolean;
}

/** Plausible canvas widths — narrower than this is a component, wider is not a social canvas. */
const MIN_CANVAS_WIDTH = 300;
const MAX_CANVAS_WIDTH = 4000;

/** Hard cap on reported external resources, so a pathological file can't blow up the response. */
const MAX_EXTERNAL_RESOURCES = 20;

const TITLE_PATTERN = /<title[^>]*>([\s\S]*?)<\/title>/i;
const SCRIPT_PATTERN = /<script/i;
const WIDTH_DECLARATION = /(?:^|[;{\s])width\s*:\s*(\d+(?:\.\d+)?)\s*px/i;
const HEIGHT_DECLARATION = /(?:^|[;{\s])height\s*:\s*(\d+(?:\.\d+)?)\s*px/i;
const TAG_PATTERN = /<([a-zA-Z][a-zA-Z0-9:-]*)\b([^>]*)>/g;
const ATTRIBUTE_PATTERN =
  /\b(src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi;
const CSS_URL_PATTERN = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"\s]+))\s*\)/gi;

/**
 * Yields the contents of every innermost `{ ... }` block in the source.
 *
 * `{{token}}` / `}}` sequences are skipped so placeholder tokens never open
 * or close a block. Only innermost blocks are yielded, so an `@media`
 * wrapper does not swallow the rules inside it.
 */
function* innermostBlocks(source: string): Generator<string> {
  let start: number | null = null;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];

    if (char === "{") {
      if (source[i + 1] === "{") {
        i += 1; // `{{` — part of a placeholder token, not a CSS block.
        continue;
      }
      start = i + 1;
      continue;
    }

    if (char === "}") {
      if (source[i + 1] === "}") {
        i += 1; // `}}` — closing half of a placeholder token.
        continue;
      }
      if (start !== null) {
        yield source.slice(start, i);
        start = null;
      }
    }
  }
}

/**
 * Finds the first CSS rule that sets both `width` and `height` in px, with a
 * width in the plausible-canvas range. Declarations whose value is a
 * `{{token}}` are ignored automatically: only literal digits match.
 */
function detectDimensions(html: string): { width: number | null; height: number | null } {
  for (const block of innermostBlocks(html)) {
    const widthMatch = block.match(WIDTH_DECLARATION);
    const heightMatch = block.match(HEIGHT_DECLARATION);
    if (!widthMatch || !heightMatch) {
      continue;
    }

    const width = Math.round(Number(widthMatch[1]));
    const height = Math.round(Number(heightMatch[1]));
    if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) {
      continue;
    }
    if (width < MIN_CANVAS_WIDTH || width > MAX_CANVAS_WIDTH) {
      continue;
    }

    return { width, height };
  }

  return { width: null, height: null };
}

function isAbsoluteHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

/**
 * Collects unique absolute http(s) URLs from `src=`, `href=` (skipping
 * `<a href>` — those are links, not embedded resources) and CSS `url(...)`.
 * Relative paths and `data:` URIs (e.g. base64-embedded fonts) are ignored.
 */
function collectExternalResources(html: string): string[] {
  const seen = new Set<string>();
  const resources: string[] = [];

  const add = (raw: string | undefined) => {
    if (!raw || resources.length >= MAX_EXTERNAL_RESOURCES) {
      return;
    }
    const value = raw.trim();
    if (!isAbsoluteHttpUrl(value) || seen.has(value)) {
      return;
    }
    seen.add(value);
    resources.push(value);
  };

  for (const tagMatch of html.matchAll(TAG_PATTERN)) {
    if (resources.length >= MAX_EXTERNAL_RESOURCES) {
      break;
    }

    const tagName = tagMatch[1].toLowerCase();
    const attributes = tagMatch[2] ?? "";

    for (const attrMatch of attributes.matchAll(ATTRIBUTE_PATTERN)) {
      const attrName = attrMatch[1].toLowerCase();
      if (attrName === "href" && tagName === "a") {
        continue;
      }
      add(attrMatch[2] ?? attrMatch[3] ?? attrMatch[4]);
    }
  }

  for (const urlMatch of html.matchAll(CSS_URL_PATTERN)) {
    if (resources.length >= MAX_EXTERNAL_RESOURCES) {
      break;
    }
    add(urlMatch[1] ?? urlMatch[2] ?? urlMatch[3]);
  }

  return resources;
}

/** Analyzes template HTML without rendering or executing any of it. */
export function analyzeTemplateHtml(html: string): TemplateAnalysis {
  const titleMatch = html.match(TITLE_PATTERN);
  const title = titleMatch?.[1]?.trim();
  const { width, height } = detectDimensions(html);

  return {
    placeholders: extractPlaceholders(html),
    title: title ? title : null,
    width,
    height,
    externalResources: collectExternalResources(html),
    hasScripts: SCRIPT_PATTERN.test(html),
  };
}
