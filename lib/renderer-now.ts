import { readdir, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
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
 * Of elke render zijn eigen browser krijgt in plaats van de gecachete. Staat
 * standaard aan op serverless (zie renderWithRetry voor het waarom) en is met
 * NOW_RENDERER_BROWSER_PER_RENDER=1/0 te forceren — zo is het productiepad
 * ook lokaal te draaien, met de gewone Chromium van playwright.
 */
function usesPerRenderBrowser(): boolean {
  const override = process.env.NOW_RENDERER_BROWSER_PER_RENDER;
  if (override === '1') return true;
  if (override === '0') return false;
  return isServerlessRuntime();
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

// Lazy + cached per process, alleen lokaal: launching Chromium is the
// expensive part, so we keep one Browser instance alive across
// renderNowSlide/renderNowCarousel calls. Each render still gets its own
// throwaway BrowserContext, which is what actually gets closed in the
// try/finally blocks below. Op Vercel wordt deze cache niet gebruikt — zie
// renderWithRetry: daar is een browser die een bevriezing moet overleven
// juist de oorzaak van de storing.
let browserPromise: Promise<Browser> | null = null;

/**
 * Chromium writes its user-data directory to os.tmpdir()
 * (playwright_chromiumdev_profile-*) and only removes it on a clean exit. A
 * crashed or frozen browser leaves it behind, and once enough of them pile up
 * the next Chromium has no room left for its shared-memory files ("Less than
 * 64MB of free space in temporary directory for shared memory files") and dies
 * on newPage/setContent/screenshot. Sweeping is a safety net for profiles that
 * leaked before this process started — the browser we are about to launch owns
 * a fresh directory.
 */
const PROFILE_PREFIX = 'playwright_chromiumdev_profile-';
/** Only touch profiles that cannot belong to a render still in flight. */
const PROFILE_MAX_AGE_MS = 5 * 60 * 1000;

async function sweepOrphanedProfiles(): Promise<void> {
  try {
    const tmpDir = os.tmpdir();
    const entries = await readdir(tmpDir);
    const cutoff = Date.now() - PROFILE_MAX_AGE_MS;

    await Promise.all(
      entries
        .filter((entry) => entry.startsWith(PROFILE_PREFIX))
        .map(async (entry) => {
          const dir = path.join(tmpDir, entry);
          try {
            const stats = await stat(dir);
            if (!stats.isDirectory() || stats.mtimeMs > cutoff) return;
            await rm(dir, { recursive: true, force: true });
          } catch {
            // Gone already, or not ours to delete — never block a render on it.
          }
        })
    );
  } catch {
    // Cleanup is best-effort: a failing sweep must never fail the render.
  }
}

/**
 * Serialiseert álle Chromium-launches binnen dit proces. Op Vercel's Fluid
 * compute delen gelijktijdige requests één instance (en dus één /tmp):
 * @sparticuz/chromium pakt de binary bij de eerste executablePath() naar
 * /tmp uit, en twee gelijktijdige launches racen dan tussen schrijven en
 * spawnen — de verliezer crasht op `spawn ETXTBSY` (gezien bij het
 * voorrenderen van publish-slides). Ná de launch mogen renders gewoon
 * parallel; alleen het starten zelf staat in de rij.
 */
let launchQueue: Promise<unknown> = Promise.resolve();

function launchBrowser(): Promise<Browser> {
  const next = launchQueue.then(launchBrowserUnserialized, launchBrowserUnserialized);
  launchQueue = next.catch(() => undefined);
  return next;
}

async function launchBrowserUnserialized(): Promise<Browser> {
  await sweepOrphanedProfiles();

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
    .filter((p) => !p.optional)
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
    // Optional tokens were added after carousels were already stored, so an
    // older slide simply has no value for them. Substituting an empty string
    // keeps applyReplacements' leftover guard happy and lets the template's
    // `:empty{display:none}` rules drop the element entirely.
    let raw = values[placeholder.name] ?? '';

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
    // A dying browser makes context.close() throw too; swallowing that keeps
    // the original (more informative) error on its way up. Disposing of the
    // browser itself is the caller's job — it knows whether it owns it.
    await context.close().catch(() => undefined);
  }
}

/**
 * True for the transient failures emitted when Chromium becomes unusable
 * mid-render. Vercel does not always report a hard disconnect: a dying
 * browser can instead reject only the screenshot protocol call.
 */
function isRecoverableBrowserError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /has been closed|Target closed|browser has disconnected|Connection closed|Unable to capture screenshot/i.test(
    message
  );
}

