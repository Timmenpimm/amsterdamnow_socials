/**
 * Smoke test for the AI carousel generation pipeline — requires no OpenAI
 * API key.
 *
 * Run with:
 *   MOCK_AI=1 npx tsx scripts/test-generate.ts
 *
 * This exercises the real code path in lib/openai.ts — prompt building via
 * lib/carousel-prompt.ts, generateCarousel(), and the CarouselContent zod
 * schema/validation/reindexing — but swaps out the actual OpenAI model call
 * for a fixed mock response. That mock branch lives inside
 * lib/openai.ts::generateCarousel() under `if (process.env.MOCK_AI === "1")`
 * and is clearly marked there as the lowest-level place the swap happens.
 */

import { generateCarousel } from "../lib/openai";
import type { CarouselContent } from "../types/carousel";

async function main() {
  if (process.env.MOCK_AI !== "1") {
    console.error(
      "Refusing to run without MOCK_AI=1 (this script must not call the real OpenAI API).\n" +
        "Run: MOCK_AI=1 npx tsx scripts/test-generate.ts"
    );
    process.exit(1);
  }

  const sampleArticle = {
    title: "Amsterdam opent nieuwe fietsparkeergarage bij Centraal Station",
    excerpt:
      "De grootste fietsenstalling ter wereld is geopend onder het water bij Amsterdam CS.",
    content: `<p>De gemeente Amsterdam heeft vandaag de nieuwe ondergrondse fietsenstalling bij Centraal Station geopend. Met plek voor <strong>7.000 fietsen</strong> is het de grootste fietsenstalling ter wereld.</p>
<p>De stalling ligt onder het IJ en is bereikbaar via een tunnel vanaf het stationsplein. Reizigers kunnen hun fiets stallen voor maximaal 24 uur gratis.</p>
<ul><li>7.000 plekken</li><li>Gratis eerste 24 uur</li><li>Toegang via OV-chipkaart</li></ul>
<p>&ldquo;Dit lost een probleem op dat al twintig jaar speelt,&rdquo; zegt de wethouder Verkeer.</p>`,
  };

  console.log("Running generateCarousel() with MOCK_AI=1...\n");

  const content: CarouselContent = await generateCarousel(sampleArticle, {
    slideCount: 6,
    language: "nl",
    tone: "editorial",
  });

  // Re-check the contract at the script level too, so this smoke test fails
  // loudly if generateCarousel() ever returns something that doesn't match
  // the CarouselContent shape from types/carousel.ts.
  assertCarouselContent(content);

  console.log("generateCarousel() returned a valid CarouselContent:\n");
  console.log(JSON.stringify(content, null, 2));
  console.log("\nOK — mock pipeline + zod validation passed.");
}

function assertCarouselContent(content: CarouselContent): void {
  if (!content.title || typeof content.title !== "string") {
    throw new Error("Missing/invalid title");
  }
  if (!Array.isArray(content.slides) || content.slides.length < 2) {
    throw new Error("slides must be an array of at least 2 items");
  }
  content.slides.forEach((slide, i) => {
    if (slide.index !== i) {
      throw new Error(`Slide ${i} has wrong index: ${slide.index}`);
    }
    if (!slide.headline) {
      throw new Error(`Slide ${i} is missing a headline`);
    }
  });
  if (content.slides[0].layout !== "hero") {
    throw new Error('First slide must have layout "hero"');
  }
  if (content.slides[content.slides.length - 1].layout !== "cta") {
    throw new Error('Last slide must have layout "cta"');
  }
  if (!content.caption) {
    throw new Error("Missing caption");
  }
  if (!Array.isArray(content.hashtags) || content.hashtags.length === 0) {
    throw new Error("hashtags must be a non-empty array");
  }
}

main().catch((error) => {
  console.error("Smoke test failed:", error);
  process.exit(1);
});
