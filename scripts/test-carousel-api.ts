/**
 * Smoke test for the Phase 5 carousel API surface — no real database or
 * OpenAI key required.
 *
 * Run with:
 *   MOCK_AI=1 npx tsx --conditions=react-server scripts/test-carousel-api.ts
 *
 * What this DOES test (pure, DB-free logic):
 *  - lib/carousels.ts: isValidStatusTransition(), canDeleteCarousel(),
 *    canMutateCarouselContent() — the whole DRAFT<->APPROVED transition
 *    table and the PUBLISHING/PUBLISHED lock rules.
 *  - lib/carousel-schema.ts: carouselUpdateSchema (PATCH body validation,
 *    including the "at least one field" refine and status/slides/template
 *    rules) and regenerateSlideRequestSchema.
 *  - lib/openai.ts::regenerateSlide() end-to-end through its MOCK_AI=1 path
 *    (prompt building + single-slide schema + layout invariants), the same
 *    mock mechanism scripts/test-generate.ts uses for generateCarousel().
 *
 * What this DOES NOT test (requires a real Postgres DATABASE_URL):
 *  - listCarouselsForUser / getCarouselForUser / updateCarouselForUser /
 *    deleteCarouselForUser — every function in lib/carousels.ts that
 *    actually touches the database (ownership filtering via the
 *    Carousel -> Article -> WordPressConnection -> User chain, the
 *    findFirst/update/delete calls themselves).
 *  - The app/api/carousels/* and app/api/generate/slide route handlers
 *    (session handling, status codes) — these are thin wrappers around the
 *    lib functions above and were verified by reading, plus `npm run build`
 *    type-checking every route.
 *  - This repo's .env.local DATABASE_URL is a placeholder
 *    (postgresql://user:password@localhost:5432/db), not a reachable
 *    database, so no in-memory or real-DB integration test was attempted
 *    here — faking Prisma's query builder well enough to be trustworthy is
 *    out of scope for a smoke script; a real integration test should run
 *    against a disposable Postgres instance instead.
 */

import {
  canDeleteCarousel,
  canMutateCarouselContent,
  isValidStatusTransition,
} from "../lib/carousels";
import {
  carouselUpdateSchema,
  regenerateSlideRequestSchema,
} from "../lib/carousel-schema";
import { regenerateSlide } from "../lib/openai";

let failures = 0;

function check(label: string, condition: boolean): void {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    console.error(`  FAIL ${label}`);
    failures++;
  }
}

function testStatusTransitions() {
  console.log("\n[isValidStatusTransition]");
  check("DRAFT -> APPROVED allowed", isValidStatusTransition("DRAFT", "APPROVED"));
  check("APPROVED -> DRAFT allowed", isValidStatusTransition("APPROVED", "DRAFT"));
  check("DRAFT -> DRAFT (no-op) allowed", isValidStatusTransition("DRAFT", "DRAFT"));
  check(
    "DRAFT -> PUBLISHING rejected",
    !isValidStatusTransition("DRAFT", "PUBLISHING")
  );
  check(
    "APPROVED -> PUBLISHED rejected",
    !isValidStatusTransition("APPROVED", "PUBLISHED")
  );
  check(
    "PUBLISHING -> PUBLISHED rejected (publish pipeline only)",
    !isValidStatusTransition("PUBLISHING", "PUBLISHED")
  );
  check(
    "PUBLISHED -> DRAFT rejected",
    !isValidStatusTransition("PUBLISHED", "DRAFT")
  );
  check("FAILED -> DRAFT rejected", !isValidStatusTransition("FAILED", "DRAFT"));
}

function testDeleteAndMutateLocks() {
  console.log("\n[canDeleteCarousel / canMutateCarouselContent]");
  for (const status of ["DRAFT", "APPROVED", "FAILED"] as const) {
    check(`${status} is deletable`, canDeleteCarousel(status));
    check(`${status} is mutable`, canMutateCarouselContent(status));
  }
  for (const status of ["PUBLISHING", "PUBLISHED"] as const) {
    check(`${status} is NOT deletable`, !canDeleteCarousel(status));
    check(`${status} is NOT mutable`, !canMutateCarouselContent(status));
  }
}

