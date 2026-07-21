import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { instagramTestSchema, testInstagramConnection } from "@/lib/connections";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: unknown = {};
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const parsed = instagramTestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  try {
    const result = await testInstagramConnection(session.user.id, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to test Instagram connection:", error);
    return NextResponse.json(
      { ok: false, error: "Something went wrong while testing the connection." },
      { status: 500 }
    );
  }
}
