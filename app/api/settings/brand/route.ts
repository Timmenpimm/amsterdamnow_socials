import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveApiUserId } from "@/lib/api-auth";
import {
  brandSettingsSchema,
  getBrandSettings,
  saveBrandSettings,
} from "@/lib/connections";

export async function GET(request: Request) {
  const userId = await resolveApiUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const settings = await getBrandSettings(userId);
  return NextResponse.json({ settings });
}

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

  const parsed = brandSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const settings = await saveBrandSettings(userId, parsed.data);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Failed to save brand settings:", error);
    return NextResponse.json(
      { error: "Something went wrong while saving brand settings." },
      { status: 500 }
    );
  }
}
