/**
 * Typed manifest for the Amsterdam NOW render-ready HTML templates.
 *
 * These 11 files (in this same directory) are a verbatim design handoff from
 * Claude Design — see docs/design/social-templates/HANDOFF-README.md. They
 * are used as-is: {{placeholder}} tokens get string-replaced, then the file
 * is screenshotted at its exact pixel size (lib/renderer-now.ts). Do not
 * reimplement the markup; this manifest only describes it.
 */

export type NowTemplateFamily = 'hotspot' | 'lijstje' | 'event';

export type HotspotSlideType = 'cover' | 'detail' | 'statement' | 'cta';
export type LijstjeSlideType = 'cover' | 'item' | 'cta';
export type EventSlideType = 'hook' | 'reason' | 'practical' | 'link';

/** Union of all slide types across families. Scope with `family` for a unique key. */
export type NowSlideType = HotspotSlideType | LijstjeSlideType | EventSlideType;

export interface NowPlaceholderSpec {
  /** Token name, without the {{ }} delimiters. */
  name: string;
  /** What content belongs here, for whoever fills in `values`. */
  description: string;
  /**
   * True when the value is inserted inside a CSS `url(...)` (an image URL).
   * Must NOT be HTML-escaped — only CSS-string-escaped (quotes/backslashes).
   */
  isUrl?: boolean;
  /**
   * Fixed literal values this placeholder accepts (e.g. layout_richting).
   * Inserted verbatim — not HTML-escaped — because it doubles as a CSS class name.
   */
  enumValues?: readonly string[];
  /** Numeric value must be zero-padded to this many digits (e.g. item_nummer -> "01"). */
  zeroPadTo?: number;
}

export interface NowTemplateSpec {
  family: NowTemplateFamily;
  slideType: NowSlideType;
  /** Filename inside templates/now/, e.g. "hotspot_cover.html". */
  file: string;
  dimensions: { width: number; height: number };
  placeholders: NowPlaceholderSpec[];
  /** How often this slide type may/must appear within one carousel or story. */
  reuse: {
    min: number;
    max: number;
    description: string;
  };
}

const HOTSPOT_DIMENSIONS = { width: 1080, height: 1350 };
const LIJSTJE_DIMENSIONS = { width: 1080, height: 1350 };
const EVENT_DIMENSIONS = { width: 1080, height: 1920 };

