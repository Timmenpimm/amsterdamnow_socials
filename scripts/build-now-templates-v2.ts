import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Regenerates the eleven live Amsterdam NOW slide templates
 * (templates/now/{agenda,lijstje,gids}_*.html) in the "Carousel — Templates v2"
 * design language.
 *
 * Why a script instead of hand-editing: the first five lines of every template
 * carry megabytes of base64 woff2 inside three @font-face rules. Those lines
 * are copied through verbatim; only the CSS after them and the <body> markup
 * are rewritten. Running this again is idempotent — it reads the head from the
 * file it is about to overwrite.
 *
 * Layout in this design language, per slide:
 *   full-bleed photo -> veil -> optional tag/badge top-right -> centred band
 *   (white rule or item number, headline, optional quote) -> optional place
 *   bottom-left -> logo bottom-right.
 *
 * Run with: npx tsx scripts/build-now-templates-v2.ts
 */

const TEMPLATE_DIR = path.join(process.cwd(), 'templates', 'now');
const LOGO_FILE = path.join(process.cwd(), 'assets', 'brand', 'ams-logo-now.png');

/** Lines 1-5: <!doctype>, <html><head><style>, and the three @font-face rules. */
const PRESERVED_HEAD_LINES = 5;

/**
 * Rendered at 56px tall, so the embedded copy is downscaled to 112px (2x) to
 * keep every template small — the fonts already dominate the file size.
 */
const LOGO_EMBED_HEIGHT = 112;

/** Shared by all eleven slides; slide-specific rules are appended after it. */
const BASE_CSS = `
*{margin:0;padding:0;box-sizing:border-box}html,body{width:1080px;height:1350px}
:root{--accent:#E90000;--ink:#000;--ink-2:#666;--ink-3:#313131;--display:'Barlow Condensed','Oswald',sans-serif;--body:'Oswald',sans-serif}
.s{width:1080px;height:1350px;position:relative;overflow:hidden;background:#111;font-family:var(--body);-webkit-font-smoothing:antialiased}
.clamp{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
.photo{position:absolute;inset:0;background-color:#111;background-size:cover;background-position:center}
.veil{position:absolute;left:0;right:0;bottom:0;height:62%;pointer-events:none;background:linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(0,0,0,.18) 40%,rgba(0,0,0,.44) 72%,rgba(0,0,0,.62) 100%)}
.veil.t{bottom:auto;top:0;background:linear-gradient(0deg,rgba(0,0,0,0) 0%,rgba(0,0,0,.18) 40%,rgba(0,0,0,.44) 72%,rgba(0,0,0,.62) 100%)}
.veil.b{height:26%;background:linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(0,0,0,.46) 100%)}
.band{position:absolute;left:72px;right:72px;bottom:168px;display:flex;flex-direction:column;align-items:center;gap:34px;text-align:center}
.band.t{bottom:auto;top:152px}
.band.m{bottom:auto;top:50%;transform:translateY(-50%)}
.rule{width:200px;height:12px;background:#fff}
.num{font-family:var(--display);font-weight:700;font-size:52px;letter-spacing:2px;color:#fff;line-height:1}
.num:empty{display:none}
.hd{font-family:var(--display);font-weight:700;text-transform:uppercase;letter-spacing:.6px;font-size:124px;line-height:.86;color:#fff;margin:0;max-width:900px;-webkit-line-clamp:3}
.hd.sm{font-size:100px;line-height:.9}
.hd.xs{font-size:82px;line-height:.94}
.hd:empty{display:none}
.quote{font-family:var(--body);font-weight:300;font-size:42px;line-height:1.22;color:rgba(255,255,255,.94);max-width:780px;margin:-14px 0 0;-webkit-line-clamp:2}
.quote::before{content:'\\2018'}
.quote::after{content:'\\2019'}
.quote:empty{display:none}
.tag{position:absolute;top:64px;right:64px;max-width:560px;background:var(--accent);color:#fff;font-family:var(--display);font-weight:700;text-transform:uppercase;letter-spacing:1.6px;font-size:30px;line-height:1.06;padding:14px 18px 12px}
.tag:empty{display:none}
.place{position:absolute;left:72px;right:300px;bottom:72px;font-family:var(--body);font-weight:400;text-transform:uppercase;letter-spacing:3px;font-size:28px;line-height:1.35;color:rgba(255,255,255,.82);display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;overflow:hidden;overflow-wrap:anywhere}
.logo{position:absolute;right:64px;bottom:64px;height:56px;width:auto}
.hd,.quote,.num,.place{text-shadow:0 2px 28px rgba(0,0,0,.55)}
.rule{box-shadow:0 3px 26px rgba(0,0,0,.42)}
.logo{filter:drop-shadow(0 3px 20px rgba(0,0,0,.45))}
`.trim();

