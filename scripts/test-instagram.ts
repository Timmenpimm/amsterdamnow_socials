/**
 * Smoke test for the Phase 6 Instagram publish layer — no real database,
 * Instagram credentials, or network access required.
 *
 * Run with:
 *   MOCK_INSTAGRAM=1 npx tsx --conditions=react-server scripts/test-instagram.ts
 *
 * What this DOES test (pure, DB-free logic):
 *  - lib/public-render.ts: publicSlideUrl() -> verifyRenderToken() round
 *    trip, plus tampered/mismatched/missing-token rejection.
 *  - lib/instagram.ts: publishCarousel() via its MOCK_INSTAGRAM=1 path
 *    (mirrors lib/openai.ts's MOCK_AI pattern) — confirms it returns a
 *    fake media id without calling the real Graph API, and that the 2-10
 *    slide-count validation (TooFewSlidesError/TooManySlidesError) and
 *    MissingInstagramCredentialsError run *before* the mock short-circuit.
 *
 * What this DOES NOT test (requires a real Postgres DATABASE_URL and/or
 * real Instagram credentials):
 *  - lib/instagram-publish.ts's publishCarouselForUser() (ownership/status
 *    checks + Carousel row transitions) and the app/api/instagram/publish*
 *    route handlers — these were verified by reading, plus `npm run build`
 *    type-checking every route.
 *  - The public render route (app/api/public/carousel/[..]/[..]) actually
 *    serving a JPEG — verified manually via `npm run dev` + curl instead,
 *    since it needs satori/resvg/sharp and a running Next.js server.
 */

// A throwaway secret so lib/public-render.ts's getSecret() doesn't throw
// when this script is run standalone (outside `next dev`/`next build`,
// which load .env themselves). Never used for anything real.
process.env.PUBLIC_RENDER_SECRET ??= "smoke-test-secret-do-not-use-in-prod";

import {
  MissingInstagramCredentialsError,
  TooFewSlidesError,
  TooManySlidesError,
  publishCarousel,
} from "../lib/instagram";
import { publicSlideUrl, verifyRenderToken } from "../lib/public-render";

let failures = 0;

function check(label: string, condition: boolean): void {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    console.error(`  FAIL ${label}`);
    failures++;
  }
}

async function checkThrows(
  label: string,
  fn: () => Promise<unknown>,
  ErrorClass: new (...args: never[]) => Error
): Promise<void> {
  try {
    await fn();
    check(label, false);
  } catch (error) {
    check(label, error instanceof ErrorClass);
  }
}

function tokenFromUrl(url: string): string | null {
  return new URL(url).searchParams.get("t");
}

function testHmacRoundTrip() {
  console.log("\n[publicSlideUrl / verifyRenderToken]");

  const baseUrl = "https://engine.example.com";
  const carouselId = "clx0000000000000000000000";

  const url = publicSlideUrl(baseUrl, carouselId, 2);
  check(
    "URL points at the expected route",
    url.startsWith(
      `${baseUrl}/api/public/carousel/${carouselId}/2?t=`
    )
  );

  const token = tokenFromUrl(url);
  check("token is present in the URL", Boolean(token));
  check(
    "matching (carouselId, slideIndex, token) verifies",
    verifyRenderToken(carouselId, 2, token)
  );

  check(
    "token for a different slideIndex is rejected",
    !verifyRenderToken(carouselId, 3, token)
  );

  check(
    "token for a different carouselId is rejected",
    !verifyRenderToken("some-other-carousel-id", 2, token)
  );

  const tampered = token ? `${token.slice(0, -1)}${token.at(-1) === "0" ? "1" : "0"}` : null;
  check("a tampered token is rejected", !verifyRenderToken(carouselId, 2, tampered));

  check("a missing token is rejected", !verifyRenderToken(carouselId, 2, null));
  check("an empty-string token is rejected", !verifyRenderToken(carouselId, 2, ""));
  check(
    "a non-hex token is rejected",
    !verifyRenderToken(carouselId, 2, "not-hex-at-all!!")
  );

  // Trailing slash on baseUrl should be normalised, not doubled.
  const urlWithTrailingSlash = publicSlideUrl(`${baseUrl}/`, carouselId, 0);
  check(
    "trailing slash on baseUrl is normalised",
    !urlWithTrailingSlash.includes("//api/")
  );
}

