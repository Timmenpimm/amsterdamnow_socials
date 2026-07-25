import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveApiUserId } from "@/lib/api-auth";
import { db } from "@/lib/db";
import {
  ExternalFetchError,
  fetchExternalHtml,
  type ExternalFetchErrorCode,
} from "@/lib/fetch-external-html";
import {
  analyzeTemplateHtml,
  type TemplateAnalysis,
} from "@/lib/template-analysis";
import { serializeTemplate } from "@/lib/uploaded-templates";

export const runtime = "nodejs";

const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 1350;
const MAX_NAME_LENGTH = 100;
const FALLBACK_NAME = "Geïmporteerde template";

const importUrlSchema = z.object({
  url: z.string().min(1).max(2000),
  name: z.string().min(1).max(MAX_NAME_LENGTH).optional(),
  description: z.string().max(300).optional(),
});

/** 400 for "your input is wrong", 504 for "the other side didn't deliver". */
const ERROR_STATUS: Record<ExternalFetchErrorCode, number> = {
  invalid_url: 400,
  blocked_host: 400,
  not_html: 400,
  too_large: 400,
  http_error: 400,
  timeout: 504,
  fetch_failed: 504,
};

const ERROR_MESSAGE: Record<ExternalFetchErrorCode, string> = {
  invalid_url: "Dit is geen geldige http(s)-URL.",
  blocked_host:
    "Deze URL wijst naar een intern of afgeschermd adres en kan niet worden opgehaald.",
  not_html: "Deze URL levert geen HTML-pagina op.",
  too_large: "De template op deze URL is groter dan 5 MB.",
  http_error: "De URL gaf een foutmelding terug.",
  timeout: "De URL reageerde niet binnen 10 seconden.",
  fetch_failed: "De URL kon niet worden opgehaald.",
};

/** "https://voorbeeld.nl/templates/cover.html" → "voorbeeld.nl — cover" */
function nameFromUrl(finalUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(finalUrl);
  } catch {
    return null;
  }

  const segment = parsed.pathname.split("/").filter(Boolean).pop();
  if (!segment) {
    return parsed.hostname || null;
  }

  let basename: string;
  try {
    basename = decodeURIComponent(segment);
  } catch {
    basename = segment;
  }

  const cleaned = basename
    .replace(/\.[a-z0-9]{1,8}$/i, "")
    .replace(/[-_]+/g, " ")
    .trim();

  if (!cleaned) {
    return parsed.hostname || null;
  }
  return `${parsed.hostname} — ${cleaned}`;
}

function buildWarnings(analysis: TemplateAnalysis): string[] {
  const warnings: string[] = [];

  if (analysis.externalResources.length > 0) {
    warnings.push(
      `Template verwijst naar ${analysis.externalResources.length} externe bron(nen); die worden mogelijk niet meegerenderd.`
    );
  }
  if (analysis.hasScripts) {
    warnings.push(
      "Template bevat scripts; die worden in de preview niet uitgevoerd."
    );
  }

  return warnings;
}

/**
 * POST /api/templates/import/url
 * Body: { url, name?, description? }
 *
 * Fetches the URL (SSRF-hardened, see lib/fetch-external-html.ts), analyzes
 * the HTML and stores it as a template. The response carries user-facing
 * warnings about anything that will not survive rendering.
 */
export async function POST(request: Request) {
  const userId = await resolveApiUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const parsed = importUrlSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  let html: string;
  let finalUrl: string;
  try {
    ({ html, finalUrl } = await fetchExternalHtml(parsed.data.url));
  } catch (error) {
    if (error instanceof ExternalFetchError) {
      return NextResponse.json(
        { error: ERROR_MESSAGE[error.code] },
        { status: ERROR_STATUS[error.code] }
      );
    }
    console.error("Failed to fetch external template:", error);
    return NextResponse.json(
      { error: "De URL kon niet worden opgehaald." },
      { status: 504 }
    );
  }

  const analysis = analyzeTemplateHtml(html);
  const name = (
    parsed.data.name ??
    analysis.title ??
    nameFromUrl(finalUrl) ??
    FALLBACK_NAME
  ).slice(0, MAX_NAME_LENGTH);

  try {
    const template = await db.template.create({
      data: {
        userId,
        name,
        description: parsed.data.description ?? null,
        html,
        placeholders: analysis.placeholders,
        width: analysis.width ?? DEFAULT_WIDTH,
        height: analysis.height ?? DEFAULT_HEIGHT,
      },
    });

    return NextResponse.json(
      {
        template: serializeTemplate(template),
        warnings: buildWarnings(analysis),
        sourceUrl: finalUrl,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create imported template:", error);
    return NextResponse.json(
      { error: "De template kon niet worden opgeslagen." },
      { status: 500 }
    );
  }
}
