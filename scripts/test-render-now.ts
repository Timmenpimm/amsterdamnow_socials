import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { closeNowRendererBrowser, renderNowSlide, type RenderNowSlideInput } from '../lib/renderer-now';

/**
 * Manual proof-of-render for the Amsterdam NOW templates. Run with:
 *   npx tsx scripts/test-render-now.ts
 *
 * Renders a representative sample of slide types (including both
 * layout_richting variants of hotspot_detail) to .test-output/now/*.png,
 * then verifies each PNG's IHDR-declared width/height matches the manifest
 * and that the file isn't suspiciously tiny (a blank/broken render).
 */

const OUTPUT_DIR = path.join(process.cwd(), '.test-output', 'now');
const MIN_BYTES = 20 * 1024;
/**
 * Slides without a photo (statement, CTA, practical) are flat text on black
 * and legitimately compress far smaller than a photo slide, so they get their
 * own floor instead of tripping the blank-render check.
 */
const MIN_BYTES_TEXT_ONLY = 6 * 1024;

/** No network dependency: an inline SVG data URI stands in for real photography. */
function placeholderImage(color: string, w: number, h: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${color}"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function parsePngDimensions(buffer: Buffer): { width: number; height: number } {
  const signature = buffer.subarray(0, 8);
  const expected = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!signature.equals(expected)) {
    throw new Error('Not a valid PNG (bad signature).');
  }
  // IHDR is always the first chunk: 4-byte length, 4-byte type "IHDR", then width/height as u32 BE.
  const chunkType = buffer.subarray(12, 16).toString('ascii');
  if (chunkType !== 'IHDR') {
    throw new Error(`Expected IHDR as first chunk, got "${chunkType}".`);
  }
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

interface Sample {
  label: string;
  expected: { width: number; height: number };
  input: RenderNowSlideInput;
  /** Set for photo-less slides; defaults to MIN_BYTES. */
  minBytes?: number;
}

