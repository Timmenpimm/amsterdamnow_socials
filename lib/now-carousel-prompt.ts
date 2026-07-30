import "server-only";

import {
  editablePlaceholders,
  getNowFamilyPlan,
  textPlaceholders,
  type NowFamilyStep,
  type NowStoredSlide,
} from "@/lib/now-carousel";
import type { CleanArticle } from "@/lib/carousel-prompt";
import {
  getNowTemplateSpec,
  type NowPlaceholderSpec,
  type NowSlideType,
  type NowTemplateFamily,
} from "@/templates/now/manifest";

/**
 * Prompt construction for the Amsterdam NOW carousels (families hotspot,
 * lijstje, agenda, gids, event).
 *
 * The slide-by-slide part of the system prompt is generated from the
 * template manifest via lib/now-carousel.ts — never hand-copied. Adding a
 * token to templates/now/manifest.ts therefore automatically shows up in the
 * prompt with its own description, exactly like it shows up in the schema.
 */

/**
 * Wie er schrijft en in welke toon. Gedeeld door de volledige carousel en de
 * losse-slide-regeneratie, zodat een herschreven slide dezelfde stem houdt.
 */
const NOW_VOICE = `Write everything in English, in an editorial city-guide tone: concrete, factual, with details from the article (names, streets, neighborhoods, times, prices). Inform the reader; do not sell.

Prohibited: marketing clichés and hollow superlatives. Never use "discover now," "not to be missed," "must-see," or variations thereof ("you shouldn't miss this," "the ultimate ...," "amazing," "incredible"). No exclamation points, no influencer tone, no meaningless sentences ("this is truly special").`;
/** De regels die voor elk tekstveld gelden, ongeacht welke slide je schrijft. */
const NOW_FIELD_RULES = `Rules for text fields:
- Adhere to the lengths specified in the field's description. If it says "max ~110 characters," that is a hard limit; text that is too long will overflow the layout.
- Every field is plain text. No HTML, no markdown, no emojis, no quotation marks around the entire field. The only exception is <br> in fields explicitly marked as such above — and use them only in the middle of text where you really want to break the line. Never at the beginning or end of a field; that creates an empty line in the design.
- Fields asking for UPPERCASE (kicker, category, date, label) must be supplied in uppercase.
- Never invent image URLs or filenames. Photos are filled in by the application; there are no image fields in what you provide.
- Do not invent facts. If a price, time, or address is not in the article, write what is known (e.g., "See the site for times") instead of making it up.
- If a field is not applicable, provide an empty string — never "n/a" or a placeholder.`;

const NOW_CLOSING = "Provide only the structured data, without explanation.";
/** "1 slide" / "2 tot 8 slides" — the repeat range of one plan step. */
function describeRange(step: NowFamilyStep): string {
  if (step.min === step.max) {
    return step.min === 1 ? "1 slide" : `${step.min} slides`;
  }
  return `${step.min} tot ${step.max} slides`;
}

/**
 * De tokens van één slide, één per regel, met de manifestbeschrijving als
 * instructie. Tokens waar een <br> in mag worden als zodanig gemarkeerd.
 */
function describePlaceholders(placeholders: NowPlaceholderSpec[]): string {
  return placeholders
    .map((placeholder) => {
      // The manifest description already mentions <br> for most of these; only
      // spell it out when it doesn't, so the line doesn't say it twice.
      const lineBreak =
        placeholder.allowsLineBreak && !placeholder.description.includes("<br>")
          ? " <br> is hier toegestaan om de regelval te sturen."
          : "";
      return `   - ${placeholder.name}: ${placeholder.description}.${lineBreak}`;
    })
    .join("\n");
}

/**
 * One plan step with its tokens. Steps without any writable token (e.g. de
 * statische lijstje-CTA) say so instead of listing nothing.
 */
