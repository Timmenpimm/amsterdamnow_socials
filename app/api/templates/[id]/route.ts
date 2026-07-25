import { NextResponse } from "next/server";

import { resolveApiUserId } from "@/lib/api-auth";
import { db } from "@/lib/db";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** DELETE /api/templates/[id] — deletes one of the current user's templates. */
export async function DELETE(request: Request, { params }: RouteParams) {
  const userId = await resolveApiUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { id } = await params;

  try {
    const { count } = await db.template.deleteMany({
      where: { id, userId },
    });

    if (count === 0) {
      return NextResponse.json(
        { error: "Template not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete template:", error);
    return NextResponse.json(
      { error: "Something went wrong while deleting the template." },
      { status: 500 }
    );
  }
}
