import "server-only";

import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

import { stripHtml } from "@/lib/carousel-prompt";
import {
  buildNowDraftSchema,
  buildNowSlides,
  cleanNowText,
  getNowFamilyPlan,
  slideTemplateFamily,
  textPlaceholders,
  validateNowSlides,
  type NowCarouselDraft,
  type NowStoredSlide,
} from "@/lib/now-carousel";
import {
  buildNowSlideSystemPrompt,
  buildNowSlideUserPrompt,
  buildNowSystemPrompt,
  buildNowUserPrompt,
} from "@/lib/now-carousel-prompt";
import type { NowItemImage } from "@/lib/now-item-images";
import {
  InvalidCarouselOutputError,
  InvalidSlideOutputError,
  MissingOpenAiKeyError,
  SlideNotFoundError,
} from "@/lib/openai";
import {
  getNowTemplateSpec,
  type NowPlaceholderSpec,
  type NowTemplateFamily,
  type NowTemplateSpec,
} from "@/templates/now/manifest";

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
  /**
   * Naam van de zaak → foto van díe zaak. Het model kiest zelf welke items van
   * het artikel de carousel halen, dus zonder deze koppeling staat er bij een
   * niet-oplopende keuze een foto van de verkeerde zaak. Zie
   * lib/now-item-images.ts.
   */
  itemImages?: NowItemImage[];
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

    if (step.max > 1) {
      const count = Math.min(Math.max(step.min, MOCK_REPEATS), step.max);
      draft[step.slideType] = Array.from({ length: count }, (_, i) =>
        buildMockValues(placeholders, i + 1, title)
      );
    } else {
      draft[step.slideType] = buildMockValues(placeholders, 1, title);
    }
  }

  return draft;
}

/** One mock entry: every writable token filled with a recognisable stub. */
function buildMockValues(
  placeholders: NowPlaceholderSpec[],
  position: number,
  title: string
): Record<string, string> {
  const entry: Record<string, string> = {};
  for (const placeholder of placeholders) {
    entry[placeholder.name] =
      `[MOCK] ${placeholder.name} ${position} — ${title}`.slice(0, 120);
  }
  return entry;
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
    // Ook de titel door stripHtml: die belandt letterlijk op de coverslide, en
    // WordPress levert hem met entiteiten (&amp;, &#8216;, &nbsp;) aan.
    title: stripHtml(article.title),
    excerpt: article.excerpt ?? "",
    content: stripHtml(article.content),
  };

  const images = {
    cover: opts.imageUrl ?? undefined,
    items: opts.itemImageUrls,
    byName: opts.itemImages,
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

  const slides = buildNowSlides(family, draft, images, cleanArticle.title);

  const problems = validateNowSlides(family, slides);
  if (problems.length > 0) {
    throw new InvalidNowSlidesError(problems);
  }

  return { slides, caption, hashtags };
}

/**
 * Tokens die de applicatie zelf invult: de foto, de layoutrichting, het
 * volgnummer, het aantal items en de artikeltitel. Een regeneratie neemt die
 * ongewijzigd over uit de bestaande slide, zodat beeld en nummering niet
 * verspringen — en zodat de coverkop (die de redacteur mogelijk zelf heeft
 * ingekort) niet wegvalt bij het herschrijven van die slide.
 */
function isAutoFilled(placeholder: NowPlaceholderSpec): boolean {
  return Boolean(
    placeholder.isUrl ||
      placeholder.enumValues ||
      placeholder.zeroPadTo ||
      placeholder.autoCount ||
      placeholder.fromArticleTitle
  );
}

/** validateNowSlides nummert vanaf de arraypositie; dit zet het echte nummer terug. */
function relabel(problems: string[], slideIndex: number): string[] {
  return problems.map((problem) =>
    problem.replace(/^Slide 1\b/, `Slide ${slideIndex + 1}`)
  );
}

