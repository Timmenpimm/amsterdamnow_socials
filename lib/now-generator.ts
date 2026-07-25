import "server-only";

import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

import { stripHtml } from "@/lib/carousel-prompt";
import {
  buildNowDraftSchema,
  buildNowSlides,
  getNowFamilyPlan,
  textPlaceholders,
  validateNowSlides,
  type NowCarouselDraft,
  type NowStoredSlide,
} from "@/lib/now-carousel";
import {
  buildNowSystemPrompt,
  buildNowUserPrompt,
} from "@/lib/now-carousel-prompt";
import { InvalidCarouselOutputError, MissingOpenAiKeyError } from "@/lib/openai";
import type { NowTemplateFamily } from "@/templates/now/manifest";

/**
 * AI generation for the Amsterdam NOW carousels. Mirrors lib/openai.ts
 * (same provider setup, same MOCK_AI path, same error classes so
 * /api/generate keeps its existing 503/502 mapping), but produces
 * manifest-shaped slides instead of the generic satori Slide[].
 */

const DEFAULT_MODEL = "gpt-4o-mini";

/** Deterministic number of repeats used by the MOCK_AI path. */
const MOCK_REPEATS = 3;

/** Minimal article shape the NOW generator needs. */
export interface NowArticleLike {
  title: string;
  content: string;
  excerpt?: string | null;
}

export interface GenerateNowCarouselOptions {
  /** Article/featured image — becomes the cover image of the carousel. */
  imageUrl?: string | null;
  /** Optional per-item images, in order, for the repeated slides. */
  itemImageUrls?: string[];
}

export interface NowCarouselContent {
  slides: NowStoredSlide[];
  caption: string;
  hashtags: string[];
}

/**
 * Thrown when the generated slides don't satisfy the template manifest.
 * Extends InvalidCarouselOutputError so callers that already map that to a
 * 502 keep working; the concrete problems travel along as the `cause`.
 */
export class InvalidNowSlidesError extends InvalidCarouselOutputError {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(problems.join(" | "));
    this.name = "InvalidNowSlidesError";
    this.message = `NOW-carousel is niet renderbaar: ${problems.join(" | ")}`;
    this.problems = problems;
  }
}

/** The draft schema of a family plus the caption/hashtags fields, as one object. */
function buildNowGenerationSchema(family: NowTemplateFamily) {
  const draftShape = buildNowDraftSchema(family).shape;

  return z.object({
    ...draftShape,
    caption: z
      .string()
      .max(2200)
      .describe("Instagram-caption in de Amsterdam NOW-toon."),
    hashtags: z
      .array(z.string().min(1).max(100))
      .min(8)
      .max(12)
      .describe("8 tot 12 hashtags zonder #."),
  });
}

/**
 * Deterministic stand-in for the model, used by MOCK_AI=1 so the whole
 * pipeline (prompt building, schema, slide mapping, validation) can be
 * smoke-tested without an API key — mirrors lib/openai.ts's mock path.
 */
function buildMockNowDraft(
  family: NowTemplateFamily,
  title: string
): NowCarouselDraft {
  const plan = getNowFamilyPlan(family);
  const draft: NowCarouselDraft = {};

  for (const step of plan.steps) {
    const placeholders = textPlaceholders(family, step.slideType);
    const makeEntry = (position: number): Record<string, string> => {
      const entry: Record<string, string> = {};
      for (const placeholder of placeholders) {
        entry[placeholder.name] =
          `[MOCK] ${placeholder.name} ${position} — ${title}`.slice(0, 120);
      }
      return entry;
    };

    if (step.max > 1) {
      const count = Math.min(Math.max(step.min, MOCK_REPEATS), step.max);
      draft[step.slideType] = Array.from({ length: count }, (_, i) =>
        makeEntry(i + 1)
      );
    } else {
      draft[step.slideType] = makeEntry(1);
    }
  }

  return draft;
}

const MOCK_HASHTAGS = [
  "amsterdam",
  "amsterdamnow",
  "stadsgids",
  "mock",
  "smoketest",
  "uitinamsterdam",
  "hotspot",
  "redactie",
];

/**
 * Generates one Amsterdam NOW carousel for an article.
 *
 * The model fills only the text tokens the manifest declares as writable;
 * images, numbering and layout direction are filled in deterministically by
 * buildNowSlides(). The result is validated against the manifest before it
 * is returned, so an unrenderable carousel is never stored silently.
 *
 * Throws MissingOpenAiKeyError (no key), InvalidCarouselOutputError (model
 * output failed the schema) or InvalidNowSlidesError (slides don't match
 * the manifest).
 */
export async function generateNowCarousel(
  article: NowArticleLike,
  family: NowTemplateFamily,
  opts: GenerateNowCarouselOptions = {}
): Promise<NowCarouselContent> {
  const cleanArticle = {
    title: article.title,
    excerpt: article.excerpt ?? "",
    content: stripHtml(article.content),
  };

  const images = {
    cover: opts.imageUrl ?? undefined,
    items: opts.itemImageUrls,
  };

  let draft: NowCarouselDraft;
  let caption: string;
  let hashtags: string[];

  // --- MOCK PATH (test/dev only) ---
  // Mirrors lib/openai.ts::generateCarousel: MOCK_AI=1 skips the model call
  // (and the API-key requirement) but keeps every other step intact.
  if (process.env.MOCK_AI === "1") {
    draft = buildMockNowDraft(family, cleanArticle.title);
    caption = `[MOCK] ${cleanArticle.title} — caption voor de ${family}-carousel.`;
    hashtags = MOCK_HASHTAGS;
  } else {
    // --- END MOCK PATH ---
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new MissingOpenAiKeyError();
    }

    const openai = createOpenAI({ apiKey });
    const model = openai(process.env.OPENAI_MODEL || DEFAULT_MODEL);

    let object: Record<string, unknown>;
    try {
      const result = await generateObject({
        model,
        schema: buildNowGenerationSchema(family),
        system: buildNowSystemPrompt(family),
        prompt: buildNowUserPrompt(cleanArticle, family),
      });
      object = result.object as Record<string, unknown>;
    } catch (error) {
      throw new InvalidCarouselOutputError(error);
    }

    const {
      caption: generatedCaption,
      hashtags: generatedHashtags,
      ...rest
    } = object;

    draft = rest as NowCarouselDraft;
    caption = String(generatedCaption ?? "");
    hashtags = (generatedHashtags as string[] | undefined) ?? [];
  }

  const slides = buildNowSlides(family, draft, images);

  const problems = validateNowSlides(family, slides);
  if (problems.length > 0) {
    throw new InvalidNowSlidesError(problems);
  }

  return { slides, caption, hashtags };
}