/**
 * Cover slides carry the WordPress article title verbatim (manifest flag
 * `fromArticleTitle`), so the headline is 60-90 characters instead of the 3-5
 * words the rest of the family gets. Three things follow from that.
 *
 * 1. HOOGTEBUDGET IN PLAATS VAN EEN MEEBEWEGENDE BAND. The band is anchored on
 *    its bottom edge (`bottom:168px`, no `top`), so it already grows upward
 *    only: the quote line, the place line and the logo never move, whatever
 *    the headline does. `.band.m` would grow both ways, which is exactly why
 *    the covers do not use it. What the headline still needs is a ceiling, so
 *    it cannot climb into the red tag/badge:
 *
 *      band bottom                      y = 1350 - 168      = 1182
 *      onder de kop: gap 34 + quote-marge -14 + quote 2x51  = 122,5
 *      kop-onderkant                    y = 1182 - 122,5    = 1059,5
 *      kop-bovenkant bij het budget     y = 1059,5 - 420    =   639,5
 *      streep erboven (12 + gap 34)     y = 639,5 - 46      =   593,5
 *      onderkant rode tag (2 regels) / badge   y ≈ 154 / 173
 *      => 420px laat ruim 400px lucht tussen badge en streep.
 *
 *    Bij een lege quote valt die 122,5 weg en zakt de kop juist naar beneden
 *    (bovenkant y = 762), dus dat geval is nooit het krapste.
 *
 *    Waarom 420 en niet meer: de kop zoekt zelf de grootste maat die past
 *    (`data-autofit`). Barlow Condensed uppercase doet op 900px breedte
 *    ~2180/fontmaat tekens per regel; met woordafbreking blijft daar ~1860
 *    van over. Een titel van 89 tekens landt daarmee op 5 regels van ~97px
 *    (5 x 0,86 x 97 = 417), een van 120 tekens op 6 regels van ~81px. Een
 *    ruimer budget levert alleen grotere letters bij dezelfde regelval en
 *    duwt de kop het beeld uit; een krapper budget maakt hem onnodig klein.
 *    Ondergrens 68px, en `-webkit-line-clamp:6` vangt het absurde geval
 *    (>160 tekens) af met een beletselteken in plaats van een halve regel.
 *
 * 2. DE SLUIER MOET MET DE KOP MEEGROEIEN. De vaste `.veil` begint op 62% van
 *    onderen (y=513) en staat op y=640 pas op ~0,05 dekking: precies waar de
 *    bovenste regel van een lange kop terechtkomt, en dus onleesbaar op een
 *    lichte foto. Een vaste sluier die dáár al donker is, slibt de korte-kop-
 *    variant dicht. Daarom hangt de sluier op de band zelf (`.band.hero::before`,
 *    van 150px boven de band tot de onderrand van de slide) met stops in px:
 *    de inloop is altijd even lang, en de donkere zone is precies zo hoog als
 *    de kop die er staat. Onderin eindigt hij op .66, waar de oude `.veil` op
 *    .62 uitkwam — de plaatsregel en het logo staan er dus net zo bij als
 *    voorheen.
 *
 * 3. ROOD OP EEN MIDDENTOON-FOTO. #E90000 heeft tegen een grijsblauwe gracht
 *    nauwelijks contrast. De covers krijgen daarom een korte topsluier (24%,
 *    .34 -> 0) onder de tag/badge plus een slagschaduw op het blokje zelf,
 *    zodat de rand van het rode vlak altijd afsteekt zonder dat de foto
 *    bovenin dichtloopt.
 */
const HERO_COVER_CSS = `
.scrim{position:absolute;left:0;right:0;top:0;height:24%;pointer-events:none;background:linear-gradient(180deg,rgba(0,0,0,.34) 0%,rgba(0,0,0,.16) 46%,rgba(0,0,0,0) 100%)}
.band.hero{z-index:1}
.band.hero::before{content:'';position:absolute;z-index:-1;left:-72px;right:-72px;top:-150px;bottom:-168px;background:linear-gradient(180deg,rgba(0,0,0,0) 0px,rgba(0,0,0,.10) 60px,rgba(0,0,0,.34) 150px,rgba(0,0,0,.52) 240px,rgba(0,0,0,.60) 340px,rgba(0,0,0,.66) 100%)}
.band.hero .hd{max-height:420px;-webkit-line-clamp:6}
.tag,.badge{box-shadow:0 8px 34px rgba(0,0,0,.45)}
.place,.logo{z-index:2}
`.trim();

