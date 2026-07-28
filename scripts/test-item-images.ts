/**
 * Unit tests voor de naam→foto-koppeling van de NOW-itemslides.
 *
 * Draaien met:
 *   npx tsx scripts/test-item-images.ts
 *
 * Geen netwerk, geen model, geen database: dit test lib/now-item-images.ts en
 * de toewijzing in buildNowSlides() (lib/now-carousel.ts) rechtstreeks. De
 * eigenschap die telt is dat een itemslide de foto van zijn eigen zaak krijgt,
 * ook als het model de items niet in artikelvolgorde kiest — en dat een
 * mismatch nooit tot een lege beeld-URL of een dubbele foto leidt.
 */

import { buildNowSlides, type NowStoredSlide } from "../lib/now-carousel";
import {
  createItemImageAllocator,
  nameMatchScore,
  normalizeName,
  type NowItemImage,
} from "../lib/now-item-images";

let passed = 0;
const failures: { name: string; error: unknown }[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
    passed += 1;
    console.log(`ok   - ${name}`);
  } catch (error) {
    failures.push({ name, error });
    console.log(`FAIL - ${name}`);
    console.log(`       ${(error as Error).message}`);
  }
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

function assertEqual<T>(actual: T, expected: T, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}\n       verwacht: ${expected}\n       kreeg:    ${actual}`);
  }
}

// --- Het artikel: 6 zaken met elk hun eigen foto. -------------------------

const ARTICLE_ITEMS: NowItemImage[] = [
  { naam: "Café Loetje", imageUrl: "https://cdn.test/loetje.jpg" },
  { naam: "Café Restaurant De Ysbreeker", imageUrl: "https://cdn.test/ysbreeker.jpg" },
  { naam: "Bar Bukowski", imageUrl: "https://cdn.test/bukowski.jpg" },
  { naam: "Bar Bukowski Oost", imageUrl: "https://cdn.test/bukowski-oost.jpg" },
  { naam: "Restaurant Breda", imageUrl: "https://cdn.test/breda.jpg" },
  { naam: "Wilde Zwijnen", imageUrl: "https://cdn.test/wilde-zwijnen.jpg" },
];

const ARTICLE_URLS = ARTICLE_ITEMS.map((item) => item.imageUrl);
const COVER = "https://cdn.test/cover.jpg";

/**
 * Deelt de foto's uit over de opgegeven slidenamen en geeft terug wat elke
 * slide kreeg — de allocator matcht alle slides in één keer, dus de hele lijst
 * gaat er in één keer in.
 */
function allocate(
  names: string[],
  sources: {
    cover?: string;
    items?: readonly string[];
    byName?: readonly NowItemImage[];
  } = {}
): string[] {
  const allocator = createItemImageAllocator(
    {
      cover: 'cover' in sources ? sources.cover : COVER,
      items: sources.items ?? ARTICLE_URLS,
      byName: sources.byName ?? ARTICLE_ITEMS,
    },
    names
  );
  return names.map(() => allocator.next());
}

// --- normalizeName --------------------------------------------------------

test("normalizeName haalt accenten, leestekens en HTML weg", () => {
  assertEqual(normalizeName("Café Loetje"), "cafe loetje", "accent");
  assertEqual(normalizeName("Bar 'Ons'"), "bar ons", "leestekens");
  assertEqual(normalizeName("Café<br>Loetje"), "cafe loetje", "<br>");
  assertEqual(normalizeName("  DE   YSBREEKER "), "de ysbreeker", "spaties/hoofdletters");
});

// --- nameMatchScore -------------------------------------------------------

test("exacte naam scoort maximaal", () => {
  assertEqual(nameMatchScore("Café Loetje", "Café Loetje"), 1, "identiek");
});

test("naam met accentverschil matcht (Café Loetje vs Cafe Loetje)", () => {
  assertEqual(nameMatchScore("Cafe Loetje", "Café Loetje"), 1, "accent genegeerd");
});

test("een naam die nergens op lijkt matcht niet", () => {
  for (const item of ARTICLE_ITEMS) {
    assertEqual(
      nameMatchScore("Het Zwarte Fietsenplan", item.naam),
      0,
      `onterechte match op "${item.naam}"`
    );
  }
});

// --- De allocator ---------------------------------------------------------

test('exacte naam krijgt zijn eigen foto', () => {
  assertEqual(
    allocate(['Café Loetje'])[0],
    'https://cdn.test/loetje.jpg',
    'verkeerde foto'
  );
});

test('naam met accentverschil krijgt zijn eigen foto', () => {
  assertEqual(
    allocate(['Cafe Loetje'])[0],
    'https://cdn.test/loetje.jpg',
    'verkeerde foto'
  );
});

test('ingekorte naam krijgt zijn eigen foto (De Ysbreeker)', () => {
  assertEqual(
    allocate(['De Ysbreeker'])[0],
    'https://cdn.test/ysbreeker.jpg',
    'verkeerde foto'
  );
});

test('twee bijna gelijke namen krijgen elk hun eigen foto', () => {
  // Bewust de langste eerst: de kortere naam mag niet al opgesnoept zijn.
  const gekregen = allocate(['Bar Bukowski Oost', 'Bar Bukowski']);
  assertEqual(gekregen[0], 'https://cdn.test/bukowski-oost.jpg', 'Bukowski Oost');
  assertEqual(gekregen[1], 'https://cdn.test/bukowski.jpg', 'Bukowski');
});

test('twee bijna gelijke namen, andersom, ook elk hun eigen foto', () => {
  const gekregen = allocate(['Bar Bukowski', 'Bar Bukowski Oost']);
  assertEqual(gekregen[0], 'https://cdn.test/bukowski.jpg', 'Bukowski');
  assertEqual(gekregen[1], 'https://cdn.test/bukowski-oost.jpg', 'Bukowski Oost');
});

test('naam zonder match pakt een niet-uitgedeelde foto', () => {
  const gekregen = allocate(['Café Loetje', 'Het Zwarte Fietsenplan']);
  assertEqual(gekregen[0], 'https://cdn.test/loetje.jpg', 'match');
  assert(
    ARTICLE_URLS.includes(gekregen[1]) && gekregen[1] !== gekregen[0],
    `terugval koos "${gekregen[1]}" — moest een ongebruikte artikelfoto zijn`
  );
});

test('een naam zonder match snoept geen foto weg van een naam die wél matcht', () => {
  // De onbekende naam staat vóór de zaken die de twee foto's claimen; wordt er
  // slide voor slide toegewezen in plaats van in één keer, dan pakt hij de
  // eerste foto en krijgt Loetje de foto van Ysbreeker.
  const twee = ARTICLE_ITEMS.slice(0, 2);
  const gekregen = allocate(
    ['Het Zwarte Fietsenplan', 'Café Loetje', 'De Ysbreeker', 'Wilde Zwijnen'],
    { items: twee.map((i) => i.imageUrl), byName: twee }
  );
  assertEqual(gekregen[1], 'https://cdn.test/loetje.jpg', 'Loetje op naam');
  assertEqual(gekregen[2], 'https://cdn.test/ysbreeker.jpg', 'Ysbreeker op naam');
  // Twee foto's, vier slides: wat niet matcht valt terug op de cover.
  assertEqual(gekregen[0], COVER, 'eerste zonder match → cover');
  assertEqual(gekregen[3], COVER, 'vierde zonder foto → cover');
  assert(
    gekregen.every((url) => url.length > 0),
    'een slide kreeg een lege beeld-URL'
  );
});

test('pool precies groot genoeg: elke slide een andere foto, ook zonder cover', () => {
  const vier = ARTICLE_ITEMS.slice(0, 4);
  const gekregen = allocate(
    // De eerste naam matcht nergens op en moet dus uit de volgorde-pool komen,
    // zonder een foto af te pakken die een van de andere drie claimt.
    ['Het Zwarte Fietsenplan', 'Bar Bukowski', 'Café Loetje', 'De Ysbreeker'],
    { cover: undefined, items: vier.map((i) => i.imageUrl), byName: vier }
  );
  assertEqual(gekregen[1], 'https://cdn.test/bukowski.jpg', 'Bukowski op naam');
  assertEqual(gekregen[2], 'https://cdn.test/loetje.jpg', 'Loetje op naam');
  assertEqual(gekregen[3], 'https://cdn.test/ysbreeker.jpg', 'Ysbreeker op naam');
  assertEqual(new Set(gekregen).size, 4, 'twee slides delen een foto');
  assert(
    gekregen.every((url) => url.length > 0),
    'een slide kreeg een lege beeld-URL'
  );
});

test('meer items dan foto\'s: nooit leeg, en de matches blijven staan', () => {
  const drie = ARTICLE_ITEMS.slice(0, 3);
  const gekregen = allocate(
    ['Wilde Zwijnen', 'Bar Bukowski', 'Café Loetje', 'De Ysbreeker'],
    { cover: undefined, items: drie.map((i) => i.imageUrl), byName: drie }
  );
  assertEqual(gekregen[1], 'https://cdn.test/bukowski.jpg', 'Bukowski op naam');
  assertEqual(gekregen[2], 'https://cdn.test/loetje.jpg', 'Loetje op naam');
  assertEqual(gekregen[3], 'https://cdn.test/ysbreeker.jpg', 'Ysbreeker op naam');
  // Drie foto's, vier slides, geen cover: de laatste terugval herhaalt de pool
  // — een dubbele foto is dan beter dan een lege slide.
  assert(
    gekregen.every((url) => url.length > 0),
    'een slide kreeg een lege beeld-URL'
  );
});

test('lege pool valt terug op de cover, nooit op een lege URL', () => {
  assertEqual(
    allocate(['Wat dan ook'], { items: [], byName: [] })[0],
    COVER,
    'cover-terugval'
  );
});

test('zonder cover en zonder foto\'s komt er een lege string uit, zonder te gooien', () => {
  const allocator = createItemImageAllocator({}, ['Wat dan ook']);
  assertEqual(allocator.next(), '', 'lege bronnen');
});

// --- buildNowSlides end-to-end -------------------------------------------

/**
 * Een draft zoals het model hem oplevert: het koos zes zaken uit het artikel,
 * NIET in artikelvolgorde. Precies de situatie waarin de oude toewijzing op
 * volgorde de verkeerde foto bij de zaak zette.
 */
const SHUFFLED_NAMES = [
  "Wilde Zwijnen",
  "Café Loetje",
  "Bar Bukowski Oost",
  "De Ysbreeker",
  "Breda",
  "Bar Bukowski",
];

function lijstjeDraft(namen: string[]) {
  return {
    cover: { kop: "", quote: "De zes beste van Oost" },
    item: namen.map((naam) => ({
      item_naam: naam,
      item_wijk: "Oost",
      item_body: `Waarom ${naam} de moeite waard is.`,
      item_categorie: "ETEN",
    })),
    cta: { cta_titel: "DE VOLLEDIGE LIJST", cta_sub: "Staat in onze bio" },
  };
}

function itemSlides(slides: NowStoredSlide[]): NowStoredSlide[] {
  return slides.filter((slide) => slide.slideType === "item");
}

test("buildNowSlides: elke itemslide krijgt de foto van zijn eigen zaak", () => {
  const slides = buildNowSlides(
    "lijstje",
    lijstjeDraft(SHUFFLED_NAMES),
    { cover: COVER, items: ARTICLE_URLS, byName: ARTICLE_ITEMS },
    "De zes beste eetzaken van Oost"
  );

  const expected: Record<string, string> = {
    "Wilde Zwijnen": "https://cdn.test/wilde-zwijnen.jpg",
    "Café Loetje": "https://cdn.test/loetje.jpg",
    "Bar Bukowski Oost": "https://cdn.test/bukowski-oost.jpg",
    "De Ysbreeker": "https://cdn.test/ysbreeker.jpg",
    Breda: "https://cdn.test/breda.jpg",
    "Bar Bukowski": "https://cdn.test/bukowski.jpg",
  };

  for (const slide of itemSlides(slides)) {
    const naam = slide.values.item_naam;
    assertEqual(
      slide.values.item_image_url,
      expected[naam],
      `slide "${naam}" kreeg de verkeerde foto`
    );
  }

  assertEqual(slides[0].values.cover_image_url, COVER, "coverfoto");
});

test("buildNowSlides: geen twee slides met dezelfde foto, geen lege URL", () => {
  const slides = buildNowSlides(
    "lijstje",
    lijstjeDraft(SHUFFLED_NAMES),
    { cover: COVER, items: ARTICLE_URLS, byName: ARTICLE_ITEMS },
    "De zes beste eetzaken van Oost"
  );

  const urls = itemSlides(slides).map((slide) => slide.values.item_image_url);
  assert(
    urls.every((url) => typeof url === "string" && url.length > 0),
    "een itemslide heeft een lege beeld-URL"
  );
  assertEqual(new Set(urls).size, urls.length, "twee itemslides delen een foto");
});

test("buildNowSlides: een naam zonder match breekt de generatie niet", () => {
  const namen = [...SHUFFLED_NAMES.slice(0, 3), "Het Zwarte Fietsenplan"];
  const slides = buildNowSlides(
    "lijstje",
    lijstjeDraft(namen),
    { cover: COVER, items: ARTICLE_URLS, byName: ARTICLE_ITEMS },
    "De vier beste eetzaken van Oost"
  );

  const items = itemSlides(slides);
  assertEqual(items.length, 4, "aantal itemslides");
  const urls = items.map((slide) => slide.values.item_image_url);
  assert(
    urls.every((url) => url.length > 0),
    "een itemslide heeft een lege beeld-URL"
  );
  assertEqual(new Set(urls).size, urls.length, "twee itemslides delen een foto");
  assert(
    ARTICLE_URLS.includes(urls[3]),
    `zonder match verwacht een artikelfoto, kreeg "${urls[3]}"`
  );
});

test("buildNowSlides: zonder byName blijft de toewijzing op volgorde", () => {
  const slides = buildNowSlides(
    "lijstje",
    lijstjeDraft(SHUFFLED_NAMES),
    { cover: COVER, items: ARTICLE_URLS },
    "De zes beste eetzaken van Oost"
  );

  const urls = itemSlides(slides).map((slide) => slide.values.item_image_url);
  assertEqual(urls.join("|"), ARTICLE_URLS.join("|"), "volgorde-gedrag veranderd");
});

test("buildNowSlides: minder foto's dan items levert nooit een lege URL", () => {
  const twee = ARTICLE_ITEMS.slice(0, 2);
  const slides = buildNowSlides(
    "lijstje",
    lijstjeDraft(SHUFFLED_NAMES),
    { cover: COVER, items: twee.map((i) => i.imageUrl), byName: twee },
    "De zes beste eetzaken van Oost"
  );

  const urls = itemSlides(slides).map((slide) => slide.values.item_image_url);
  assert(
    urls.every((url) => url.length > 0),
    "een itemslide heeft een lege beeld-URL"
  );
  assertEqual(urls[1], "https://cdn.test/loetje.jpg", "Loetje op naam");
  assertEqual(urls[3], "https://cdn.test/ysbreeker.jpg", "Ysbreeker op naam");
});

test('buildNowSlides: een familie zonder naamtoken merkt niets van byName', () => {
  // agenda heeft geen item_naam; de foto's moeten dan gewoon op volgorde de
  // slides in, precies als vóór de koppeling.
  const draft = {
    cover: {
      kicker: 'DIT WEEKEND',
      datum: 'ZA 12 OKT',
      event_titel: 'Nachtlab',
      locatie: 'Oost',
      quote: '',
    },
    wat: { label: 'WAT', reden_zin: 'Waarom je moet gaan.', quote: '' },
    praktisch: {
      wanneer: 'Zaterdag',
      wanneer_extra: '20.00',
      waar: 'Oost',
      waar_extra: 'Zeeburgerpad',
      tickets: '12 euro',
      tickets_extra: 'Aan de deur',
    },
    cta: { cta_titel: 'KOM LANGS', cta_sub: 'Link in bio' },
  };

  const zonder = buildNowSlides('agenda', draft, {
    cover: COVER,
    items: ARTICLE_URLS,
  });
  const met = buildNowSlides('agenda', draft, {
    cover: COVER,
    items: ARTICLE_URLS,
    byName: ARTICLE_ITEMS,
  });

  assertEqual(
    JSON.stringify(met),
    JSON.stringify(zonder),
    'byName veranderde een carousel zonder naamtoken'
  );
});

console.log(
  `\n${passed} van de ${passed + failures.length} tests geslaagd.` +
    (failures.length ? ` ${failures.length} gefaald.` : "")
);
if (failures.length > 0) process.exitCode = 1;
