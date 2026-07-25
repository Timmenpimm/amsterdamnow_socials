import { NextResponse } from "next/server";

import { resolveApiUserId } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { substituteSampleValues } from "@/lib/uploaded-templates";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/templates/[id]/preview — the stored template HTML with every
 * {{placeholder}} replaced by a sample value, served as sandboxed HTML.
 */
export async function GET(request: Request, { params }: RouteParams) {
  const userId = await resolveApiUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const template = await db.template.findFirst({
      where: { id, userId },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Template not found." },
        { status: 404 }
      );
    }

    const placeholders = Array.isArray(template.placeholders)
      ? (template.placeholders as string[])
      : [];

    const html = substituteSampleValues(template.html, placeholders);

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Security-Policy": "sandbox allow-same-origin",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Failed to render template preview:", error);
    return NextResponse.json(
      { error: "Something went wrong while rendering the preview." },
      { status: 500 }
    );
  }
}
