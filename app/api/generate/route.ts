import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { resolveApiUserId } from "@/lib/api-auth";
import { db } from "@/lib/db";
import { isNowTemplateId, parseNowTemplateId } from "@/lib/now-carousel";
import { generateNowCarousel } from "@/lib/now-generator";
import {
  InvalidCarouselOutputError,
  MissingOpenAiKeyError,
  generateCarousel,
} from "@/lib/openai";
import { TEMPLATE_IDS, isTemplateId } from "@/templates";

export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_TEMPLATE = TEMPLATE_IDS[0];

/**
 * Inline article payload for external callers (e.g. the artikel-tool) that
 * push content directly instead of importing it from WordPress first. The
 * article is upserted on [connectionId, wordpressId] before generation.
 */
const inlineArticleSchema = z.object({
  wordpressId: z.number().int().positive(),
  title: z.string().trim().min(1).max(500),
  contentHtml: z.string().min(1).max(100_000),
  excerpt: z.string().optional(),
  imageUrl: z.string().url().optional(),
  // De eerste URL is het uitgelichte beeld. De resterende beelden worden
  // uitsluitend door NOW-templates gebruikt voor detail-/itemslides; de
  // generieke satori-generator kent alleen imageUrl.
  imageUrls: z.array(z.string().url()).max(20).optional(),
  categories: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

/**
 * Template id: one of the generic satori templates, or an Amsterdam NOW
 * family (`now:hotspot`, `now:lijstje`, …). NOW ids are checked via
 * isNowTemplateId() so adding a family to NOW_FAMILY_PLANS is enough — no
 * list to keep in sync here.
 */
const templateSchema = z
  .string()
  .trim()
  .refine((value) => isTemplateId(value) || isNowTemplateId(value), {
    message: `template must be one of ${TEMPLATE_IDS.join(", ")} or a "now:<family>" id`,
  });

const generateRequestSchema = z.union([
  z.object({
    articleId: z.string().trim().min(1, "articleId is required"),
    template: templateSchema.optional(),
  }),
  z.object({
    article: inlineArticleSchema,
    template: templateSchema.optional(),
  }),
]);

/**
 * Fallback stub URL for the auto-created WordPressConnection when an
 * external caller pushes an inline article but has no connection yet.
 */
const STUB_CONNECTION_URL = "https://www.amsterdamnow.com";

/**
 * POST /api/generate
 * Body: { articleId: string, template?: string }
 *   or: { article: { wordpressId, title, contentHtml, ... }, template?: string }
 *
 * Generates AI carousel content for one of the current user's articles and
 * stores it as a new Carousel row (status DRAFT). `template` picks the
 * pipeline: a satori template id uses lib/openai.ts, a `now:<family>` id
 * uses lib/now-generator.ts. Article.status tracks the
 * generation lifecycle: GENERATING while running, GENERATED on success,
 * FAILED on error.
 *
 * The inline `article` variant upserts the Article row first (scoped to the
 * caller's WordPressConnection; a stub connection is created if none exists)
 * and then follows the exact same generation path.
 */
export async function POST(request: Request) {
  const userId = await resolveApiUserId(request);

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

  const { template } = parsed.data;

  let article: {
    id: string;
    title: string;
    content: string;
    excerpt: string | null;
    // Only read by the NOW generator (cover image); the satori path fills
    // images later in the render pipeline.
    imageUrl: string | null;
  };
  // Wordt niet in het bestaande Article-model opgeslagen: dit is de
  // volgorde van de actuele WordPress-media bij deze ene generatie.
  let itemImageUrls: string[] | undefined;

  if ("articleId" in parsed.data) {
    const { articleId } = parsed.data;

    const found = await db.article.findUnique({
      where: { id: articleId },
      include: { connection: { select: { userId: true } } },
    });

    // Same 404 whether the article doesn't exist or belongs to someone else —
    // avoid leaking which article IDs exist.
    if (!found || found.connection.userId !== userId) {
      return NextResponse.json({ error: "Article not found." }, { status: 404 });
    }

    article = found;
  } else {
    const input = parsed.data.article;
    const imageUrls = [...new Set(input.imageUrls ?? [])];
    const coverImageUrl = input.imageUrl ?? imageUrls[0] ?? null;
    itemImageUrls = imageUrls.filter((url) => url !== coverImageUrl);

    // Inline articles hang off the caller's WordPressConnection. External
    // callers may not have configured one yet, so fall back to a stub row
    // (created directly via Prisma — the settings-flow zod validation with
    // its min-length credential rules doesn't apply here). A plain "" for
    // appPassword is safe: decrypt() passes non-"enc:"-prefixed values
    // through unchanged.
    let connection = await db.wordPressConnection.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    if (!connection) {
      connection = await db.wordPressConnection.create({
        data: {
          userId,
          url: STUB_CONNECTION_URL,
          username: "",
          appPassword: "",
        },
      });
    }

    article = await db.article.upsert({
      where: {
        connectionId_wordpressId: {
          connectionId: connection.id,
          wordpressId: input.wordpressId,
        },
      },
      update: {
        title: input.title,
        content: input.contentHtml,
        excerpt: input.excerpt ?? null,
        imageUrl: coverImageUrl,
        categories: input.categories ?? [],
        tags: input.tags ?? [],
      },
      create: {
        connectionId: connection.id,
        wordpressId: input.wordpressId,
        title: input.title,
        content: input.contentHtml,
        excerpt: input.excerpt ?? null,
        imageUrl: coverImageUrl,
        categories: input.categories ?? [],
        tags: input.tags ?? [],
      },
    });
  }

  await db.article.update({
    where: { id: article.id },
    data: { status: "GENERATING" },
  });

  // `now:<family>` routes to the Amsterdam NOW generator (manifest-shaped
  // slides); anything else keeps the original satori path.
  const nowFamily = template ? parseNowTemplateId(template) : null;

  try {
    const content = nowFamily
      ? await generateNowCarousel(
          {
            title: article.title,
            content: article.content,
            excerpt: article.excerpt,
          },
          nowFamily,
          { imageUrl: article.imageUrl, itemImageUrls }
        )
      : await generateCarousel({
          title: article.title,
          content: article.content,
          excerpt: article.excerpt,
        });

    const carousel = await db.carousel.create({
      data: {
        articleId: article.id,
        template: template ?? DEFAULT_TEMPLATE,
        // Slide[] (types/carousel.ts) and NowStoredSlide[] (lib/now-carousel.ts)
        // are both JSON-serializable shapes, but neither is structurally
        // identical to Prisma's generic Json input type.
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
