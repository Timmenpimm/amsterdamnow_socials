/**
 * Koppelt de foto van een zaak aan de slide over díe zaak.
 *
 * Het probleem dat dit oplost: bij een lijstje-carousel kiest het model zelf de
 * sterkste 2 tot 8 items uit een artikel dat er 15 tot 25 heeft. De foto's
 * werden op volgorde uitgedeeld (eerste itemslide → eerste artikelfoto), dus
 * zodra het model item 3, 7 en 12 koos, stond er een foto van de verkeerde zaak
 * bij. De aanroeper (de artikel-tool) kent de koppeling naam → foto wel en
 * stuurt die mee als `byName`; hier wordt de naam op de slide daaraan gematcht.
 *
 * Geen netwerk, geen server-only imports: lib/now-carousel.ts draait ook in de
 * browser en importeert dit bestand.
 */

/** Eén zaak uit het artikel met de foto die erbij hoort. */
export interface NowItemImage {
  /** De naam van de zaak, zoals die in het artikel staat. */
  naam: string;
  /** De foto van die zaak. */
  imageUrl: string;
}

export interface NowItemImageSources {
  /** Coverfoto; laatste terugval als de itempool op is. */
  cover?: string;
  /** Artikelfoto's in documentvolgorde, zonder de cover. */
  items?: readonly string[];
  /** Naam → foto, als de aanroeper de koppeling kent. */
  byName?: readonly NowItemImage[];
}

/**
 * Vanaf deze score geldt een naam als dezelfde zaak. De schaal is getrapt (zie
 * nameMatchScore): 1 = letterlijk gelijk, 0.95 = gelijk na het weglaten van
 * soortwoorden, 0.80-0.90 = de ene naam zit in de andere, 0.60-0.79 = fuzzy.
 * Alles daaronder is geen match en valt terug op de volgorde-pool.
 */
export const MIN_MATCH_SCORE = 0.6;

/** Onder deze gelijkenis (0-1) is een fuzzy match niet te vertrouwen. */
const FUZZY_MIN_SIMILARITY = 0.78;

/** Een substring-match moet minstens zo lang zijn, anders matcht "bar" op alles. */
const MIN_SUBSTRING_LENGTH = 4;

/** …en moet dit deel van de langste naam beslaan. */
const MIN_SUBSTRING_RATIO = 0.4;

/**
 * Soortwoorden waar een zaaknaam mee kan beginnen. "Café Restaurant De
 * Ysbreeker" en "De Ysbreeker" zijn dezelfde zaak; het model kort de naam op de
 * slide vaak in tot het deel dat ertoe doet. Een naam die alleen uit deze
 * woorden bestaat blijft heel (zie coreName).
 */
const GENERIC_PREFIXES = new Set([
  'bakkerij',
  'bar',
  'biercafe',
  'bioscoop',
  'bistro',
  'boekhandel',
  'brasserie',
  'brouwerij',
  'cafe',
  'cocktailbar',
  'club',
  'eetcafe',
  'galerie',
  'grand',
  'hostel',
  'hotel',
  'koffiebar',
  'koffiehuis',
  'lunchroom',
  'museum',
  'pizzeria',
  'proeflokaal',
  'restaurant',
  'snackbar',
  'taproom',
  'theater',
  'wijnbar',
  'winkel',
]);

/** Letters die NFD-decompositie niet uit elkaar haalt. */
const SPECIAL_LETTERS: Record<string, string> = {
  ø: 'o',
  æ: 'ae',
  œ: 'oe',
  ß: 'ss',
  đ: 'd',
  ł: 'l',
};

/**
 * Maakt twee schrijfwijzen van dezelfde naam vergelijkbaar: HTML eruit (het
 * model mag een <br> in item_naam zetten), accenten weg ("Café" = "Cafe"),
 * leestekens weg ("Bar 'Ons'" = "bar ons"), kleine letters, enkele spaties.
 */
