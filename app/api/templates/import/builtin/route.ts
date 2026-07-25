import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { NextResponse } from "next/server";

import { resolveApiUserId } from "@/lib/api-auth";
import { db } from "@/lib/db";
import {
  extractPlaceholders,
  serializeTemplate,
  type TemplateDto,
} from "@/lib/uploaded-templates";
import {
  NOW_TEMPLATE_MANIFEST,
  type NowTemplateSpec,
} from "@/templates/now/manifest";

export const runtime = "nodejs";

/**
 * POST /api/templates/import/builtin
 *
 * Copies the 11 built-in Amsterdam NOW templates (templates/now/*.html, see
 * templates/now/manifest.ts) into the current user's own template library, so
 * they can be previewed and edited like any uploaded template.
 *
 * Runtime file availability — verified, not assumed:
 * the manifest builds each path dynamically (`entry.file`), which Next's
 * output file tracing cannot follow statically. Checked against the local
 * build in .next: no `*.nft.json` trace file mentions `templates/now`, so
 * these HTML files are NOT part of any traced serverless bundle today. They
 * are present for `next dev` / `next start` (cwd = repo root) and for any
 * deploy that ships the repo working tree, but on Vercel serverless they will
 * be missing until `outputFileTracingIncludes` is added to next.config.ts.
 * Hence: read relative to process.cwd() first, fall back to a module-relative
 * path, and answer 503 (never crash) when neither yields the files.
 */

const CWD_TEMPLATES_DIR = path.join(process.cwd(), "templates/now");
const MODULE_TEMPLATES_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../../templates/now"
);

const UNAVAILABLE_MESSAGE =
  "De ingebouwde NOW-templates zijn niet beschikbaar in deze omgeving: de HTML-bestanden zitten niet in de deployment. Upload de templates handmatig of voeg templates/now toe aan de build.";

interface LoadedTemplate {
  spec: NowTemplateSpec;
  name: string;
  html: string;
}

/** "hotspot" + "cover" → "NOW — Hotspot Cover" */
function templateNameFor(spec: NowTemplateSpec): string {
  const capitalize = (value: string) =>
    value.charAt(0).toUpperCase() + value.slice(1);
  return `NOW — ${capitalize(spec.family)} ${capitalize(spec.slideType)}`;
}

/** Reads one manifest entry, trying cwd first and the module-relative path second. */
async function readTemplateHtml(spec: NowTemplateSpec): Promise<string | null> {
  for (const dir of [CWD_TEMPLATES_DIR, MODULE_TEMPLATES_DIR]) {
    try {
      return await readFile(path.join(dir, spec.file), "utf8");
    } catch {
      // Try the next candidate directory.
    }
  }
  return null;
}

export async function POST(request: Request) {
  const userId = await resolveApiUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // The body is optional; anything sent is ignored on purpose.
  await request.text().catch(() => "");

  const loaded: LoadedTemplate[] = [];
  const unreadable: string[] = [];

  for (const spec of NOW_TEMPLATE_MANIFEST) {
    const name = templateNameFor(spec);
    const html = await readTemplateHtml(spec);
    if (html === null) {
      unreadable.push(name);
      continue;
    }
    loaded.push({ spec, name, html });
  }

  if (loaded.length === 0) {
    console.error(
      `Built-in NOW templates unreadable. Tried: ${CWD_TEMPLATES_DIR}, ${MODULE_TEMPLATES_DIR}`
    );
    return NextResponse.json({ error: UNAVAILABLE_MESSAGE }, { status: 503 });
  }

  const imported: TemplateDto[] = [];
  const skipped: string[] = [...unreadable];

  try {
    const existing = await db.template.findMany({
      where: { userId },
      select: { name: true },
    });
    const existingNames = new Set(
      existing.map((template) => template.name.toLowerCase())
    );

    for (const entry of loaded) {
      if (existingNames.has(entry.name.toLowerCase())) {
        skipped.push(entry.name);
        continue;
      }

      const template = await db.template.create({
        data: {
          userId,
          name: entry.name,
          description: `Ingebouwde Amsterdam NOW-template (templates/now/${entry.spec.file}).`,
          html: entry.html,
          // Extracted from the file itself rather than copied from the
          // manifest, so the preview substitution can never miss a token.
          placeholders: extractPlaceholders(entry.html),
          width: entry.spec.dimensions.width,
          height: entry.spec.dimensions.height,
        },
      });

      existingNames.add(entry.name.toLowerCase());
      imported.push(serializeTemplate(template));
    }
  } catch (error) {
    console.error("Failed to import built-in templates:", error);
    return NextResponse.json(
      { error: "De ingebouwde templates konden niet worden opgeslagen." },
      { status: 500 }
    );
  }

  return NextResponse.json({ imported, skipped });
}