/** Two values on one bottom-left line, with a middot that disappears with either half. */
const PLACE_PAIR_CSS = `
.place .pb:not(:empty)::before{content:'\\00B7';padding:0 14px;opacity:.55}
.place .pa:empty+.pb::before{content:none}
`.trim();

/** Item slides: the place name gets two lines at most, never three. */
const TWO_LINE_HEADLINE_CSS = '.hd{-webkit-line-clamp:2}';

/** Photo-less CTA slide: black, band centred, nothing else. */
const CTA_CSS = '.s{background:#000}';

const CTA_BODY = `<div class="s">
  <div class="band m">
    <div class="rule"></div>
    <h1 class="hd sm clamp">{{cta_titel}}</h1>
    <div class="quote clamp">{{cta_sub}}</div>
  </div>
  __LOGO__
</div>`;

interface TemplateBuild {
  file: string;
  css?: string;
  body: string;
}

const TEMPLATES: TemplateBuild[] = [
  {
    file: 'agenda_cover.html',
    css: [HERO_COVER_CSS, PLACE_PAIR_CSS].join('\n'),
    body: `<div class="s">
  <div class="photo" style="background-image:url('{{cover_image_url}}')"></div>
  <div class="scrim"></div>
  <div class="tag">{{kicker}}</div>
  <div class="band hero">
    <div class="rule"></div>
    <h1 class="hd clamp" data-autofit data-autofit-min="68">{{event_titel}}</h1>
    <div class="quote clamp">{{quote}}</div>
  </div>
  <div class="place"><span class="pa">{{datum}}</span><span class="pb">{{locatie}}</span></div>
  __LOGO__
</div>`,
  },
  {
    // The one slide anchored to the top: the photo keeps the bottom two thirds.
    file: 'agenda_wat.html',
    css: '.band.t{gap:30px}',
    body: `<div class="s">
  <div class="photo" style="background-image:url('{{sfeer_image_url}}')"></div>
  <div class="veil t"></div>
  <div class="veil b"></div>
  <div class="tag">{{label}}</div>
  <div class="band t">
    <div class="rule"></div>
    <h1 class="hd xs clamp">{{reden_zin}}</h1>
    <div class="quote clamp">{{quote}}</div>
  </div>
  __LOGO__
</div>`,
  },
  {
    // Was a photo-less white info panel; now a photo slide whose optional image
    // falls back to the same dark ground as the rest of the family.
    file: 'agenda_praktisch.html',
    css: `
.dim{position:absolute;inset:0;background:rgba(0,0,0,.35)}
.tagbox{position:absolute;top:64px;right:64px;left:420px;display:flex;flex-direction:column;align-items:flex-end;gap:14px}
.tagbox .tag{position:static;max-width:100%}
.tagnote{font-family:var(--body);font-weight:400;font-size:26px;line-height:1.3;letter-spacing:1px;color:#fff;text-align:right;text-shadow:0 2px 20px rgba(0,0,0,.85);-webkit-line-clamp:2}
.tagnote:empty{display:none}
.place{display:block;-webkit-line-clamp:none}
.place span{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1;overflow:hidden}
.place span:empty{display:none}
.place .p2{margin-top:10px;font-weight:300;font-size:24px;letter-spacing:2px;color:rgba(255,255,255,.62)}
`.trim(),
    body: `<div class="s">
  <div class="photo" style="background-image:url('{{praktisch_image_url}}')"></div>
  <div class="dim"></div>
  <div class="veil"></div>
  <div class="tagbox">
    <div class="tag">{{tickets}}</div>
    <div class="tagnote clamp">{{tickets_extra}}</div>
  </div>
  <div class="band m">
    <div class="rule"></div>
    <h1 class="hd xs clamp">{{wanneer}}</h1>
    <div class="quote clamp">{{wanneer_extra}}</div>
  </div>
  <div class="place"><span class="p1">{{waar}}</span><span class="p2">{{waar_extra}}</span></div>
  __LOGO__
</div>`,
  },
  { file: 'agenda_cta.html', css: CTA_CSS, body: CTA_BODY },

  {
    // The count and its label together make the red block top-right.
    file: 'lijstje_cover.html',
    css: `
${HERO_COVER_CSS}
.badge{position:absolute;top:64px;right:64px;min-width:104px;max-width:300px;background:var(--accent);color:#fff;padding:12px 18px 14px;text-align:center;font-family:var(--display);font-weight:700;text-transform:uppercase}
.badge b{display:block;font-size:60px;line-height:.9;letter-spacing:.5px}
.badge span{display:block;font-size:28px;line-height:1.05;letter-spacing:2px}
.badge b:empty,.badge span:empty{display:none}
.badge:has(b:empty):has(span:empty){display:none}
`.trim(),
    body: `<div class="s">
  <div class="photo" style="background-image:url('{{cover_image_url}}')"></div>
  <div class="scrim"></div>
  <div class="badge"><b>{{aantal_items}}</b><span>{{categorie}}</span></div>
  <div class="band hero">
    <div class="rule"></div>
    <h1 class="hd clamp" data-autofit data-autofit-min="68">{{kop}}</h1>
    <div class="quote clamp">{{quote}}</div>
  </div>
  __LOGO__
</div>`,
  },
  {
    file: 'lijstje_item.html',
    css: TWO_LINE_HEADLINE_CSS,
    body: `<div class="s">
  <div class="photo" style="background-image:url('{{item_image_url}}')"></div>
  <div class="veil"></div>
  <div class="band">
    <div class="num">{{item_nummer}}</div>
    <h1 class="hd sm clamp">{{item_naam}}</h1>
    <div class="quote clamp">{{item_body}}</div>
  </div>
  <div class="place">Amsterdam {{item_wijk}}</div>
  __LOGO__
</div>`,
  },
  { file: 'lijstje_cta.html', css: CTA_CSS, body: CTA_BODY },
  {
    file: 'lijstje_editie_cover.html',
    css: HERO_COVER_CSS,
    body: `<div class="s">
  <div class="photo" style="background-image:url('{{cover_image_url}}')"></div>
  <div class="scrim"></div>
  <div class="tag">{{editie_footer}}</div>
  <div class="band hero">
    <div class="rule"></div>
    <h1 class="hd sm clamp" data-autofit data-autofit-min="68">{{editie_titel}}</h1>
    <div class="quote clamp">{{quote}}</div>
  </div>
  __LOGO__
</div>`,
  },

  {
    file: 'gids_cover.html',
    css: HERO_COVER_CSS,
    body: `<div class="s">
  <div class="photo" style="background-image:url('{{cover_image_url}}')"></div>
  <div class="scrim"></div>
  <div class="tag">{{kicker}}</div>
  <div class="band hero">
    <div class="rule"></div>
    <h1 class="hd clamp" data-autofit data-autofit-min="68">{{gids_titel}}</h1>
    <div class="quote clamp">{{gids_sub}}</div>
  </div>
  __LOGO__
</div>`,
  },
  {
    file: 'gids_item.html',
    css: TWO_LINE_HEADLINE_CSS,
    body: `<div class="s">
  <div class="photo" style="background-image:url('{{item_image_url}}')"></div>
  <div class="veil"></div>
  <div class="tag">{{item_categorie}}</div>
  <div class="band">
    <div class="num">{{item_nummer}}</div>
    <h1 class="hd sm clamp">{{item_naam}}</h1>
    <div class="quote clamp">{{item_body}}</div>
  </div>
  __LOGO__
</div>`,
  },
  { file: 'gids_cta.html', css: CTA_CSS, body: CTA_BODY },
];

