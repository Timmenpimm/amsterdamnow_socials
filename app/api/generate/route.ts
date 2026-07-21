import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  InvalidCarouselOutputError,
  MissingOpenAiKeyError,
  generateCarousel,
} from "@/lib/openai";

export const runtime = "nodejs";

const DEFAULT_TEMPLATE = "default";

const generateRequestSchema = z.object({
  articleId: z.string().trim().min(1, "articleId is required"),
  template: z.string().trim().min(1).max(100).optional(),
});

/**
 * POST /api/generate
 * Body: { articleId: string, template?: string }
 *
 * Generates AI carousel content for one of the current user's articles and
 * stores it as a new Carousel row (status DRAFT). Article.status tracks the
 * generation lifecycle: GENERATING while running, GENERATED on success,
 * FAILED on error.
 */
export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // Fail fast, before touching the database, if AI generation isn't
  // configured. MOCK_AI=1 (test/dev smoke path) bypasses the key
  // requirement — see lib/openai.ts.
  const aiConfigured =
    Boolean(process.env.OPENAI_API_KEY) || process.env.MOCK_AI === "1";
  if (!aiConfigured) {
    return NextResponse.json(
      {
        error:
          "AI generation is not configured: OPENAI_API_KEY is missing on the server.",
      },
      { status: 503 }
    );
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

  const parsed = generateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const { articleId, template } = parsed.data;

  const article = await db.article.findUnique({
    where: { id: articleId },
    include: { connection: { select: { userId: true } } },
  });

  // Same 404 whether the article doesn't exist or belongs to someone else —
  // avoid leaking which article IDs exist.
  if (!article || article.connection.userId !== userId) {
    return NextResponse.json({ error: "Article not found." }, { status: 404 });
  }

  await db.article.update({
    where: { id: article.id },
    data: { status: "GENERATING" },
  });

  try {
    const content = await generateCarousel({
      title: article.title,
      content: article.content,
      excerpt: article.excerpt,
    });

    const carousel = await db.carousel.create({
      data: {
        articleId: article.id,
        template: template ?? DEFAULT_TEMPLATE,
        // Slide[] is a JSON-serializable shape (see types/carousel.ts) but
        // isn't structurally identical to Prisma's generic Json input type.
        slides: content.slides as unknown as Prisma.InputJsonValue,
        caption: content.caption,
        hashtags: content.hashtags,
        status: "DRAFT",
      },
    });

    await db.article.update({
      where: { id: article.id },
      data: { status: "GENERATED" },
    });

    return NextResponse.json({ carousel }, { status: 201 });
  } catch (error) {
    await db.article.update({
      where: { id: article.id },
      data: { status: "FAILED" },
    });

    if (error instanceof MissingOpenAiKeyError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    if (error instanceof InvalidCarouselOutputError) {
      console.error("Carousel generation produced invalid output:", error.cause);
      return NextResponse.json(
        {
          error:
            "AI generation did not produce a valid carousel structure. Please try again.",
        },
        { status: 502 }
      );
    }

    console.error("Carousel generation failed unexpectedly:", error);
    return NextResponse.json(
      { error: "Something went wrong while generating the carousel." },
      { status: 500 }
    );
  }
}
