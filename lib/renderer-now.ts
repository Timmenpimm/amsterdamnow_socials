import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Browser } from 'playwright';
import {
  getNowTemplateSpec,
  type NowTemplateFamily,
  type NowSlideType,
  type NowTemplateSpec,
} from '@/templates/now/manifest';

/**
 * Playwright-based renderer for the Amsterdam NOW render-ready HTML templates
 * (templates/now/*.html). Reads a template, string-replaces its {{placeholder}}
 * tokens, and screenshots it at the exact pixel size declared in the manifest.
 *
 * Not deployable on Vercel serverless as-is (no headless-browser runtime there) —
 * see docs/design/social-templates/INTEGRATIE.md for deployment options.
 */

const TEMPLATES_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'now');

export interface RenderNowSlideInput {
  family: NowTemplateFamily;
  slideType: NowSlideType;
  values: Record<string, string>;
}

// Lazy + cached per process: launching Chromium is the expensive part, so we
// keep one Browser instance alive across renderNowSlide/renderNowCarousel
// calls. Each render still gets its own throwaway BrowserContext, which is
// what actually gets closed in the try/finally blocks below.
let browserPromise: Promise<Browser> | null = null;

function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = chromium.launch({ headless: true });
  }
  return browserPromise;
}

/** Explicitly shut down the cached browser. Call this once a script/process is fully done rendering. */
export async function closeNowRendererBrowser(): Promise<void> {
  if (!browserPromise) return;
  const browser = await browserPromise;
  browserPromise = null;
  await browser.close();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Escapes a value destined for a CSS url('...') — not HTML-escaping, just preventing breakout. */
function escapeCssUrlValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function padNumeric(value: string, length: number): string {
  return /^\d+$/.test(value) ? value.padStart(length, '0') : value;
}

function buildReplacements(spec: NowTemplateSpec, values: Record<string, string>): Map<string, string> {
  const missing = spec.placeholders
    .map((p) => p.name)
    .filter((name) => values[name] === undefined || values[name] === null);

  if (missing.length > 0) {
    throw new Error(
      `renderNowSlide: missing value(s) for placeholder(s) [${missing.join(', ')}] required by ` +
        `${spec.family}/${spec.slideType} (${spec.file}).`
    );
  }

  const replacements = new Map<string, string>();
  for (const placeholder of spec.placeholders) {
    let raw = values[placeholder.name];

    if (placeholder.enumValues && !placeholder.enumValues.includes(raw)) {
      throw new Error(
        `renderNowSlide: placeholder "${placeholder.name}" must be one of ` +
          `[${placeholder.enumValues.join(', ')}], got "${raw}".`
      );
    }

    if (placeholder.zeroPadTo) {
      raw = padNumeric(raw, placeholder.zeroPadTo);
    }

    const finalValue = placeholder.isUrl
      ? escapeCssUrlValue(raw)
      : placeholder.enumValues
        ? raw
        : escapeHtml(raw);

    replacements.set(placeholder.name, finalValue);
  }
  return replacements;
}

function applyReplacements(html: string, replacements: Map<string, string>): string {
  let output = html;
  for (const [name, value] of replacements) {
    output = output.split(`{{${name}}}`).join(value);
  }

  const leftover = output.match(/{{\s*\w+\s*}}/);
  if (leftover) {
    throw new Error(`renderNowSlide: unresolved placeholder ${leftover[0]} remained after substitution.`);
  }

  return output;
}

async function renderSpec(
  browser: Browser,
  spec: NowTemplateSpec,
  values: Record<string, string>
): Promise<Buffer> {
  const templatePath = path.join(TEMPLATES_DIR, spec.file);
  const rawHtml = await readFile(templatePath, 'utf-8');
  const html = applyReplacements(rawHtml, buildReplacements(spec, values));

  const context = await browser.newContext({ viewport: spec.dimensions, deviceScaleFactor: 1 });
  try {
    const page = await context.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    return await page.screenshot({ type: 'png' });
  } finally {
    await context.close();
  }
}

export async function renderNowSlide(input: RenderNowSlideInput): Promise<Buffer> {
  const spec = getNowTemplateSpec(input.family, input.slideType);
  const browser = await getBrowser();
  return renderSpec(browser, spec, input.values);
}

export async function renderNowCarousel(slides: RenderNowSlideInput[]): Promise<Buffer[]> {
  const browser = await getBrowser();
  const results: Buffer[] = [];
  for (const slide of slides) {
    const spec = getNowTemplateSpec(slide.family, slide.slideType);
    results.push(await renderSpec(browser, spec, slide.values));
  }
  return results;
}
