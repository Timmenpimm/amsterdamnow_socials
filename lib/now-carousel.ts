import { z } from "zod";

import {
  NOW_TEMPLATE_MANIFEST,
  getNowTemplateSpec,
  type NowPlaceholderSpec,
  type NowSlideType,
  type NowTemplateFamily,
} from "@/templates/now/manifest";

/**
 * Bridges the Amsterdam NOW HTML templates (templates/now/) into the carousel
 * generator. Everything here is derived from the manifest, so adding a family
 * later only means adding a plan below — the AI schema, the prompt fields and
 * the slide mapping all follow automatically.
 *
 * Division of labour per placeholder:
 *   - isUrl        -> filled from the article's images, never invented by the AI
 *   - enumValues   -> cycled by position (layout_richting alternates)
 *   - zeroPadTo    -> the 1-based position within its repeated step
 *   - everything else -> written by the AI
 */

/** A NOW carousel stores `now:<family>` in Carousel.template. */
export const NOW_TEMPLATE_PREFIX = "now:";

export interface NowFamilyStep {
  slideType: NowSlideType;
  /** Minimum number of slides this step produces. */
  min: number;
  /** Maximum number of slides this step produces. */
  max: number;
  /**
   * Which family's manifest entry supplies the HTML for this step. Defaults
   * to the plan's own family; the lijstje carousel uses it to reuse the gids
   * item slide, exactly as the design board does.
   */
  templateFamily?: NowTemplateFamily;
}

export interface NowFamilyPlan {
  family: NowTemplateFamily;
  /** Dutch label for the dashboard. */
  label: string;
  /** What this carousel is for — also fed to the model. */
  purpose: string;
  steps: NowFamilyStep[];
  /**
   * Superseded by the current design set. Existing carousels keep rendering,
   * editing and publishing; the family is simply no longer offered when
   * creating something new.
   */
  retired?: boolean;
}

/**
 * Slide order per family. The sequences follow the design handoff
 * (docs/design/social-templates/HANDOFF-README.md and
 * CAROUSEL_PLACEHOLDERS.md); the min/max mirror the manifest's `reuse`.
 */
export const NOW_FAMILY_PLANS: readonly NowFamilyPlan[] = [
  {
    family: "hotspot",
    label: "Hotspot",
    purpose:
      "Eén nieuwe plek (restaurant, winkel, bar) uitgelicht: cover, statement, een paar detailslides en een afsluiter.",
    retired: true,
    steps: [
      { slideType: "cover", min: 1, max: 1 },
      { slideType: "statement", min: 1, max: 1 },
      { slideType: "detail", min: 1, max: 3 },
      { slideType: "cta", min: 1, max: 1 },
    ],
  },
  {
    // Het ontwerpbord "Carousel - Templates" vervangt de oude lijstje-opzet
    // (eigen cover/item/cta) door een wordmark-cover met de gids-item-slide.
    family: "lijstje",
    label: "Lijstje",
    purpose:
      "Genummerde ranglijst ('de 10 beste …'): cover met het aantal en de kop, daarna één genummerde slide per plek.",
    steps: [
      { slideType: "cover", min: 1, max: 1 },
      { slideType: "item", min: 3, max: 10, templateFamily: "gids" },
    ],
  },
  {
    family: "agenda",
    label: "Agenda",
    purpose:
      "Eén evenement: cover met datum, wat het is, praktische info en een afsluiter.",
    steps: [
      { slideType: "cover", min: 1, max: 1 },
      { slideType: "wat", min: 1, max: 1 },
      { slideType: "praktisch", min: 1, max: 1 },
      { slideType: "cta", min: 1, max: 1 },
    ],
  },
  {
    family: "gids",
    label: "Gids",
    purpose:
      "Themagids (bijvoorbeeld per buurt): cover, twee tot acht plekken met foto en korte tekst, afsluiter.",
    steps: [
      { slideType: "cover", min: 1, max: 1 },
      { slideType: "item", min: 2, max: 8 },
      { slideType: "cta", min: 1, max: 1 },
    ],
  },
  {
    family: "event",
    label: "Event (stories)",
    purpose:
      "Instagram Stories over één evenement, vier frames op 1080x1920: hook, reden, praktisch en een frame met ruimte voor de linksticker.",
    retired: true,
    steps: [
      { slideType: "hook", min: 1, max: 1 },
      { slideType: "reason", min: 1, max: 1 },
      { slideType: "practical", min: 1, max: 1 },
      { slideType: "link", min: 1, max: 1 },
    ],
  },
];

export type NowFamily = (typeof NOW_FAMILY_PLANS)[number]["family"];

