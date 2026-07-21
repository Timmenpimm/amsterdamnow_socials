> Design handoff uit Claude Design, aangeleverd door Martijn. Verbatim gekopieerd — niet herschrijven. Bijbehorende HTML-templates staan in `templates/now/`.

# Handoff: Amsterdam NOW — Social Content Templates

## Overview
A set of HTML templates for Amsterdam NOW's social media content: Instagram carousels (hotspot reviews, ranked lists) and Instagram Stories (events). All designs follow the Amsterdam NOW brand-system (see `design-system/tokens.yaml`) — an editorial, magazine-style visual language for an Amsterdam city guide.

## About the Design Files
**Important:** the `render_ready_templates/` folder contains 11 files that are **meant to be used as-is**, not re-implemented.

## Fidelity
**High-fidelity.** All templates use final colors, typography, spacing, and exact placeholder content structure.

## Intended usage
These templates are designed to be fed into an automated image-rendering pipeline (e.g. a headless-browser screenshot service, Puppeteer/Playwright, or a similar HTML→PNG renderer) that:
1. Takes one of the HTML files in `render_ready_templates/`
2. String-replaces the `{{placeholder}}` tokens with real content
3. Renders the HTML at the exact pixel dimensions declared in the file
4. Captures a PNG screenshot for posting to Instagram

They need no build step — pure HTML/CSS, no JS, no external network requests (fonts + logo embedded as base64).

## Content types & Screens

### 1. Hotspot carousel (new restaurants, shops, places) — 4 slide types, 1080×1350px
Instagram feed carousel, portrait. Files: `hotspot_cover.html`, `hotspot_detail.html` (reused 3×), `hotspot_statement.html`, `hotspot_cta.html`.

- **Cover** — Full-bleed photo, dark bottom gradient. Red uppercase category label top-left (`{{categorie}}`). Large white headline bottom-left, max ~6 words (`{{titel_hook}}`). White logo bottom-right.
  - Placeholders: `{{cover_image_url}}`, `{{categorie}}`, `{{titel_hook}}`
- **Statement** — White background, no photo. One centered editorial pull-quote in black, generous letter-spacing. Small red opening-quote mark + red dash accent.
  - Placeholders: `{{quote}}`
- **Detail** (slides 3, 4, 5 with alternating photo side) — Photo 60% width, white text panel 40%. Panel: small red uppercase label, headline, 2–3 sentence body. `{{layout_richting}}` toggles `foto-links` / `foto-rechts` (flips flex-direction).
  - Placeholders: `{{detail_image_url}}`, `{{detail_label}}`, `{{detail_title}}`, `{{detail_body}}`, `{{layout_richting}}`
- **CTA** — White background, centered "LEES HET VERHAAL", place name + neighborhood, "amsterdamnow.com" in red, black logo centered at bottom.
  - Placeholders: `{{plek_naam}}`, `{{wijk}}`

### 2. Lijstje carousel ("10 best X in Amsterdam") — 3 slide types, 1080×1350px
Files: `lijstje_cover.html`, `lijstje_item.html` (reused up to 10×), `lijstje_cta.html`.

- **Cover** — White background. Huge black number left (`{{aantal_items}}`). Vertical red uppercase category label (`{{categorie}}`, `writing-mode: vertical-rl`). Bottom: black headline, max 4 words (`{{kop}}`). Black logo bottom-right.
  - Placeholders: `{{aantal_items}}`, `{{categorie}}`, `{{kop}}`
- **Item** (once per ranked entry) — Full-bleed photo, dark bottom gradient. Top-left: large white number (`{{item_nummer}}`, zero-padded e.g. "01") with thin 1px white rule. Bottom: place name + neighborhood (`{{item_wijk}}`, prefixed with "Amsterdam " in the template — pass only the neighborhood name). White logo bottom-right.
  - Placeholders: `{{item_nummer}}`, `{{item_image_url}}`, `{{item_naam}}`, `{{item_wijk}}`
- **CTA** — Static (no placeholders): "DE VOLLEDIGE LIJST", red dash, "amsterdamnow.com", black logo.

### 3. Event story — 4 frame types, 1080×1920px
Files: `event_hook.html`, `event_reason.html`, `event_practical.html`, `event_link.html`.

- **Hook** (frame 1) — Full-bleed event photo, dark bottom gradient. Full-width red bar near top with date in white uppercase (`{{datum}}`, e.g. "VRIJDAG 23 MEI"). Bottom: white headline max 5 words (`{{event_titel}}`). White logo bottom-right.
  - Placeholders: `{{event_image_url}}`, `{{datum}}`, `{{event_titel}}`
- **Reason** (frame 2) — Full-bleed photo, `rgba(0,0,0,0.5)` overlay, one centered white sentence (`{{reden_zin}}`).
  - Placeholders: `{{event_image_url}}`, `{{reden_zin}}`
- **Practical** (frame 3) — White background: WANNEER (red label) + `{{wanneer}}`, WAAR + `{{waar}}`, PRIJS + `{{prijs}}`. Black logo centered at bottom.
- **Link** (frame 4) — Top third clean white (reserved for Instagram's native link sticker, added manually in-app). Bottom two-thirds: photo with gradient, "MEER INFO IN ONZE BIO", white logo.
  - Placeholders: `{{event_image_url}}`

## Design Tokens
See `design-system/tokens.yaml` (canonical source). Summary: display font Aktiv Grotesk Condensed Bold (fallback in these files: Barlow Condensed 700, embedded), body Oswald Light/Regular (embedded); colors #000/#fff, off-white #F4F5F6, accent red #E90000 (sparingly); overlay rgba(0,0,0,0.5); border-radius max 5px; spacing multiples of 8; no gradients-as-background, no pastels, no emoji, no exclamation marks; forbidden phrases: "ontdek nu", "verborgen parel", "must-see", "bekijk hier", "klik hier".

## Assets
- Logo is embedded as base64 inside each template (white variant for dark photos, black for white backgrounds). Fixed brand asset — never redraw the wordmark.
- All photos are `{{...url}}` placeholders with solid dark/gray fallback — real photography should be documentary-style, unposed, natural daylight; no stock or AI-generated imagery.

## Files in this handoff copy
- `render_ready_templates/` — the 11 self-contained HTML files (the actual deliverable)
- `design-system/tokens.yaml` — canonical design tokens