function describeStep(
  family: NowTemplateFamily,
  step: NowFamilyStep,
  position: number
): string {
  const placeholders = textPlaceholders(step.templateFamily ?? family, step.slideType);
  const header = `${position}. "${step.slideType}" — ${describeRange(step)}`;

  if (placeholders.length === 0) {
    return `${header}\n   (geen tekstvelden: deze slide is volledig vormgegeven, lever een leeg object)`;
  }

  return `${header}\n${describePlaceholders(placeholders)}`;
}

/**
 * Zoekt de slide met het fromArticleTitle-token en legt uit dat die kop de
 * letterlijke artikeltitel is. Het token zit niet in het schema — zonder deze
 * regel weet het model niet dat de kop er al staat en schrijft het hem
 * verderop in de carousel gewoon opnieuw.
 */
function describeArticleTitleRule(family: NowTemplateFamily): string {
  const plan = getNowFamilyPlan(family);

  for (const [position, step] of plan.steps.entries()) {
    const spec = getNowTemplateSpec(
      step.templateFamily ?? family,
      step.slideType
    );
    const titleToken = spec.placeholders.find((p) => p.fromArticleTitle);
    if (!titleToken) continue;

    return `Slide ${position + 1} ("${step.slideType}") shows the article's title verbatim, exactly as it appears above the article. That field (${titleToken.name}) is filled automatically by the application: you do not provide it and you do not invent a shorter hook for it.

Assume the reader has already read that header. Do not repeat or paraphrase it anywhere else in the carousel — not in a kicker, not in a subheading, not in the closer — and do not open the caption with the same sentence. Every slide after the first must add something new.`;
  }

  return "";
}

/**
 * System prompt: who writes, in welke volgorde de slides komen en welke
 * tokens elke slide precies nodig heeft.
 */
export function buildNowSystemPrompt(family: NowTemplateFamily): string {
  const plan = getNowFamilyPlan(family);
  const steps = plan.steps
    .map((step, i) => describeStep(family, step, i + 1))
    .join("\n\n");
  const titleRule = describeArticleTitleRule(family);

  return `You are an editor at Amsterdam NOW, a city guide for Amsterdam. You convert a published article into a carousel of type "${plan.label}".

Goal of this carousel type: ${plan.purpose}

${NOW_VOICE}

Build the carousel in exactly this order:

${steps}
${titleRule ? `\n${titleRule}\n` : ""}
${NOW_FIELD_RULES}

Additionally, provide:
- caption: 2 to 4 sentences in the same tone. Mention at least two concrete things from the article by name (a place, a street, a detail) — a caption that could apply to any random article is incorrect. Write like an editor who has been there: factual, dry, no hyped-up promises. Prohibited: "possibilities are endless," "something for everyone," "go look for," "your new favorite," "a must," and any closing line urging the reader to discover something. Do not invent words.
- hashtags: 8 to 12 hashtags without "#", relevant to the topic and to Amsterdam. Mix broad tags with specific ones (neighborhood, category). No spam tags like love, instagood, or photooftheday.
${NOW_CLOSING}`;
}

/**
 * User prompt: het artikel waar de carousel op gebaseerd wordt.
 */
export function buildNowUserPrompt(
  article: CleanArticle,
  family: NowTemplateFamily
): string {
  const plan = getNowFamilyPlan(family);
  // Alleen benoemen als deze familie de titel ook echt op een slide zet.
  const titleLabel = describeArticleTitleRule(family)
    ? "Title (will be placed literally on the first slide; do not repeat)"
    : "Title";

  return `Create an Amsterdam NOW "${plan.label}" carousel based on the article below.

${titleLabel}: ${article.title}

Summary: ${article.excerpt || "(no summary available)"}

Article:
${article.content}`;
}

/** Hoeveel tekens van een naburige slide meegaan als context. */
const NEIGHBOUR_VALUE_MAX = 90;

/**
 * System prompt voor het herschrijven van één slide: dezelfde stem en
 * veldregels als de volledige carousel, maar met precies de tokens van deze
 * ene slide. Automatisch gevulde tokens (foto, volgnummer, aantal, layout)
 * blijven hier bewust buiten beeld — die vult de applicatie in.
 */
