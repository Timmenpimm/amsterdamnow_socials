import "server-only";

import type { SlideLayout } from "@/types/carousel";

/**
 * Fixed mock carousel content for the MOCK_AI=1 test/dev path (see
 * lib/openai.ts::generateCarousel). Split out of lib/openai.ts purely to
 * keep that file under the project's 300-line limit — this has no
 * behavior of its own beyond producing deterministic fixture data.
 */

export interface MockSlide {
  index: number;
  layout: SlideLayout;
  headline: string;
  body: string;
  imagePrompt: string;
}

export interface MockCarouselContent {
  title: string;
  slides: MockSlide[];
  caption: string;
  hashtags: string[];
}

export function buildMockCarouselContent(
  title: string,
  slideCount: number
): MockCarouselContent {
  const count = Math.max(2, slideCount);
  const middleLayouts: SlideLayout[] = ["text", "list", "quote", "image"];

  const slides: MockSlide[] = Array.from({ length: count }, (_, i) => {
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
  });

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