export const NOW_TEMPLATE_IDS = NOW_FAMILY_PLANS.map(
  (plan) => `${NOW_TEMPLATE_PREFIX}${plan.family}` as const
);

export function nowTemplateId(family: NowTemplateFamily): string {
  return `${NOW_TEMPLATE_PREFIX}${family}`;
}

/** Returns the family for a `now:<family>` id, or null for anything else. */
export function parseNowTemplateId(
  templateId: string
): NowTemplateFamily | null {
  if (!templateId.startsWith(NOW_TEMPLATE_PREFIX)) {
    return null;
  }
  const family = templateId.slice(NOW_TEMPLATE_PREFIX.length);
  const plan = NOW_FAMILY_PLANS.find((p) => p.family === family);
  return plan ? plan.family : null;
}

export function isNowTemplateId(templateId: string): boolean {
  return parseNowTemplateId(templateId) !== null;
}

/** The families still offered when creating a new carousel. */
export function selectableNowFamilyPlans(): NowFamilyPlan[] {
  return NOW_FAMILY_PLANS.filter((plan) => !plan.retired);
}

/**
 * Which family's template renders this slide. A step may borrow another
 * family's slide (lijstje reuses the gids item), in which case the slide
 * carries that family; older slides without one use the carousel's family.
 */
export function slideTemplateFamily(
  carouselFamily: NowTemplateFamily,
  slide: { family?: string }
): NowTemplateFamily {
  const borrowed = slide.family;
  if (!borrowed) return carouselFamily;
  const known = NOW_FAMILY_PLANS.find((plan) => plan.family === borrowed);
  return known ? known.family : carouselFamily;
}

export function getNowFamilyPlan(family: NowTemplateFamily): NowFamilyPlan {
  const plan = NOW_FAMILY_PLANS.find((p) => p.family === family);
  if (!plan) {
    throw new Error(`No NOW carousel plan for family "${family}".`);
  }
  return plan;
}

/** Placeholders the model has to write: everything that isn't auto-filled. */
export function textPlaceholders(
  family: NowTemplateFamily,
  slideType: NowSlideType
): NowPlaceholderSpec[] {
  return getNowTemplateSpec(family, slideType).placeholders.filter(
    (p) => !p.isUrl && !p.enumValues && !p.zeroPadTo && !p.autoCount
  );
}

/**
 * Builds the structured-output schema for one family. Repeated steps become an
 * array, single steps an object; keys are the slide types. Fields are plain
 * required strings — OpenAI strict mode rejects optionals, and an empty string
 * is a valid value for these templates.
 */
export function buildNowDraftSchema(family: NowTemplateFamily) {
  const plan = getNowFamilyPlan(family);
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const step of plan.steps) {
    const fields: Record<string, z.ZodTypeAny> = {};
    for (const placeholder of textPlaceholders(
      step.templateFamily ?? family,
      step.slideType
    )) {
      fields[placeholder.name] = z
        .string()
        .max(400)
        .describe(placeholder.description);
    }

    const slideObject = z.object(fields);
    shape[step.slideType] =
      step.max > 1
        ? z.array(slideObject).min(step.min).max(step.max)
        : slideObject;
  }

  return z.object(shape);
}

export type NowCarouselDraft = Record<
  string,
  Record<string, string> | Record<string, string>[]
>;

/** A NOW slide as stored in Carousel.slides. */
export interface NowStoredSlide {
  index: number;
  slideType: NowSlideType;
  values: Record<string, string>;
  /** Set only when the slide borrows another family's template. */
  family?: NowTemplateFamily;
}

export const nowStoredSlideSchema = z.object({
  index: z.number().int().min(0),
  slideType: z.string().min(1),
  values: z.record(z.string(), z.string()),
  family: z.string().min(1).optional(),
});

export const nowStoredSlidesSchema = z.array(nowStoredSlideSchema).min(1);

export interface NowImageSources {
  /** Used for the cover/hero image of the carousel. */
  cover?: string;
  /** Used per repeated slide, in order; falls back to `cover` when absent. */
  items?: string[];
}

/**
 * Turns a model draft into manifest-complete slides: every placeholder the
 * template declares gets a value, so lib/renderer-now.ts never throws on a
 * missing token. Auto-filled tokens are documented at the top of this file.
 */
