import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveApiUserId } from "@/lib/api-auth";
import {
  getInstagramConnection,
  instagramConnectionSchema,
  saveInstagramConnection,
} from "@/lib/connections";

export async function GET(request: Request) {
  const userId = await resolveApiUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const connection = await getInstagramConnection(userId);
  return NextResponse.json({ connection });
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

  const parsed = instagramConnectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const connection = await saveInstagramConnection(userId, parsed.data);
    return NextResponse.json({ connection });
  } catch (error) {
    console.error("Failed to save Instagram connection:", error);
    return NextResponse.json(
      { error: "Something went wrong while saving the connection." },
      { status: 500 }
    );
  }
}