async function testPublishCarouselMockPath() {
  console.log("\n[publishCarousel() via MOCK_INSTAGRAM=1]");

  if (process.env.MOCK_INSTAGRAM !== "1") {
    console.log(
      "  skip  MOCK_INSTAGRAM is not '1' — run with MOCK_INSTAGRAM=1 to include this section."
    );
    return;
  }

  const baseParams = {
    igUserId: "17841400000000000",
    accessToken: "fake-access-token-for-smoke-test",
    caption: "Test caption #amsterdam",
  };

  const result = await publishCarousel({
    ...baseParams,
    slideImageUrls: [
      "https://engine.example.com/api/public/carousel/c1/0?t=aaa",
      "https://engine.example.com/api/public/carousel/c1/1?t=bbb",
      "https://engine.example.com/api/public/carousel/c1/2?t=ccc",
    ],
  });
  check("mock publish returns a mediaId", typeof result.mediaId === "string" && result.mediaId.length > 0);

  await checkThrows(
    "1 slide (below the 2-slide minimum) throws TooFewSlidesError",
    () => publishCarousel({ ...baseParams, slideImageUrls: ["https://x/0?t=a"] }),
    TooFewSlidesError
  );

  await checkThrows(
    "0 slides throws TooFewSlidesError",
    () => publishCarousel({ ...baseParams, slideImageUrls: [] }),
    TooFewSlidesError
  );

  const elevenSlides = Array.from(
    { length: 11 },
    (_, i) => `https://engine.example.com/api/public/carousel/c1/${i}?t=x`
  );
  await checkThrows(
    "11 slides (above the 10-slide maximum) throws TooManySlidesError",
    () => publishCarousel({ ...baseParams, slideImageUrls: elevenSlides }),
    TooManySlidesError
  );

  await checkThrows(
    "missing accessToken throws MissingInstagramCredentialsError (checked before the mock short-circuit)",
    () =>
      publishCarousel({
        ...baseParams,
        accessToken: "",
        slideImageUrls: ["https://x/0?t=a", "https://x/1?t=b"],
      }),
    MissingInstagramCredentialsError
  );

  await checkThrows(
    "missing igUserId throws MissingInstagramCredentialsError",
    () =>
      publishCarousel({
        ...baseParams,
        igUserId: "",
        slideImageUrls: ["https://x/0?t=a", "https://x/1?t=b"],
      }),
    MissingInstagramCredentialsError
  );

  // Exactly at the boundaries should succeed.
  const twoSlides = await publishCarousel({
    ...baseParams,
    slideImageUrls: ["https://x/0?t=a", "https://x/1?t=b"],
  });
  check("exactly 2 slides (lower boundary) succeeds", typeof twoSlides.mediaId === "string");

  const tenSlides = await publishCarousel({
    ...baseParams,
    slideImageUrls: Array.from({ length: 10 }, (_, i) => `https://x/${i}?t=a`),
  });
  check("exactly 10 slides (upper boundary) succeeds", typeof tenSlides.mediaId === "string");
}

async function main() {
  console.log("Running lib/public-render.ts + lib/instagram.ts smoke test...");

  testHmacRoundTrip();
  await testPublishCarouselMockPath();

  console.log(
    "\nNOTE: publishCarouselForUser() (Carousel status transitions + DB " +
      "ownership checks) and the public render route were NOT exercised " +
      "here — see the file header for what would be needed to cover them."
  );

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed.`);
    process.exit(1);
  }
  console.log("\nOK — all checks passed.");
}

main().catch((error) => {
  console.error("Smoke test failed:", error);
  process.exit(1);
});