export function buildNowSlideSystemPrompt(
  family: NowTemplateFamily,
  slideType: NowSlideType,
  placeholders: NowPlaceholderSpec[]
): string {
  const plan = getNowFamilyPlan(family);

  // Heeft juist déze slide de artikeltitel, dan blijft die staan: hij zit niet
  // in de velden hieronder en de applicatie schrijft de bestaande waarde terug.
  const titleToken = getNowTemplateSpec(family, slideType).placeholders.find(
    (placeholder) => placeholder.fromArticleTitle
  );
  const titleNote = titleToken
    ? ` The header of this slide (${titleToken.name}) is the literal title of the article; it remains unchanged and you should not rewrite it. Write the other fields to complement that header rather than repeating it.`
    : "";

  return `You are an editor at Amsterdam NOW, a city guide for Amsterdam. You are rewriting one slide of an existing carousel of type "${plan.label}".

Goal of this carousel type: ${plan.purpose}

${NOW_VOICE}

You rewrite only the slide of type "${slideType}". The other slides remain unchanged: write something different from what is already there and do not repeat any place, fact, or phrasing that exists elsewhere in the carousel. The photo, sequence number, and item count of this slide are fixed and you do not provide them.${titleNote}

This slide has exactly these text fields:
${describePlaceholders(placeholders)}

${NOW_FIELD_RULES}

${NOW_CLOSING}`;
}

/** "kop: De 10 beste …; categorie: HOTSPOTS" — één slide kort samengevat. */
function summariseSlide(
  slide: NowStoredSlide,
  resolvedFamily: NowTemplateFamily
): string {
  // editablePlaceholders in plaats van textPlaceholders: de artikeltitel is
  // geen modelveld, maar staat wél op de slide. Zou hij hier ontbreken, dan
  // ziet het model de coverkop niet en schrijft het die alsnog opnieuw.
  const shown = editablePlaceholders(resolvedFamily, slide.slideType);
  const parts = shown
    .map((placeholder) => {
      const value = (slide.values[placeholder.name] ?? "").trim();
      if (!value) return null;
      const short =
        value.length > NEIGHBOUR_VALUE_MAX
          ? `${value.slice(0, NEIGHBOUR_VALUE_MAX)}…`
          : value;
      const fixed = placeholder.fromArticleTitle
        ? " (fixed article title)"
        : "";
      return `${placeholder.name}: ${short}${fixed}`;
    })
    .filter((part): part is string => part !== null);

  const body = parts.length > 0 ? parts.join("; ") : "(no text)";
  return `${slide.index + 1}. ${slide.slideType} — ${body}`;
}

/**
 * User prompt voor het herschrijven van één slide: het artikel, de huidige
 * inhoud van de slide en de andere slides in het kort, zodat de nieuwe tekst
 * niet herhaalt wat er al staat.
 */
export function buildNowSlideUserPrompt(
  article: CleanArticle,
  family: NowTemplateFamily,
  slides: readonly NowStoredSlide[],
  slideIndex: number,
  resolveFamily: (slide: NowStoredSlide) => NowTemplateFamily
): string {
  const plan = getNowFamilyPlan(family);
  const target = slides.find((slide) => slide.index === slideIndex);
  const others = slides.filter((slide) => slide.index !== slideIndex);

  const current = target
    ? summariseSlide(target, resolveFamily(target))
    : "(unknown)";
  const context =
    others.length > 0
      ? others
          .map((slide) => summariseSlide(slide, resolveFamily(slide)))
          .join("\n")
      : "(this carousel has no other slides)";

  return `Rewrite slide ${slideIndex + 1} of this Amsterdam NOW "${plan.label}" carousel.

Huidige inhoud van die slide:
${current}

The other slides — do not rewrite, only to avoid repetition:
${context}

Title: ${article.title}

Summary: ${article.excerpt || "(no summary available)"}

Article:
${article.content}`;
}

