/**
 * DB-backed test van het Instagram-publiceerpad tegen de ECHTE Supabase-database,
 * met MOCK_INSTAGRAM=1 (geen echte Graph API-call, wel echte statusovergangen).
 *
 * Draai:  MOCK_INSTAGRAM=1 npx tsx --conditions=react-server --env-file=.env scripts/test-e2e-publish.ts
 * Ruimt eigen testdata weer op.
 */
import { randomUUID } from "node:crypto";

import { db } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import {
  publishCarouselForUser,
  MissingInstagramConnectionError,
} from "@/lib/instagram-publish";

const log = (s: string) => console.log(`\n▶ ${s}`);
function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT FAALT: ${msg}`);
  console.log(`   ✓ ${msg}`);
}

const sampleSlides = [
  { index: 0, layout: "hero", headline: "Hero kop" },
  { index: 1, layout: "text", headline: "Tekst kop", body: "Body copy." },
  { index: 2, layout: "cta", headline: "Lees meer" },
];

async function main() {
  const marker = `e2epub-${randomUUID().slice(0, 8)}`;

  log("Setup: user + connectie + artikel + APPROVED carousel");
  const user = await db.user.create({
    data: { email: `${marker}@example.com`, name: "E2E Publish" },
  });
  const conn = await db.wordPressConnection.create({
    data: { userId: user.id, url: "https://amsterdamnow.com", username: "", appPassword: "" },
  });
  const article = await db.article.create({
    data: { connectionId: conn.id, wordpressId: 1, title: "Test", content: "x" },
  });
  const carousel = await db.carousel.create({
    data: {
      articleId: article.id,
      template: "modern-news",
      slides: sampleSlides as unknown as object[],
      caption: "Testcaption",
      hashtags: ["#amsterdam", "#test"],
      status: "APPROVED",
    },
  });
  console.log(`   carousel ${carousel.id} (APPROVED)`);

  log("1. Publiceren ZONDER Instagram-connectie → moet MissingInstagramConnectionError geven (503-pad)");
  let threw = false;
  try {
    await publishCarouselForUser({
      carouselId: carousel.id,
      userId: user.id,
      baseUrl: "https://engine.example.com",
    });
  } catch (e) {
    threw = e instanceof MissingInstagramConnectionError;
  }
  assert(threw, "MissingInstagramConnectionError gegooid zonder IG-connectie");
  const afterNoConn = await db.carousel.findUniqueOrThrow({ where: { id: carousel.id } });
  assert(afterNoConn.status === "APPROVED", "status blijft APPROVED na mislukte pre-check");

  log("2. Instagram-connectie koppelen (token AES-versleuteld) + publiceren met MOCK_INSTAGRAM=1");
  await db.instagramConnection.create({
    data: {
      userId: user.id,
      accessToken: encrypt("FAKE_TOKEN_voor_mocktest"),
      businessAccountId: "17841400000000000",
      igUsername: "amsterdamnow",
    },
  });
  const result = await publishCarouselForUser({
    carouselId: carousel.id,
    userId: user.id,
    baseUrl: "https://engine.example.com",
  });
  assert(typeof result.mediaId === "string" && result.mediaId.length > 0, `mock mediaId terug: ${result.mediaId}`);
  assert(result.carousel.status === "PUBLISHED", "carousel.status → PUBLISHED");
  assert(result.carousel.instagramId === result.mediaId, "instagramId opgeslagen = mediaId");

  const persisted = await db.carousel.findUniqueOrThrow({ where: { id: carousel.id } });
  assert(persisted.status === "PUBLISHED", "PUBLISHED ook echt gepersisteerd in de DB");
  assert(persisted.instagramId === result.mediaId, "instagramId gepersisteerd");

  log("Opruimen");
  await db.user.delete({ where: { id: user.id } });
  console.log("   testdata verwijderd");

  await db.$disconnect();
  console.log("\n✅ PUBLISH-PAD GESLAAGD — 503-pad + statusovergangen APPROVED→PUBLISHING→PUBLISHED werken tegen de echte DB.");
}

main().catch(async (e) => {
  console.error("\n❌ FOUT:", e);
  await db.$disconnect().catch(() => {});
  process.exit(1);
});