const samples: Sample[] = [
  {
    label: 'hotspot_cover',
    expected: { width: 1080, height: 1350 },
    input: {
      family: 'hotspot',
      slideType: 'cover',
      values: {
        cover_image_url: placeholderImage('#5b5b5b', 1080, 1350),
        categorie: 'RESTAURANT',
        titel_hook: 'Nieuw bakkerijtje in de Pijp',
      },
    },
  },
  {
    label: 'hotspot_detail_foto-links',
    expected: { width: 1080, height: 1350 },
    input: {
      family: 'hotspot',
      slideType: 'detail',
      values: {
        detail_image_url: placeholderImage('#6b6b6b', 1080, 1350),
        detail_label: 'HET VERHAAL',
        detail_title: 'Van rafelrandje naar buurthotspot',
        detail_body:
          'Twee jaar geleden nog een leegstaand pand, nu de drukste plek van de straat. De eigenaren kennen iedereen bij naam.',
        layout_richting: 'foto-links',
      },
    },
  },
  {
    label: 'hotspot_detail_foto-rechts',
    expected: { width: 1080, height: 1350 },
    input: {
      family: 'hotspot',
      slideType: 'detail',
      values: {
        detail_image_url: placeholderImage('#6b6b6b', 1080, 1350),
        detail_label: 'HET VERHAAL',
        detail_title: 'Van rafelrandje naar buurthotspot',
        detail_body:
          'Twee jaar geleden nog een leegstaand pand, nu de drukste plek van de straat. De eigenaren kennen iedereen bij naam.',
        layout_richting: 'foto-rechts',
      },
    },
  },
  {
    label: 'lijstje_cover',
    expected: { width: 1080, height: 1350 },
    input: {
      family: 'lijstje',
      slideType: 'cover',
      values: {
        cover_image_url: placeholderImage('#5b5b5b', 1080, 1350),
        aantal_items: '10',
        categorie: 'KOFFIE',
        kop: 'Beste koffie van Amsterdam',
      },
    },
  },
  {
    label: 'lijstje_item',
    expected: { width: 1080, height: 1350 },
    input: {
      family: 'lijstje',
      slideType: 'item',
      // item_nummer intentionally unpadded here — proves renderer auto-zero-pads.
      values: {
        item_nummer: '1',
        item_image_url: placeholderImage('#4a4a4a', 1080, 1350),
        item_naam: 'Bakkerij Bond',
        item_wijk: 'Oost',
        item_body: 'Zuurdesem uit eigen oven, en om elf uur is het brood op.',
      },
    },
  },
  {
    label: 'lijstje_cta',
    expected: { width: 1080, height: 1350 },
    minBytes: MIN_BYTES_TEXT_ONLY,
    input: {
      family: 'lijstje',
      slideType: 'cta',
      values: { cta_titel: 'De volledige lijst', cta_sub: 'Staat in onze bio' },
    },
  },
  {
    label: 'lijstje_editie_cover',
    expected: { width: 1080, height: 1350 },
    input: {
      family: 'lijstje',
      slideType: 'editie-cover',
      values: {
        cover_image_url: placeholderImage('#5b5b5b', 1080, 1350),
        editie_titel: 'De beste hotspots van juli 2026',
        editie_footer: 'Editie 7',
      },
    },
  },
  {
    label: 'agenda_cover',
    expected: { width: 1080, height: 1350 },
    input: {
      family: 'agenda',
      slideType: 'cover',
      values: {
        cover_image_url: placeholderImage('#5b5b5b', 1080, 1350),
        kicker: 'Cultuur',
        datum: '25 jul — 16 aug',
        event_titel: 'Universal Color',
        locatie: 'NDSM-loods, Amsterdam Noord',
      },
    },
  },
  {
    label: 'agenda_wat',
    expected: { width: 1080, height: 1350 },
    input: {
      family: 'agenda',
      slideType: 'wat',
      values: {
        sfeer_image_url: placeholderImage('#4a4a4a', 1080, 1350),
        label: 'Wat is het?',
        reden_zin: 'Twintig meter hoog, en je loopt er middendoor.',
      },
    },
  },
  {
    label: 'agenda_praktisch',
    expected: { width: 1080, height: 1350 },
    minBytes: MIN_BYTES_TEXT_ONLY,
    input: {
      family: 'agenda',
      slideType: 'praktisch',
      values: {
        wanneer: 'Dagelijks 10:00 — 22:00',
        wanneer_extra: 'Laatste toegang 21:15',
        waar: 'NDSM-loods, Noord',
        waar_extra: 'Veer 906 vanaf Centraal',
        tickets: 'Vanaf €18,50',
        tickets_extra: 'Kinderen tot 12 gratis',
      },
    },
  },
  {
    label: 'agenda_cta',
    expected: { width: 1080, height: 1350 },
    minBytes: MIN_BYTES_TEXT_ONLY,
    input: {
      family: 'agenda',
      slideType: 'cta',
      values: { cta_titel: 'Plan je bezoek', cta_sub: 'Datums en tickets in onze bio' },
    },
  },
  {
    label: 'gids_cover',
    expected: { width: 1080, height: 1350 },
    input: {
      family: 'gids',
      slideType: 'cover',
      values: {
        cover_image_url: placeholderImage('#5b5b5b', 1080, 1350),
        kicker: 'Buurten / West',
        gids_titel: 'Een dag op Westergas',
        gids_sub: 'Vier plekken, van eerste koffie tot laatste rondje',
      },
    },
  },
  {
    label: 'gids_item',
    expected: { width: 1080, height: 1350 },
    input: {
      family: 'gids',
      slideType: 'item',
      values: {
        item_image_url: placeholderImage('#4a4a4a', 1080, 1350),
        item_nummer: '01',
        item_categorie: 'Koffie',
        item_naam: 'Coffee Bru',
        item_body: 'Bakken ze zelf. Zit je zo een uur, met de krant.',
      },
    },
  },
  {
    label: 'gids_cta',
    expected: { width: 1080, height: 1350 },
    minBytes: MIN_BYTES_TEXT_ONLY,
    input: {
      family: 'gids',
      slideType: 'cta',
      values: { cta_titel: 'Bewaar deze gids', cta_sub: 'De hele route staat in onze bio' },
    },
  },
  {
    label: 'event_hook',
    expected: { width: 1080, height: 1920 },
    input: {
      family: 'event',
      slideType: 'hook',
      values: {
        event_image_url: placeholderImage('#333333', 1080, 1920),
        datum: 'VRIJDAG 23 MEI',
        event_titel: 'Zomerfestival op het Westerpark',
      },
    },
  },
];

async function main(): Promise<void> {
  await mkdir(OUTPUT_DIR, { recursive: true });

  const results: Array<{ label: string; bytes: number; dims: string; ok: boolean; note: string }> = [];

  for (const sample of samples) {
    const buffer = await renderNowSlide(sample.input);
    const filePath = path.join(OUTPUT_DIR, `${sample.label}.png`);
    await writeFile(filePath, buffer);

    const { width, height } = parsePngDimensions(buffer);
    const dimsOk = width === sample.expected.width && height === sample.expected.height;
    const minBytes = sample.minBytes ?? MIN_BYTES;
    const sizeOk = buffer.byteLength > minBytes;

    results.push({
      label: sample.label,
      bytes: buffer.byteLength,
      dims: `${width}x${height}`,
      ok: dimsOk && sizeOk,
      note: [dimsOk ? '' : `expected ${sample.expected.width}x${sample.expected.height}`, sizeOk ? '' : `<${Math.round(minBytes / 1024)}KB!`]
        .filter(Boolean)
        .join(' '),
    });
  }

  console.log('\nAmsterdam NOW template render check\n');
  for (const r of results) {
    const status = r.ok ? 'OK  ' : 'FAIL';
    const kb = (r.bytes / 1024).toFixed(1);
    console.log(`[${status}] ${r.label.padEnd(28)} ${r.dims.padEnd(11)} ${kb.padStart(7)} KB  ${r.note}`);
  }

  const failures = results.filter((r) => !r.ok);
  if (failures.length > 0) {
    console.error(`\n${failures.length} render(s) failed validation.`);
    process.exitCode = 1;
  } else {
    console.log(`\nAll ${results.length} renders passed (exact dimensions, above the blank-render floor).`);
  }
}

main()
  .catch((error) => {
    console.error('test-render-now failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void closeNowRendererBrowser();
  });
