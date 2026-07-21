import "server-only";

import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

import {
  buildCarouselSystemPrompt,
  buildCarouselUserPrompt,
  stripHtml,
} from "@/lib/carousel-prompt";
import type { CarouselContent, Slide, SlideLayout } from "@/types/carousel";
import type { WordPressPost } from "@/types/wordpress";

const DEFAULT_MODEL = "gpt-4o-mini";
const DEFAULT_SLIDE_COUNT = 6;
const DEFAULT_LANGUAGE = "nl";
const DEFAULT_TONE = "editorial";

export interface GenerateCarouselOptions {
  slideCount?: number;
  language?: string;
  tone?: string;
}

/** Minimal article shape accepted alongside the full WordPressPost. */
export type ArticleLike =
  | WordPressPost
  | { title: string; content: string; excerpt?: string | null };

/** Thrown when OPENAI_API_KEY is missing so callers can map it to a 503. */
export class MissingOpenAiKeyError extends Error {
  constructor() {
    super("OPENAI_API_KEY is not configured on the server.");
    this.name = "MissingOpenAiKeyError";
  }
}

/** Thrown when the model's output fails to satisfy CarouselContent's rules. */
export class InvalidCarouselOutputError extends Error {
  constructor(cause?: unknown) {
    super("AI response did not match the expected carousel structure.");
    this.name = "InvalidCarouselOutputError";
    this.cause = cause;
  }
}

const SLIDE_LAYOUTS = [
  "hero",
  "text",
  "list",
  "quote",
  "image",
  "cta",
] as const satisfies readonly SlideLayout[];

// Mirrors types/carousel.ts Slide, minus `imageUrl` (populated later by the
// rendering pipeline, not by the language model) and with a business-rule
// check that slide 0 is "hero" and the final slide is "cta".
const slideSchema = z.object({
  index: z.number().int().min(0),
  layout: z.enum(SLIDE_LAYOUTS),
  headline: z.string().trim().min(1).max(220),
  body: z.string().trim().max(500).optional(),
  imagePrompt: z.string().trim().max(500).optional(),
});

const carouselContentSchema = z
  .object({
    title: z.string().trim().min(1),
    slides: z.array(slideSchema).min(2).max(20),
    caption: z.string().trim().min(1),
    hashtags: z.array(z.string().trim().min(1)).min(1).max(30),
  })
  .superRefine((value, ctx) => {
    const firstLayout = value.slides[0]?.layout;
    const lastLayout = value.slides[value.slides.length - 1]?.layout;

    if (firstLayout !== "hero") {
      ctx.addIssue({
        code: "custom",
        message: "The first slide must use layout \"hero\".",
        path: ["slides", 0, "layout"],
      });
    }

    if (lastLayout !== "cta") {
      ctx.addIssue({
        code: "custom",
        message: "The last slide must use layout \"cta\".",
        path: ["slides", value.slides.length - 1, "layout"],
      });
    }
  });

function toCleanArticle(article: ArticleLike) {
  return {
    title: article.title,
    excerpt: "excerpt" in article ? (article.excerpt ?? "") : "",
    content: stripHtml(article.content),
  };
}

/** Re-numbers slides 0..n-1 by array position, ignoring whatever index the model returned. */
function reindexSlides(slides: z.infer<typeof slideSchema>[]): Slide[] {
  return slides.map((slide, index) => ({
    ...slide,
    index,
  }));
}

/**
 * Generates structured Instagram carousel content for an article using the
 * Vercel AI SDK's generateObject with a zod schema mirroring CarouselContent.
 *
 * Throws MissingOpenAiKeyError if OPENAI_API_KEY is not configured, and
 * InvalidCarouselOutputError if the model's output fails validation.
 */
export async function generateCarousel(
  article: ArticleLike,
  opts: GenerateCarouselOptions = {}
): Promise<CarouselContent> {
  const promptOptions = {
    slideCount: opts.slideCount ?? DEFAULT_SLIDE_COUNT,
    language: opts.language ?? DEFAULT_LANGUAGE,
    tone: opts.tone ?? DEFAULT_TONE,
  };

  const cleanArticle = toCleanArticle(article);

  // --- MOCK PATH (test/dev only) ---
  // scripts/test-generate.ts sets MOCK_AI=1 to smoke-test the full pipeline
  // (prompt building + zod schema validation + slide reindexing) without
  // calling OpenAI or requiring an API key. This is the lowest-level place
  // the real model call happens, so it's the only place mocked.
  if (process.env.MOCK_AI === "1") {
    const mock = buildMockCarouselContent(
      cleanArticle.title,
      promptOptions.slideCount
    );
    const parsed = carouselContentSchema.parse(mock);
    return { ...parsed, slides: reindexSlides(parsed.slides) };
  }
  // --- END MOCK PATH ---

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new MissingOpenAiKeyError();
  }

  const openai = createOpenAI({ apiKey });
  const model = openai(process.env.OPENAI_MODEL || DEFAULT_MODEL);

  let object: z.infer<typeof carouselContentSchema>;
  try {
    const result = await generateObject({
      model,
      schema: carouselContentSchema,
      system: buildCarouselSystemPrompt(promptOptions),
      prompt: buildCarouselUserPrompt(cleanArticle, promptOptions),
    });
    object = result.object;
  } catch (error) {
    throw new InvalidCarouselOutputError(error);
  }

  return { ...object, slides: reindexSlides(object.slides) };
}

function buildMockCarouselContent(
  title: string,
  slideCount: number
): z.infer<typeof carouselContentSchema> {
  const count = Math.max(2, slideCount);
  const middleLayouts: SlideLayout[] = ["text", "list", "quote", "image"];

  const slides: z.infer<typeof slideSchema>[] = Array.from(
    { length: count },
    (_, i) => {
      if (i === 0) {
        return {
          index: 0,
          layout: "hero" as const,
          headline: `[MOCK] ${title || "Sample article"}`,
          body: "Mock hero body copy for smoke-testing without an API key.",
          imagePrompt: "Mock hero image prompt.",
        };
      }
      if (i === count - 1) {
        return {
          index: i,
          layout: "cta" as const,
          headline: "[MOCK] Read the full story",
          body: "Mock call-to-action body copy.",
          imagePrompt: "Mock cta image prompt.",
        };
      }
      return {
        index: i,
        layout: middleLayouts[(i - 1) % middleLayouts.length],
        headline: `[MOCK] Slide ${i} headline`,
        body: `Mock body copy for slide ${i}.`,
        imagePrompt: `Mock image prompt for slide ${i}.`,
      };
    }
  );

  return {
    title: `[MOCK] ${title || "Sample article"}`,
    slides,
    caption: "[MOCK] Sample caption with hook, context and a call to action.",
    hashtags: [
      "mock",
      "smoketest",
      "amsterdamnow",
      "sample",
      "carousel",
      "editorial",
      "contenttest",
      "dryrun",
    ],
  };
}
