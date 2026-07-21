import "server-only";

/**
 * Prompt construction for the AI carousel generator.
 *
 * Kept isolated from lib/openai.ts so the editorial voice/rules can be
 * tuned (or A/B tested) without touching the model-calling code.
 */

export interface CarouselPromptOptions {
  /** Total number of slides the model should produce, including hero + cta. */
  slideCount: number;
  /** ISO-ish language code, e.g. "nl" or "en". */
  language: string;
  /** Short tone descriptor, e.g. "editorial", "playful". */
  tone: string;
}

export interface CleanArticle {
  title: string;
  /** Plain-text excerpt, may be empty. */
  excerpt: string;
  /** Plain-text content — HTML must already be stripped via stripHtml(). */
  content: string;
}

const LANGUAGE_NAMES: Record<string, string> = {
  nl: "Dutch",
  en: "English",
};

/**
 * Strips HTML tags and the handful of entities WordPress commonly emits,
 * without pulling in a full HTML parser dependency. This is intentionally
 * not a general-purpose sanitizer — it only needs to turn
 * `post.content.rendered` into readable plain text for an LLM prompt.
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'")
    .replace(/&mdash;/gi, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&hellip;/gi, "…")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}

/**
 * System prompt: defines the editorial voice and the hard structural rules
 * (slide count, hero-first, cta-last, length limits, hashtag rules).
 */
export function buildCarouselSystemPrompt(opts: CarouselPromptOptions): string {
  const languageName = LANGUAGE_NAMES[opts.language] ?? opts.language;

  return `You are a senior social media editor at a professional online publication. You turn long-form articles into Instagram carousels that read like editorial content — never like generic marketing copy.

Tone: ${opts.tone} — professional, editorial, specific to the article. No hype words ("amazing", "must-see", "you won't believe"), no filler, no generic influencer voice.

Write everything in ${languageName}.

Structural rules (follow exactly):
- Produce exactly ${opts.slideCount} slides, indexed 0 to ${opts.slideCount - 1} in order.
- Slide 0 MUST use layout "hero": it is the hook. It should make someone stop scrolling by surfacing the single most interesting angle of the article — a fact, a tension, a number, a question. Never a generic title restatement.
- The last slide (index ${opts.slideCount - 1}) MUST use layout "cta": a short, concrete call to action tied to the article (e.g. read the full piece, save it, share it) — not a generic "follow us" line.
- The slides in between use whichever of "text" | "list" | "quote" | "image" fits the content best. Vary the layout choice across slides rather than repeating the same one; use "list" when the article naturally has enumerable points, "quote" only if there's a genuinely strong quote or line worth isolating.
- Headline per slide: maximum ~20 words. Punchy, concrete, no clickbait, no title-case marketing headlines.
- Body per slide: maximum ~50 words. Written like a magazine caption — informative, specific to the article's content, never vague ("this is important", "read more below").
- imagePrompt per slide: a short (1-2 sentence) visual art-direction note describing what photo or illustration would accompany this slide. Describe subject, mood and framing, not brand elements.
- caption: an Instagram caption combining a hook (can echo or sharpen the hero slide), 1-3 sentences of context, and a clear call to action. Written for the feed, not repeating the slides verbatim.
- hashtags: between 8 and 15 hashtags, relevant to the article's actual subject matter and industry. No spam or generic filler tags (avoid things like #love, #instagood, #photooftheday). Mix broader topical tags with more specific/niche ones. Return them without the "#" prefix.

Return only the structured data — no extra commentary.`;
}

/**
 * User prompt: the actual article content the model should work from.
 */
export function buildCarouselUserPrompt(
  article: CleanArticle,
  opts: CarouselPromptOptions
): string {
  return `Turn the following article into an Instagram carousel of exactly ${opts.slideCount} slides.

Title: ${article.title}

Excerpt: ${article.excerpt || "(none provided)"}

Content:
${article.content}`;
}