/**
 * Herschrijft de tekst van één slide van een bestaande NOW-carousel; alle
 * andere slides blijven ongemoeid. Het model krijgt het artikel plus een korte
 * samenvatting van de overige slides mee, zodat de nieuwe tekst niet herhaalt
 * wat er al staat.
 *
 * Gooit SlideNotFoundError (index bestaat niet), MissingOpenAiKeyError,
 * InvalidSlideOutputError (model-output faalde het schema) of
 * InvalidNowSlidesError (resultaat past niet bij het manifest).
 */
export async function regenerateNowSlide(
  article: NowArticleLike,
  family: NowTemplateFamily,
  slides: readonly NowStoredSlide[],
  slideIndex: number
): Promise<NowStoredSlide> {
  const target = slides.find((slide) => slide.index === slideIndex);
  if (!target) {
    throw new SlideNotFoundError(slideIndex);
  }

  // Een slide mag het template van een andere familie lenen, dus resolve per
  // slide in plaats van de familie van de carousel aan te nemen.
  const resolved = slideTemplateFamily(family, target);
  let spec: NowTemplateSpec;
  try {
    spec = getNowTemplateSpec(resolved, target.slideType);
  } catch {
    throw new InvalidNowSlidesError([
      `Slide ${slideIndex + 1}: onbekend slidetype "${target.slideType}" voor familie ${resolved}.`,
    ]);
  }

  const writable = textPlaceholders(resolved, target.slideType);
  const written = await writeNowSlideText(article, family, slides, slideIndex, {
    resolved,
    slideType: target.slideType,
    writable,
  });

  const values: Record<string, string> = {};
  for (const placeholder of spec.placeholders) {
    values[placeholder.name] = isAutoFilled(placeholder)
      ? (target.values[placeholder.name] ?? "")
      : cleanNowText(
          written[placeholder.name] ?? target.values[placeholder.name] ?? ""
        );
  }

  const slide: NowStoredSlide = {
    index: target.index,
    slideType: target.slideType,
    values,
    ...(target.family ? { family: target.family } : {}),
  };

  const problems = validateNowSlides(family, [slide]);
  if (problems.length > 0) {
    throw new InvalidNowSlidesError(relabel(problems, slideIndex));
  }

  return slide;
}

/**
 * De modelaanroep achter regenerateNowSlide: levert alleen de tekstvelden van
 * de gevraagde slide. Slides zonder tekstveld (een volledig vormgegeven CTA)
 * en MOCK_AI=1 slaan de aanroep over, net als generateNowCarousel.
 */
async function writeNowSlideText(
  article: NowArticleLike,
  family: NowTemplateFamily,
  slides: readonly NowStoredSlide[],
  slideIndex: number,
  target: {
    resolved: NowTemplateFamily;
    slideType: NowStoredSlide["slideType"];
    writable: NowPlaceholderSpec[];
  }
): Promise<Record<string, string>> {
  if (target.writable.length === 0) {
    return {};
  }

  // --- MOCK PATH (test/dev only) — zie generateNowCarousel. ---
  if (process.env.MOCK_AI === "1") {
    return buildMockValues(target.writable, slideIndex + 1, article.title);
  }
  // --- END MOCK PATH ---

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new MissingOpenAiKeyError();
  }

  const shape: Record<string, z.ZodTypeAny> = {};
  for (const placeholder of target.writable) {
    shape[placeholder.name] = z
      .string()
      .max(400)
      .describe(placeholder.description);
  }

  const openai = createOpenAI({ apiKey });
  const model = openai(process.env.OPENAI_MODEL || DEFAULT_MODEL);

  try {
    const result = await generateObject({
      model,
      schema: z.object(shape),
      system: buildNowSlideSystemPrompt(
        target.resolved,
        target.slideType,
        target.writable
      ),
      prompt: buildNowSlideUserPrompt(
        {
          title: article.title,
          excerpt: article.excerpt ?? "",
          content: stripHtml(article.content),
        },
        family,
        slides,
        slideIndex,
        (slide) => slideTemplateFamily(family, slide)
      ),
    });
    return result.object as Record<string, string>;
  } catch (error) {
    throw new InvalidSlideOutputError(error);
  }
}