export function buildNowSlides(
  family: NowTemplateFamily,
  draft: NowCarouselDraft,
  images: NowImageSources = {}
): NowStoredSlide[] {
  const plan = getNowFamilyPlan(family);
  const slides: NowStoredSlide[] = [];

  // Hoeveel items levert de herhaalde stap? De cover noemt dat aantal, dus
  // het wordt geteld en niet door het model geschreven.
  const repeatedStep = plan.steps.find((step) => step.max > 1);
  const repeatedEntry = repeatedStep ? draft[repeatedStep.slideType] : undefined;
  const repeatedCount = Array.isArray(repeatedEntry) ? repeatedEntry.length : 0;

  for (const step of plan.steps) {
    const entry = draft[step.slideType];
    const entries: Record<string, string>[] = Array.isArray(entry)
      ? entry
      : entry
        ? [entry]
        : [];

    if (entries.length === 0) {
      throw new Error(
        `NOW draft is missing content for "${step.slideType}" (family ${family}).`
      );
    }

    entries.forEach((textValues, positionInStep) => {
      const templateFamily = step.templateFamily ?? family;
      const spec = getNowTemplateSpec(templateFamily, step.slideType);
      const values: Record<string, string> = {};

      for (const placeholder of spec.placeholders) {
        if (placeholder.isUrl) {
          values[placeholder.name] = pickImage(images, slides.length, positionInStep);
          continue;
        }
        if (placeholder.enumValues) {
          values[placeholder.name] =
            placeholder.enumValues[positionInStep % placeholder.enumValues.length];
          continue;
        }
        if (placeholder.autoCount) {
          values[placeholder.name] = String(repeatedCount);
          continue;
        }
        if (placeholder.zeroPadTo) {
          values[placeholder.name] = String(positionInStep + 1);
          continue;
        }
        values[placeholder.name] = cleanText(textValues[placeholder.name] ?? "");
      }

      slides.push({
        index: slides.length,
        slideType: step.slideType,
        values,
        ...(step.templateFamily ? { family: step.templateFamily } : {}),
      });
    });
  }

  return slides;
}

/**
 * Trims a model-written value and drops <br> tags at the start or end. The
 * model tends to append one to every field whose description mentions that
 * <br> is allowed, which renders as an empty line under the text.
 */
function cleanText(value: string): string {
  return value
    .replace(/^(?:\s*<br\s*\/?>)+/gi, "")
    .replace(/(?:<br\s*\/?>\s*)+$/gi, "")
    .trim();
}

function pickImage(
  images: NowImageSources,
  slideIndex: number,
  positionInStep: number
): string {
  if (slideIndex === 0) {
    return images.cover ?? "";
  }
  return images.items?.[positionInStep] ?? images.cover ?? "";
}

/**
 * Checks stored slides against the manifest before rendering: right slide
 * types for the family, every declared token present, no unknown tokens.
 * Returns the problems found; an empty array means the carousel is renderable.
 */
export function validateNowSlides(
  family: NowTemplateFamily,
  // Deliberately loose: checking whether `slideType` is one this family knows
  // is exactly what this function is for, so it must accept unvalidated input
  // straight from the database.
  slides: readonly {
    index: number;
    slideType: string;
    values: Record<string, string>;
    family?: string;
  }[]
): string[] {
  const problems: string[] = [];

  slides.forEach((slide, i) => {
    const resolved = slideTemplateFamily(family, slide);
    const knownTypes = new Set<string>(
      NOW_TEMPLATE_MANIFEST.filter((s) => s.family === resolved).map(
        (s) => s.slideType
      )
    );

    if (!knownTypes.has(slide.slideType)) {
      problems.push(
        `Slide ${i + 1}: onbekend slidetype "${slide.slideType}" voor familie ${resolved}.`
      );
      return;
    }

    // Narrowed by the knownTypes check above.
    const spec = getNowTemplateSpec(resolved, slide.slideType as NowSlideType);
    const declared = new Set(spec.placeholders.map((p) => p.name));

    for (const placeholder of spec.placeholders) {
      if (typeof slide.values[placeholder.name] !== "string") {
        problems.push(
          `Slide ${i + 1} (${slide.slideType}): waarde voor "${placeholder.name}" ontbreekt.`
        );
      }
    }
    for (const key of Object.keys(slide.values)) {
      if (!declared.has(key)) {
        problems.push(
          `Slide ${i + 1} (${slide.slideType}): onbekende token "${key}".`
        );
      }
    }

    const enumPlaceholders = spec.placeholders.filter((p) => p.enumValues);
    for (const placeholder of enumPlaceholders) {
      const value = slide.values[placeholder.name];
      if (value && !placeholder.enumValues!.includes(value)) {
        problems.push(
          `Slide ${i + 1} (${slide.slideType}): "${placeholder.name}" moet ` +
            `een van [${placeholder.enumValues!.join(", ")}] zijn, niet "${value}".`
        );
      }
    }
  });

  return problems;
}