export const NOW_TEMPLATE_MANIFEST: readonly NowTemplateSpec[] = [
  // --- Hotspot carousel (new restaurants, shops, places) ---
  {
    family: 'hotspot',
    slideType: 'cover',
    file: 'hotspot_cover.html',
    dimensions: HOTSPOT_DIMENSIONS,
    placeholders: [
      { name: 'cover_image_url', description: 'Full-bleed cover photo URL', isUrl: true },
      { name: 'categorie', description: 'Red uppercase category label, e.g. "RESTAURANT"' },
      { name: 'titel_hook', description: 'Large white headline, max ~6 words' },
    ],
    reuse: { min: 1, max: 1, description: 'Always slide 1 of the hotspot carousel.' },
  },
  {
    family: 'hotspot',
    slideType: 'detail',
    file: 'hotspot_detail.html',
    dimensions: HOTSPOT_DIMENSIONS,
    placeholders: [
      { name: 'detail_image_url', description: 'Detail photo, 60% width', isUrl: true },
      { name: 'detail_label', description: 'Small red uppercase label above the title' },
      { name: 'detail_title', description: 'Detail slide headline' },
      { name: 'detail_body', description: '2-3 sentence body copy' },
      {
        name: 'layout_richting',
        description: 'Which side the photo sits on; flips flex-direction via CSS class.',
        enumValues: ['foto-links', 'foto-rechts'],
      },
    ],
    reuse: { min: 1, max: 3, description: 'Reused up to 3x, typically slides 3-5, alternating layout_richting.' },
  },
  {
    family: 'hotspot',
    slideType: 'statement',
    file: 'hotspot_statement.html',
    dimensions: HOTSPOT_DIMENSIONS,
    placeholders: [
      { name: 'quote', description: 'Centered editorial pull-quote' },
    ],
    reuse: { min: 1, max: 1, description: 'One statement slide per carousel.' },
  },
  {
    family: 'hotspot',
    slideType: 'cta',
    file: 'hotspot_cta.html',
    dimensions: HOTSPOT_DIMENSIONS,
    placeholders: [
      { name: 'plek_naam', description: 'Venue name' },
      { name: 'wijk', description: 'Neighborhood' },
    ],
    reuse: { min: 1, max: 1, description: 'Always the final slide.' },
  },

  // --- Lijstje carousel ("N best X in Amsterdam") ---
  {
    family: 'lijstje',
    slideType: 'cover',
    file: 'lijstje_cover.html',
    dimensions: LIJSTJE_DIMENSIONS,
    placeholders: [
      { name: 'aantal_items', description: 'Huge black number: how many items the list has' },
      { name: 'categorie', description: 'Vertical red uppercase category label (writing-mode: vertical-rl)' },
      { name: 'kop', description: 'Black headline, max 4 words' },
    ],
    reuse: { min: 1, max: 1, description: 'Always slide 1 of the lijstje carousel.' },
  },
  {
    family: 'lijstje',
    slideType: 'item',
    file: 'lijstje_item.html',
    dimensions: LIJSTJE_DIMENSIONS,
    placeholders: [
      {
        name: 'item_nummer',
        description: 'Rank number, large white numeral top-left',
        zeroPadTo: 2,
      },
      { name: 'item_image_url', description: 'Full-bleed item photo', isUrl: true },
      { name: 'item_naam', description: 'Place name' },
      {
        name: 'item_wijk',
        description: 'Neighborhood only — template prefixes it with "Amsterdam " automatically.',
      },
    ],
    reuse: { min: 1, max: 10, description: 'Reused once per ranked entry, up to 10x.' },
  },
  {
    family: 'lijstje',
    slideType: 'cta',
    file: 'lijstje_cta.html',
    dimensions: LIJSTJE_DIMENSIONS,
    placeholders: [],
    reuse: { min: 1, max: 1, description: 'Static closing slide, no placeholders — always the final slide.' },
  },

  // --- Event story (Instagram Stories, 4 frames) ---
  {
    family: 'event',
    slideType: 'hook',
    file: 'event_hook.html',
    dimensions: EVENT_DIMENSIONS,
    placeholders: [
      { name: 'event_image_url', description: 'Full-bleed event photo', isUrl: true },
      { name: 'datum', description: 'Date, white uppercase, e.g. "VRIJDAG 23 MEI"' },
      { name: 'event_titel', description: 'White headline, max 5 words' },
    ],
    reuse: { min: 1, max: 1, description: 'Always frame 1.' },
  },
  {
    family: 'event',
    slideType: 'reason',
    file: 'event_reason.html',
    dimensions: EVENT_DIMENSIONS,
    placeholders: [
      { name: 'event_image_url', description: 'Full-bleed photo behind the 50% dark overlay', isUrl: true },
      { name: 'reden_zin', description: 'One centered white sentence: why go' },
    ],
    reuse: { min: 1, max: 1, description: 'Always frame 2.' },
  },
  {
    family: 'event',
    slideType: 'practical',
    file: 'event_practical.html',
    dimensions: EVENT_DIMENSIONS,
    placeholders: [
      { name: 'wanneer', description: 'WANNEER value' },
      { name: 'waar', description: 'WAAR value' },
      { name: 'prijs', description: 'PRIJS value' },
    ],
    reuse: { min: 1, max: 1, description: 'Always frame 3, white background with practical info.' },
  },
  {
    family: 'event',
    slideType: 'link',
    file: 'event_link.html',
    dimensions: EVENT_DIMENSIONS,
    placeholders: [
      { name: 'event_image_url', description: 'Bottom two-thirds photo', isUrl: true },
    ],
    reuse: {
      min: 1,
      max: 1,
      description:
        'Always frame 4. Top third stays clean white for the native Instagram link sticker (added manually in-app).',
    },
  },
];

export function getNowTemplateSpec(family: NowTemplateFamily, slideType: NowSlideType): NowTemplateSpec {
  const spec = NOW_TEMPLATE_MANIFEST.find((s) => s.family === family && s.slideType === slideType);
  if (!spec) {
    throw new Error(`No NOW template found for family="${family}" slideType="${slideType}"`);
  }
  return spec;
}