function testCarouselUpdateSchema() {
  console.log("\n[carouselUpdateSchema]");

  check("empty body rejected", !carouselUpdateSchema.safeParse({}).success);

  check(
    "caption-only update accepted",
    carouselUpdateSchema.safeParse({ caption: "New caption" }).success
  );

  check(
    "status-only update accepted",
    carouselUpdateSchema.safeParse({ status: "APPROVED" }).success
  );

  check(
    "unknown status value rejected",
    !carouselUpdateSchema.safeParse({ status: "DELETED" }).success
  );

  check(
    "unknown template id rejected",
    !carouselUpdateSchema.safeParse({ template: "not-a-real-template" })
      .success
  );

  const validSlides = [
    { index: 0, layout: "hero", headline: "Hook" },
    { index: 1, layout: "cta", headline: "Read more" },
  ];
  check(
    "valid slides array accepted",
    carouselUpdateSchema.safeParse({ slides: validSlides }).success
  );

  check(
    "slide with invalid layout rejected",
    !carouselUpdateSchema.safeParse({
      slides: [{ index: 0, layout: "not-a-layout", headline: "Hook" }],
    }).success
  );

  check(
    "slide missing headline rejected",
    !carouselUpdateSchema.safeParse({
      slides: [{ index: 0, layout: "hero" }],
    }).success
  );
}

function testRegenerateSlideRequestSchema() {
  console.log("\n[regenerateSlideRequestSchema]");

  check(
    "valid request accepted",
    regenerateSlideRequestSchema.safeParse({
      carouselId: "abc123",
      slideIndex: 2,
    }).success
  );

  check(
    "missing carouselId rejected",
    !regenerateSlideRequestSchema.safeParse({ slideIndex: 0 }).success
  );

  check(
    "negative slideIndex rejected",
    !regenerateSlideRequestSchema.safeParse({
      carouselId: "abc123",
      slideIndex: -1,
    }).success
  );
}

async function testRegenerateSlideMockPath() {
  console.log("\n[regenerateSlide() via MOCK_AI=1]");

  if (process.env.MOCK_AI !== "1") {
    console.log(
      "  skip  MOCK_AI is not '1' — run with MOCK_AI=1 to include this section."
    );
    return;
  }

  const article = {
    title: "Amsterdam opent nieuwe fietsparkeergarage",
    content: "<p>Een lang artikel over fietsenstallingen in Amsterdam.</p>",
    excerpt: "Een korte samenvatting.",
  };
  const carousel = {
    title: article.title,
    slides: [
      { index: 0, layout: "hero" as const, headline: "Hero slide" },
      { index: 1, layout: "text" as const, headline: "Middle slide" },
      { index: 2, layout: "cta" as const, headline: "CTA slide" },
    ],
  };

  const heroSlide = await regenerateSlide(article, carousel, 0);
  check("regenerated hero slide keeps layout 'hero'", heroSlide.layout === "hero");
  check("regenerated hero slide keeps index 0", heroSlide.index === 0);

  const ctaSlide = await regenerateSlide(article, carousel, 2);
  check("regenerated last slide keeps layout 'cta'", ctaSlide.layout === "cta");

  const middleSlide = await regenerateSlide(article, carousel, 1);
  check(
    "regenerated middle slide keeps its original layout by default",
    middleSlide.layout === "text"
  );

  const overridden = await regenerateSlide(article, carousel, 1, {
    layout: "list",
  });
  check(
    "regenerated middle slide honors an explicit layout override",
    overridden.layout === "list"
  );

  let threw = false;
  try {
    await regenerateSlide(article, carousel, 99);
  } catch {
    threw = true;
  }
  check("regenerating an out-of-range slideIndex throws", threw);
}

async function main() {
  console.log("Running lib/carousels.ts + lib/carousel-schema.ts smoke test...");

  testStatusTransitions();
  testDeleteAndMutateLocks();
  testCarouselUpdateSchema();
  testRegenerateSlideRequestSchema();
  await testRegenerateSlideMockPath();

  console.log(
    "\nNOTE: listCarouselsForUser/getCarouselForUser/updateCarouselForUser/" +
      "deleteCarouselForUser (the actual Prisma-backed CRUD) were NOT " +
      "exercised — this environment has no reachable DATABASE_URL. See the " +
      "file header for what would be needed to cover them."
  );

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nOK — all pure-logic checks passed.");
}

main().catch((error) => {
  console.error("Smoke test failed:", error);
  process.exit(1);
});
