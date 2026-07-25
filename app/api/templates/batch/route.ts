import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveApiUserId } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { analyzeTemplateHtml } from "@/lib/template-analysis";
import {
  extractPlaceholders,
  serializeTemplate,
  type TemplateDto,
} from "@/lib/uploaded-templates";

export const runtime = "nodejs";

const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 1350;

const batchItemSchema = z.object({
  // Names come from filenames, so they are normalized per item below rather
  // than rejected: one awkward filename must not fail the whole batch.
  name: z.string().max(300),
  html: z.string().min(1).max(5_000_000),
  description: z.string().max(300).optional(),
  width: z.number().int().min(100).max(4000).optional(),
  height: z.number().int().min(100).max(4000).optional(),
});

const batchSchema = z.object({
  items: z.array(batchItemSchema).min(1).max(25),
});

interface FailedItem {
  index: number;
  name: string;
  error: string;
}

/**
 * POST /api/templates/batch
 * Body: { items: [{ name, html, description?, width?, height? }] } — 1..25 items.
 *
 * Creates every item. A failing item does not abort the batch: it lands in
 * `failed` with its original index so the UI can point at the right row.
 * Missing width/height are detected from the HTML, falling back to 1080x1350.
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

  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const created: TemplateDto[] = [];
  const failed: FailedItem[] = [];

  for (const [index, item] of parsed.data.items.entries()) {
    const name = item.name.trim().slice(0, 100) || `Template ${index + 1}`;

    try {
      const needsDetection = item.width === undefined || item.height === undefined;
      const analysis = needsDetection ? analyzeTemplateHtml(item.html) : null;

      const template = await db.template.create({
        data: {
          userId,
          name,
          description: item.description ?? null,
          html: item.html,
          placeholders: analysis?.placeholders ?? extractPlaceholders(item.html),
          width: item.width ?? analysis?.width ?? DEFAULT_WIDTH,
          height: item.height ?? analysis?.height ?? DEFAULT_HEIGHT,
        },
      });

      created.push(serializeTemplate(template));
    } catch (error) {
      console.error(`Failed to create template at index ${index}:`, error);
      failed.push({
        index,
        name,
        error: "Deze template kon niet worden opgeslagen.",
      });
    }
  }

  return NextResponse.json({ created, failed });
}
