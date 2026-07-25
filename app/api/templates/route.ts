import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveApiUserId } from "@/lib/api-auth";
import { db } from "@/lib/db";
import {
  extractPlaceholders,
  serializeTemplate,
} from "@/lib/uploaded-templates";

const templateCreateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  html: z.string().min(1).max(5_000_000),
  width: z.number().int().min(100).max(4000).optional(),
  height: z.number().int().min(100).max(4000).optional(),
});

/** GET /api/templates — the current user's templates, newest first. */
export async function GET(request: Request) {
  const userId = await resolveApiUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const templates = await db.template.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ templates: templates.map(serializeTemplate) });
  } catch (error) {
    console.error("Failed to load templates:", error);
    return NextResponse.json(
      { error: "Something went wrong while loading templates." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/templates
 * Body: { name, description?, html, width?, height? }
 *
 * Placeholders are extracted server-side from the HTML. Templates without
 * any {{placeholder}} tokens are allowed (static slides) and store [].
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

  const parsed = templateCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const { name, description, html, width, height } = parsed.data;

  try {
    const template = await db.template.create({
      data: {
        userId,
        name,
        description: description ?? null,
        html,
        placeholders: extractPlaceholders(html),
        width: width ?? 1080,
        height: height ?? 1350,
      },
    });

    return NextResponse.json(
      { template: serializeTemplate(template) },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create template:", error);
    return NextResponse.json(
      { error: "Something went wrong while creating the template." },
      { status: 500 }
    );
  }
}
