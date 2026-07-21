import { NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/auth";
import { db } from "@/lib/db";
import { WordPressApiError, getPosts } from "@/lib/wordpress";
import {
  WordPressConnectionNotFoundError,
  getWordPressCredentials,
} from "@/lib/wordpress-connection";

const importSchema = z.object({
  connectionId: z.string().trim().min(1, "connectionId is required"),
  count: z.number().int().min(1).max(50).optional().default(10),
});

const WP_ERROR_STATUS: Record<WordPressApiError["code"], number> = {
  unreachable: 503,
  not_wordpress: 502,
  unauthorized: 401,
  not_found: 404,
  unknown: 502,
};

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  const parsed = importSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input.", issues: z.treeifyError(parsed.error) },
      { status: 400 }
    );
  }

  const { connectionId, count } = parsed.data;

  try {
    const credentials = await getWordPressCredentials(connectionId, userId);

    const posts = await getPosts(credentials, { page: 1, perPage: count });

    const existingIds = new Set(
      (
        await db.article.findMany({
          where: {
            connectionId,
            wordpressId: { in: posts.map((post) => post.wordpressId) },
          },
          select: { wordpressId: true },
        })
      ).map((row) => row.wordpressId)
    );

    for (const post of posts) {
      const publishedAt = post.publishedAt ? new Date(post.publishedAt) : null;

      await db.article.upsert({
        where: {
          connectionId_wordpressId: {
            connectionId,
            wordpressId: post.wordpressId,
          },
        },
        create: {
          connectionId,
          wordpressId: post.wordpressId,
          title: post.title,
          content: post.content,
          excerpt: post.excerpt,
          imageUrl: post.featuredImageUrl,
          categories: post.categories,
          tags: post.tags,
          publishedAt,
          status: "IMPORTED",
        },
        update: {
          title: post.title,
          content: post.content,
          excerpt: post.excerpt,
          imageUrl: post.featuredImageUrl,
          categories: post.categories,
          tags: post.tags,
          publishedAt,
          // Status is intentionally left untouched on update: a re-import
          // shouldn't regress an article that already progressed further
          // through the carousel pipeline (GENERATING/GENERATED/PUBLISHED).
        },
      });
    }

    const created = posts.filter((post) => !existingIds.has(post.wordpressId)).length;
    const updated = posts.length - created;

    return NextResponse.json(
      {
        imported: posts.length,
        created,
        updated,
        connectionId,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof WordPressConnectionNotFoundError) {
      return NextResponse.json(
        { error: "WordPress connection not found." },
        { status: 404 }
      );
    }

    if (error instanceof WordPressApiError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: WP_ERROR_STATUS[error.code] }
      );
    }

    console.error("Failed to import WordPress posts:", error);
    return NextResponse.json(
      { error: "Something went wrong while importing posts." },
      { status: 500 }
    );
  }
}
