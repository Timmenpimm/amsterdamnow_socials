import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Browser } from 'playwright-core';
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
 * Two runtimes, one code path:
 *   - local/dev  -> the full `playwright` package (devDependency) with the
 *                   Chromium it downloaded on install.
 *   - Vercel/AWS -> `playwright-core` driving the Lambda-optimised Chromium
 *                   from `@sparticuz/chromium` (option 2 in
 *                   docs/design/social-templates/INTEGRATIE.md).
 *
 * Both must stay in `serverExternalPackages` (next.config.ts): they resolve
 * binaries through relative paths that break once bundled.
 */

/** Serverless (Vercel function / AWS Lambda) vs. a normal Node process. */
function isServerlessRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

/**
 * Thrown when no Chromium can be started at all (missing binary, no
 * executable path, sandbox refused). Callers map this to 503 "not available
 * in this environment" instead of a generic 500 — see app/api/render/route.ts.
 */
export class NowRendererUnavailableError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'NowRendererUnavailableError';
    this.cause = cause;
  }
}

export function isNowRendererUnavailable(error: unknown): boolean {
  return error instanceof NowRendererUnavailableError;
}

/**
 * Where templates/now/*.html live at runtime. cwd first (correct for
 * `next dev`, `next start` and scripts run from the repo root), module-relative
 * second — the module path is unreliable inside the serverless bundle, which is
 * exactly why app/api/templates/import/builtin/route.ts resolves it the same
 * way. next.config.ts traces the files into both routes.
 */
const TEMPLATE_DIR_CANDIDATES = [
  path.join(process.cwd(), 'templates', 'now'),
  path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates', 'now'),
];

/** Template HTML never changes at runtime, so one read per file per process. */
const templateHtmlCache = new Map<string, string>();

async function readTemplateHtml(file: string): Promise<string> {
  const cached = templateHtmlCache.get(file);
  if (cached !== undefined) return cached;

  for (const dir of TEMPLATE_DIR_CANDIDATES) {
    try {
      const html = await readFile(path.join(dir, file), 'utf-8');
      templateHtmlCache.set(file, html);
      return html;
    } catch {
      // Try the next candidate directory.
    }
  }

  throw new NowRendererUnavailableError(
    `NOW template "${file}" not found. Tried: ${TEMPLATE_DIR_CANDIDATES.join(', ')}.`
  );
}

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

async function launchBrowser(): Promise<Browser> {
  if (isServerlessRuntime()) {
    // playwright is a devDependency and simply isn't there on Vercel.
    const [{ chromium }, sparticuz] = await Promise.all([
      import('playwright-core'),
      import('@sparticuz/chromium'),
    ]);
    const serverlessChromium = sparticuz.default;

    // The templates are plain HTML/CSS with base64-embedded fonts — no WebGL —
    // so skipping the swiftshader extraction saves cold-start time and /tmp space.
    serverlessChromium.setGraphicsMode = false;

    return chromium.launch({
      args: serverlessChromium.args,
      executablePath: await serverlessChromium.executablePath(),
      headless: true,
    });
  }

  // Local/dev: the full playwright package with its downloaded Chromium.
  const { chromium } = await import('playwright');
  return chromium.launch({ headless: true });
}

async function getBrowser(): Promise<Browser> {
  // A cached browser can be dead without the 'disconnected' handler ever
  // running: on Vercel the container is frozen between invocations and
  // Chromium does not survive it, so the next request inherits a stale
  // handle ("Target page, context or browser has been closed"). Check
  // liveness before handing it out.
  if (browserPromise) {
    const cached = browserPromise;
    const browser = await cached.catch(() => null);
    if (browser?.isConnected()) return browser;
    if (browserPromise === cached) browserPromise = null;
  }

  return launchAndCache();
}

function launchAndCache(): Promise<Browser> {

  const pending: Promise<Browser> = launchBrowser().then(
    (browser) => {
      // A crashed/OOM-killed browser must not stay cached as "ready".
      browser.on('disconnected', () => {
        if (browserPromise === pending) browserPromise = null;
      });
      return browser;
    },
    (error: unknown) => {
      // Never poison the cache with a rejected promise: the next request
      // gets a fresh launch attempt.
      if (browserPromise === pending) browserPromise = null;
      throw new NowRendererUnavailableError(
        `Could not launch Chromium for the NOW renderer (${
          isServerlessRuntime() ? 'serverless' : 'local'
        } mode): ${error instanceof Error ? error.message : String(error)}`,
        error
      );
    }
  );

  browserPromise = pending;
  return pending;
}

/** Explicitly shut down the cached browser. Call this once a script/process is fully done rendering. */
export async function closeNowRendererBrowser(): Promise<void> {
  if (!browserPromise) return;
  const pending = browserPromise;
  browserPromise = null;
  const browser = await pending.catch(() => null);
  await browser?.close();
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

/**
 * Restores literal <br> tags in an already-escaped value. Only used for
 * placeholders the design contract marks as `allowsLineBreak`, so everything
 * else in the value stays escaped.
 */
function restoreLineBreaks(escaped: string): string {
  return escaped.replace(/&lt;br\s*\/?&gt;/gi, '<br>');
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
        : placeholder.allowsLineBreak
          ? restoreLineBreaks(escapeHtml(raw))
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
  const rawHtml = await readTemplateHtml(spec.file);
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

/** True for the errors a browser that died mid-render throws. */
function isDeadBrowserError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /has been closed|Target closed|browser has disconnected|Connection closed/i.test(
    message
  );
}

/**
 * Renders once, and on a dead-browser error drops the cached handle and
 * retries with a fresh launch. The container can be frozen between (or even
 * during) invocations, so this is a normal condition on Vercel, not an
 * exceptional one.
 */
async function renderWithRetry(
  spec: NowTemplateSpec,
  values: Record<string, string>
): Promise<Buffer> {
  const browser = await getBrowser();
  try {
    return await renderSpec(browser, spec, values);
  } catch (error) {
    if (!isDeadBrowserError(error)) throw error;
    browserPromise = null;
    const fresh = await getBrowser();
    return renderSpec(fresh, spec, values);
  }
}

export async function renderNowSlide(input: RenderNowSlideInput): Promise<Buffer> {
  const spec = getNowTemplateSpec(input.family, input.slideType);
  return renderWithRetry(spec, input.values);
}

export async function renderNowCarousel(slides: RenderNowSlideInput[]): Promise<Buffer[]> {
  const results: Buffer[] = [];
  for (const slide of slides) {
    const spec = getNowTemplateSpec(slide.family, slide.slideType);
    // Per slide, so a browser that dies halfway through a long carousel
    // costs one relaunch instead of the whole batch.
    results.push(await renderWithRetry(spec, slide.values));
  }
  return results;
}
