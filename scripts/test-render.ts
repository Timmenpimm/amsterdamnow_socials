/**
 * Smoke test for the carousel renderer. Renders a fixed sample
 * CarouselContent through all three templates and writes the resulting
 * PNGs to .test-output/<template>/slide-0N.png.
 *
 * Run with: npx tsx scripts/test-render.ts
 *
 * This is a manual proof-of-life script, not part of the automated test
 * suite (no test framework is wired up yet) — it just asserts non-trivial
 * file sizes and prints a report.
 */
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { renderCarousel } from "../lib/renderer";
import { TEMPLATE_IDS } from "../templates";
import type { BrandSettings, CarouselContent } from "../types/carousel";

// 1x1 red pixel — enough to exercise the "hasImage" branch of hero/image
// layouts without depending on network access during the test run.
const SAMPLE_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const sampleContent: CarouselContent = {
  title: "Amsterdam opent nieuw fietsviaduct in Noord",
  caption: "Amsterdam bouwt door aan een autoluwe stad. 🚲",
  hashtags: ["#amsterdam", "#fiets", "#stadsontwikkeling"],
  slides: [
    {
      index: 0,
      layout: "hero",
      headline: "Amsterdam opent langste fietsviaduct van Nederland",
      imageUrl: SAMPLE_IMAGE,
    },
    {
      index: 1,
      layout: "list",
      headline: "Drie dingen die veranderen voor fietsers",
      body: [
        "Kortere reistijd tussen Noord en centrum",
        "Minder wachttijd bij het IJ-veer",
        "Nieuwe verlichting voor veiligheid in de avond",
      ].join("\n"),
    },
    {
      index: 2,
      layout: "cta",
      headline: "Lees het volledige verhaal",
      body: "Swipe niet verder — check de link in bio voor het hele artikel.",
    },
  ],
};

const sampleBrand: BrandSettings = {
  name: "Amsterdam NOW",
  primaryColor: "#d0342c",
  secondaryColor: "#111111",
  textColor: "#111111",
  backgroundColor: "#ffffff",
  fontFamily: "Inter",
  handle: "@amsterdamnow",
};

const OUTPUT_DIR = path.join(process.cwd(), ".test-output");
const MIN_BYTES = 10 * 1024;

async function main() {
  const results: { template: string; index: number; bytes: number; path: string }[] = [];

  for (const templateId of TEMPLATE_IDS) {
    const dir = path.join(OUTPUT_DIR, templateId);
    await mkdir(dir, { recursive: true });

    console.log(`\nRendering template "${templateId}"...`);
    const buffers = await renderCarousel(sampleContent, templateId, sampleBrand);

    for (let i = 0; i < buffers.length; i++) {
      const filePath = path.join(dir, `slide-${String(i + 1).padStart(2, "0")}.png`);
      await writeFile(filePath, buffers[i]);
      const { size } = await stat(filePath);
      results.push({ template: templateId, index: i + 1, bytes: size, path: filePath });
      console.log(`  slide-${String(i + 1).padStart(2, "0")}.png — ${(size / 1024).toFixed(1)} KB`);
    }
  }

  console.log("\n--- Summary ---");
  let allOk = true;
  for (const r of results) {
    const ok = r.bytes >= MIN_BYTES;
    allOk &&= ok;
    console.log(
      `${ok ? "OK  " : "FAIL"} ${r.template}/slide-${String(r.index).padStart(2, "0")}.png — ${(r.bytes / 1024).toFixed(1)} KB`
    );
  }

  if (!allOk) {
    console.error(`\nSome slides are under the ${MIN_BYTES / 1024}KB sanity threshold.`);
    process.exit(1);
  }

  console.log(`\nAll ${results.length} slides rendered successfully to ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error("test-render failed:", error);
  process.exit(1);
});
