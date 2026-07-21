/**
 * End-to-end smoke test tegen de ECHTE services:
 *   Supabase (Prisma) + WordPress (amsterdamnow.com) + OpenAI + renderer.
 *
 * Draai met:  npx tsx --env-file=.env scripts/test-e2e.ts
 * Ruimt eigen testdata aan het eind weer op.
 */
import { randomUUID } from "node:crypto";
import { writeFileSync, mkdirSync } from "node:fs";

import { db } from "@/lib/db";
import { getPosts } from "@/lib/wordpress";
import { generateCarousel } from "@/lib/openai";
import { renderCarousel } from "@/lib/renderer";
import { TEMPLATE_IDS } from "@/templates";

const log = (s: string) => console.log(`\n▶ ${s}`);

async function main() {
  const marker = `e2e-${randomUUID().slice(0, 8)}`;

  // 1. DB-verbinding + user aanmaken
  log("1. Supabase: user aanmaken");
  const user = await db.user.create({
    data: { email: `${marker}@example.com`, name: "E2E Test" },
  });
  console.log(`   user ${user.id} aangemaakt`);

  // 2. WordPress-connectie + live posts ophalen
  log("2. WordPress: live posts ophalen van amsterdamnow.com");
  const conn = await db.wordPressConnection.create({
    data: { userId: user.id, url: "https://amsterdamnow.com", username: "", appPassword: "" },
  });
  const posts = await getPosts(
    { url: "https://amsterdamnow.com", username: "", appPassword: "" },
    { page: 1, perPage: 3 },
  );
  console.log(`   ${posts.length} posts opgehaald:`);
  posts.forEach((p) => console.log(`     - [${p.wordpressId}] ${p.title}`));
  if (posts.length === 0) throw new Error("Geen posts opgehaald van WordPress");

  // 3. Artikel opslaan
  log("3. Supabase: artikel opslaan");
  const src = posts[0];
  const article = await db.article.create({
    data: {
      connectionId: conn.id,
      wordpressId: src.wordpressId,
      title: src.title,
      content: src.content,
      excerpt: src.excerpt,
      imageUrl: src.featuredImageUrl,
      categories: src.categories,
      tags: src.tags,
      publishedAt: src.publishedAt ? new Date(src.publishedAt) : null,
    },
  });
  console.log(`   artikel ${article.id} opgeslagen: "${article.title}"`);

  // 4. Echte AI-generatie
  log("4. OpenAI: carousel genereren");
  const content = await generateCarousel(
    { title: src.title, content: src.content, excerpt: src.excerpt },
    { slideCount: 5, language: "nl" },
  );
  console.log(`   titel: ${content.title}`);
  console.log(`   ${content.slides.length} slides, ${content.hashtags.length} hashtags`);
  content.slides.forEach((s) => console.log(`     ${s.index}. [${s.layout}] ${s.headline}`));
  console.log(`   caption: ${content.caption.slice(0, 80)}...`);

  // 5. Carousel opslaan
  log("5. Supabase: carousel opslaan");
  const template = TEMPLATE_IDS[0];
  const carousel = await db.carousel.create({
    data: {
      articleId: article.id,
      template,
      slides: content.slides as unknown as object[],
      caption: content.caption,
      hashtags: content.hashtags,
    },
  });
  console.log(`   carousel ${carousel.id} opgeslagen (template: ${template})`);

  // 6. Renderen naar PNG
  log("6. Renderer: slides naar PNG (satori)");
  const buffers = await renderCarousel(content, template, {
    name: "Amsterdam NOW",
    primaryColor: "#d0342c",
    secondaryColor: "#171715",
    textColor: "#171715",
    backgroundColor: "#ffffff",
    fontFamily: "Inter",
    handle: "@amsterdamnow",
  });
  mkdirSync(".test-output/e2e", { recursive: true });
  buffers.forEach((b, i) => {
    const path = `.test-output/e2e/slide-${String(i + 1).padStart(2, "0")}.png`;
    writeFileSync(path, b);
    console.log(`   ${path} — ${(b.length / 1024).toFixed(1)} KB`);
  });

  // 7. Opruimen
  log("7. Opruimen (cascade delete van testdata)");
  await db.user.delete({ where: { id: user.id } });
  console.log("   testdata verwijderd");

  await db.$disconnect();
  console.log("\n✅ END-TO-END GESLAAGD — Supabase + WordPress + OpenAI + renderer werken samen.");
}

main().catch(async (e) => {
  console.error("\n❌ E2E FOUT:", e);
  await db.$disconnect().catch(() => {});
  process.exit(1);
});