/**
 * Ask Chromium to exit and drop it from the process cache. The close is
 * unconditional: a crash fires the 'disconnected' handler, which has already
 * emptied the cache, so guarding the close on "is this still the cached
 * browser?" skipped it in exactly the case it exists for. Closing matters on
 * Vercel: otherwise a half-dead process/profile remains in /tmp, leaving too
 * little space for the fresh Chromium started by the retry.
 */
async function discardBrowser(browser: Browser): Promise<void> {
  // Compare before nulling: a concurrent render may already have cached a
  // different (healthy) browser, and that one must survive this discard.
  const cached = browserPromise;
  const cachedBrowser = await cached?.catch(() => null);
  if (browserPromise === cached && cachedBrowser === browser) {
    browserPromise = null;
  }

  await browser.close().catch(() => undefined);
}

/**
 * Rendert één slide, met één herkansing op een verse Chromium.
 *
 * Serverless is een eigen geval. Vercel bevriest de container tussen
 * aanroepen en Chromium overleeft dat niet, terwijl `isConnected()` nog
 * gewoon "verbonden" meldt — elke hergebruikte browser is daar dus een gok.
 * Verliezen we die gok, dan is het proces al hard weggehaald en blijft zijn
 * profielmap in /tmp staan; genoeg van die restanten en er is geen ruimte
 * meer voor de shared-memory-bestanden van de volgende Chromium. Vandaar:
 * op Vercel één browser per render, binnen dezelfde invocatie netjes
 * gesloten. Dat kost een seconde opstarten en maakt zowel de stale handle
 * als het /tmp-lek onmogelijk. Lokaal blijft de proces-cache staan — daar
 * wordt niets bevroren en is de winst reëel.
 */
async function renderWithRetry(
  spec: NowTemplateSpec,
  values: Record<string, string>
): Promise<Buffer> {
  if (usesPerRenderBrowser()) {
    const [png] = await renderBatchOnOwnBrowser([{ spec, values }]);
    return png;
  }

  const browser = await getBrowser();
  try {
    return await renderSpec(browser, spec, values);
  } catch (error) {
    if (!isRecoverableBrowserError(error)) throw error;
    await discardBrowser(browser);
    const fresh = await getBrowser();
    return renderSpec(fresh, spec, values);
  }
}

/**
 * Rendert een reeks slides op een eigen browser, die hoe dan ook weer
 * dichtgaat — een schone close is ook wat Chromium zijn profielmap laat
 * opruimen. Binnen één invocatie wordt er niets bevroren, dus de hele reeks
 * mag dezelfde browser delen; sterft hij onderweg alsnog, dan gaat die ene
 * slide door op een verse.
 */
async function renderBatchOnOwnBrowser(
  jobs: { spec: NowTemplateSpec; values: Record<string, string> }[]
): Promise<Buffer[]> {
  let browser = await launchOwnBrowser();
  try {
    const results: Buffer[] = [];
    for (const { spec, values } of jobs) {
      try {
        results.push(await renderSpec(browser, spec, values));
      } catch (error) {
        if (!isRecoverableBrowserError(error)) throw error;
        await browser.close().catch(() => undefined);
        browser = await launchOwnBrowser();
        results.push(await renderSpec(browser, spec, values));
      }
    }
    return results;
  } finally {
    await browser.close().catch(() => undefined);
  }
}

/** Zelfde foutafhandeling als de gecachete variant, zonder de cache. */
async function launchOwnBrowser(): Promise<Browser> {
  try {
    return await launchBrowser();
  } catch (error) {
    throw new NowRendererUnavailableError(
      `Could not launch Chromium for the NOW renderer (${
        isServerlessRuntime() ? 'serverless' : 'local'
      } mode): ${error instanceof Error ? error.message : String(error)}`,
      error
    );
  }
}

export async function renderNowSlide(input: RenderNowSlideInput): Promise<Buffer> {
  const spec = getNowTemplateSpec(input.family, input.slideType);
  return renderWithRetry(spec, input.values);
}

export async function renderNowCarousel(slides: RenderNowSlideInput[]): Promise<Buffer[]> {
  const jobs = slides.map((slide) => ({
    spec: getNowTemplateSpec(slide.family, slide.slideType),
    values: slide.values,
  }));

  // Serverless: één browser voor de hele reeks in plaats van één per slide,
  // wat een seconde opstarten per slide scheelt zonder de browser over
  // invocaties heen te tillen.
  if (usesPerRenderBrowser()) return renderBatchOnOwnBrowser(jobs);

  const results: Buffer[] = [];
  for (const job of jobs) {
    // Per slide, so a browser that dies halfway through a long carousel
    // costs one relaunch instead of the whole batch.
    results.push(await renderWithRetry(job.spec, job.values));
  }
  return results;
}