export function normalizeName(value: string): string {
  return (value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .toLowerCase()
    .replace(/[øæœßđł]/g, (char) => SPECIAL_LETTERS[char] ?? char)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * De genormaliseerde naam zonder de soortwoorden aan het begin. Houdt altijd
 * minstens één woord over, zodat een zaak die letterlijk "Proeflokaal" heet
 * niet tot een lege naam verdampt.
 */
export function coreName(normalized: string): string {
  const words = normalized.split(' ').filter(Boolean);
  let first = 0;
  while (first < words.length - 1 && GENERIC_PREFIXES.has(words[first])) {
    first += 1;
  }
  return words.slice(first).join(' ');
}

/** Levenshtein-afstand, iteratief met één rij geheugen. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }
    previous = current;
  }

  return previous[b.length];
}

/** 1 = identiek, 0 = niets gemeen. */
function similarity(a: string, b: string): number {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 0;
  return 1 - editDistance(a, b) / longest;
}

/**
 * Hoe zeker is het dat deze twee namen dezelfde zaak zijn? 0 = geen match,
 * 1 = letterlijk dezelfde naam. De trappen liggen zo dat een letterlijke match
 * altijd wint van een gedeeltelijke: staan "Bar Bukowski" én "Bar Bukowski
 * Oost" in het artikel, dan pakt elke slide de zijne.
 */
export function nameMatchScore(slideName: string, candidateName: string): number {
  const a = normalizeName(slideName);
  const b = normalizeName(candidateName);
  if (!a || !b) return 0;
  if (a === b) return 1;

  const coreA = coreName(a);
  const coreB = coreName(b);
  if (coreA && coreA === coreB) return 0.95;

  const [shortest, longest] =
    coreA.length <= coreB.length ? [coreA, coreB] : [coreB, coreA];
  const ratio = longest.length === 0 ? 0 : shortest.length / longest.length;
  if (
    shortest.length >= MIN_SUBSTRING_LENGTH &&
    ratio >= MIN_SUBSTRING_RATIO &&
    longest.includes(shortest)
  ) {
    return 0.8 + 0.1 * ratio;
  }

  const fuzzy = similarity(coreA, coreB);
  if (fuzzy >= FUZZY_MIN_SIMILARITY) {
    return (
      0.6 + ((fuzzy - FUZZY_MIN_SIMILARITY) / (1 - FUZZY_MIN_SIMILARITY)) * 0.19
    );
  }

  return 0;
}

export interface NowItemImageAllocator {
  /**
   * De foto voor het volgende beeldslot, in de volgorde van de slotNames
   * waarmee de allocator gemaakt is. Levert nooit een lege string zolang er
   * überhaupt één beeld is meegegeven.
   */
  next(): string;
}

/**
 * Deelt de artikelfoto's uit over de beeldslots na de cover.
 *
 * `slotNames` is de naam die op elk slot komt te staan, in de volgorde waarin
 * de aanroeper ze opvraagt; een lege string betekent "dit slot heeft geen
 * naam". De matching gebeurt in één keer bij het maken, niet slot voor slot:
 * anders snoept een slot zonder match de foto weg die een later slot juist bij
 * naam had kunnen claimen. Alle slots en kandidaten gaan op score de deur uit,
 * hoogste eerst, en elke foto wordt maar één keer vergeven.
 *
 * Wat er overblijft krijgt de eerstvolgende nog niet uitgedeelde artikelfoto,
 * en is die pool op, de cover. Is er helemaal geen cover, dan herhaalt de pool
 * zich — liever een dubbele foto verderop dan een lege slide.
 */
export function createItemImageAllocator(
  sources: NowItemImageSources,
  slotNames: readonly string[] = []
): NowItemImageAllocator {
  const items = (sources.items ?? []).filter(Boolean);
  const byName = (sources.byName ?? []).filter(
    (entry) => entry && entry.naam && entry.imageUrl
  );

  const used = new Set<string>();
  const reserved = new Map<number, string>();
  let slot = 0;
  let repeatCursor = 0;

  // Alle bruikbare (slot, kandidaat)-combinaties, beste score eerst. Bij gelijke
  // score wint het vroegste slot, en daarna de eerste kandidaat, zodat de
  // uitkomst niet van de sorteerimplementatie afhangt.
  const pairs: { slot: number; candidate: number; score: number }[] = [];
  slotNames.forEach((name, slotIndex) => {
    if (!name) return;
    byName.forEach((entry, candidateIndex) => {
      const score = nameMatchScore(name, entry.naam);
      if (score >= MIN_MATCH_SCORE) {
        pairs.push({ slot: slotIndex, candidate: candidateIndex, score });
      }
    });
  });
  pairs.sort(
    (a, b) => b.score - a.score || a.slot - b.slot || a.candidate - b.candidate
  );

  const takenCandidates = new Set<number>();
  for (const pair of pairs) {
    if (reserved.has(pair.slot) || takenCandidates.has(pair.candidate)) continue;
    const url = byName[pair.candidate].imageUrl;
    // Een al gereserveerde foto (twee items met dezelfde foto) telt als vergeven:
    // het slot valt dan door naar de volgorde-pool in plaats van te dubbelen.
    if (used.has(url)) continue;
    reserved.set(pair.slot, url);
    takenCandidates.add(pair.candidate);
    used.add(url);
  }

  return {
    next(): string {
      const current = slot;
      slot += 1;

      const match = reserved.get(current);
      if (match) return match;

      for (const url of items) {
        if (used.has(url)) continue;
        used.add(url);
        return url;
      }

      if (sources.cover) return sources.cover;
      if (items.length > 0) {
        const url = items[repeatCursor % items.length];
        repeatCursor += 1;
        return url;
      }
      return '';
    },
  };
}
