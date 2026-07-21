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
      values: { aantal_items: '10', categorie: 'KOFFIE', kop: 'Beste koffie van Amsterdam' },
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
      },
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
    const sizeOk = buffer.byteLength > MIN_BYTES;

    results.push({
      label: sample.label,
      bytes: buffer.byteLength,
      dims: `${width}x${height}`,
      ok: dimsOk && sizeOk,
      note: [dimsOk ? '' : `expected ${sample.expected.width}x${sample.expected.height}`, sizeOk ? '' : '<20KB!']
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
    console.log(`\nAll ${results.length} renders passed (exact dimensions, >20KB).`);
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