/**
 * The renderer calls page.setContent() without a base URL, so relative asset
 * paths never resolve — the logo has to travel inside the file.
 */
async function buildLogoTag(): Promise<string> {
  const sharp = (await import('sharp')).default;
  const png = await sharp(LOGO_FILE)
    .resize({ height: LOGO_EMBED_HEIGHT })
    .png({ compressionLevel: 9, palette: true, quality: 60, effort: 10 })
    .toBuffer();
  return `<img class="logo" alt="" src="data:image/png;base64,${png.toString('base64')}">`;
}

async function main(): Promise<void> {
  const logoTag = await buildLogoTag();

  for (const template of TEMPLATES) {
    const filePath = path.join(TEMPLATE_DIR, template.file);
    const existing = await readFile(filePath, 'utf-8');
    const head = existing.split('\n').slice(0, PRESERVED_HEAD_LINES);

    if (!head[2]?.startsWith('@font-face') || !head[4]?.startsWith('@font-face')) {
      throw new Error(
        `${template.file}: expected three @font-face rules on lines 3-5, refusing to rewrite.`
      );
    }

    const css = [BASE_CSS, template.css].filter(Boolean).join('\n');
    const body = template.body.replace('__LOGO__', logoTag);

    await writeFile(
      filePath,
      `${head.join('\n')}\n${css}\n</style></head><body>\n${body}\n</body></html>\n`,
      'utf-8'
    );
    console.log(`rewrote ${template.file}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
