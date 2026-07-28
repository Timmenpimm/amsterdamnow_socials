# Carousel-templates — placeholders

Alle bestanden: 1080 × 1350 px (Instagram 4:5), self-contained (fonts én logo als base64), geen JS, geen externe requests. Render met een headless browser op exact 1080×1350 en screenshot.

Vervang de `{{tokens}}` met string-replace. Lege tokens: geef een lege string mee — het ontwerp verbergt het bijbehorende element (`:empty{display:none}`), dus er blijft geen gat, geen leeg rood blokje en geen los scheidingsteken achter. Koppen, quotes en de plaatsregel worden geclampt (`-webkit-line-clamp`), dus te lange tekst kapt af in plaats van de slide te breken.

## Beeldtaal v2 (juli 2026)

De elf agenda-, gids- en lijstje-slides volgen het bord "Carousel — Templates v2". Eén opbouw voor alle elf:

```
full-bleed foto
  → veil (verloop naar zwart, onderaan; op agenda/wat bovenaan)
  → optioneel rood label of badge rechtsboven
  → gecentreerde tekstband: witte streep (200×12) óf het volgnummer,
    dan de kop, dan optioneel één quote-regel
  → optionele plaatsregel linksonder
  → Amsterdam NOW-logo rechtsonder
```

Maatvoering (1080×1350-ruimte): band `left/right 72px`, `bottom 168px` — de foto houdt de bovenste twee derde. Kop 124px Barlow Condensed 700 uppercase (`.hd.sm` 100px, `.hd.xs` 82px), quote 42px Oswald 300 met typografische enkele aanhalingstekens die het ontwerp zelf zet (CSS `::before`/`::after`), plaatsregel 28px Oswald 400 uppercase, logo 56px hoog.

Regels van het ontwerp: de kop is 2 tot 3 regels, nooit vier — 3 tot 5 woorden, teruggebracht tot het werkwoord. De quote is een derde van de kopgrootte, hooguit twee regels, en draagt de spanning die de kop liet vallen.

De elf bestanden worden gegenereerd door `scripts/build-now-templates-v2.ts`; dat script laat de `@font-face`-regels ongemoeid en herschrijft alleen de CSS en de `<body>`. Pas het ontwerp daar aan, niet met de hand in de HTML.

## Agenda-carousel
| Bestand | Placeholders |
|---|---|
| `agenda_cover.html` | `{{cover_image_url}}`, `{{kicker}}` (rood label rechtsboven), `{{event_titel}}` (kop), `{{quote}}` (optioneel), `{{datum}}` + `{{locatie}}` (samen de plaatsregel linksonder, met een middot ertussen) |
| `agenda_wat.html` | `{{sfeer_image_url}}`, `{{label}}` (rood label rechtsboven), `{{reden_zin}}` (kop, `.xs`), `{{quote}}` (optioneel) — de enige slide met de tekstband bovenaan |
| `agenda_praktisch.html` | `{{praktisch_image_url}}` (optioneel), `{{tickets}}` (rood label rechtsboven) + `{{tickets_extra}}` (kleine regel eronder), `{{wanneer}}` (kop, `.xs`) + `{{wanneer_extra}}` (quote), `{{waar}}` + `{{waar_extra}}` (twee regels linksonder) |
| `agenda_cta.html` | `{{cta_titel}}` (kop), `{{cta_sub}}` (quote) |

## Gids-carousel
| Bestand | Placeholders |
|---|---|
| `gids_cover.html` | `{{cover_image_url}}`, `{{kicker}}` (rood label rechtsboven), `{{gids_titel}}` (kop), `{{gids_sub}}` (quote) |
| `gids_item.html` | `{{item_image_url}}`, `{{item_categorie}}` (rood label rechtsboven), `{{item_nummer}}` (volgnummer boven de kop: 01, 02 …), `{{item_naam}}` (kop, max 2 regels), `{{item_body}}` (quote) |
| `gids_cta.html` | `{{cta_titel}}` (kop), `{{cta_sub}}` (quote) |

## Lijstje-carousel
| Bestand | Placeholders |
|---|---|
| `lijstje_cover.html` | `{{cover_image_url}}`, `{{aantal_items}}` + `{{categorie}}` (samen de rode badge rechtsboven: groot getal met label eronder), `{{kop}}` (kop), `{{quote}}` (optioneel) |
| `lijstje_editie_cover.html` | `{{cover_image_url}}`, `{{editie_footer}}` (rood label rechtsboven), `{{editie_titel}}` (kop), `{{quote}}` (optioneel) |
| `lijstje_item.html` | `{{item_image_url}}`, `{{item_nummer}}` (volgnummer boven de kop), `{{item_naam}}` (kop, max 2 regels), `{{item_body}}` (quote), `{{item_wijk}}` (plaatsregel linksonder — het template zet er zelf "Amsterdam " voor) |
| `lijstje_cta.html` | `{{cta_titel}}` (kop), `{{cta_sub}}` (quote) |

De drie CTA-slides staan als enige zonder foto op zwart, met de tekstband verticaal gecentreerd.

## Optionele tokens
`optional: true` in `templates/now/manifest.ts` betekent: dit token is later toegevoegd. Carousels die vóór die tijd zijn opgeslagen hebben er geen waarde voor, en dat is geen fout — `validateNowSlides` slaat de aanwezigheidscheck over en `lib/renderer-now.ts` vult een lege string in. Nieuwe tokens zijn daarom altijd optioneel; bestaande tokens houden hun naam en hun betekenis.

Optioneel op dit moment: `quote` op `agenda/cover`, `agenda/wat`, `lijstje/cover` en `lijstje/editie-cover`, plus `praktisch_image_url` op `agenda/praktisch`.

## Event- en hotspot-carousel
Beide families zijn met pensioen (`retired` in `lib/now-carousel.ts`): bestaande carousels renderen door, nieuwe worden er niet meer mee gemaakt. Ze staan nog op de oude beeldtaal, zonder logo.

| Bestand | Placeholders |
|---|---|
| `event_hook.html` | `{{event_image_url}}`, `{{datum}}`, `{{event_titel}}` |
| `event_reason.html` | `{{event_image_url}}`, `{{reden_zin}}` |
| `event_practical.html` | `{{wanneer}}`, `{{waar}}`, `{{prijs}}` |
| `event_link.html` | geen — vaste slotslide |
| `hotspot_cover.html` | `{{cover_image_url}}`, `{{categorie}}`, `{{titel_hook}}` |
| `hotspot_detail.html` | `{{detail_image_url}}`, `{{detail_label}}`, `{{detail_title}}`, `{{detail_body}}` |
| `hotspot_statement.html` | `{{quote}}` |
| `hotspot_cta.html` | `{{plek_naam}}`, `{{wijk}}` |

## Regels voor de generator
- `{{*_image_url}}` moet een absolute `https://`- of `data:`-URL zijn. De renderer gebruikt `page.setContent()` zónder base-URL, dus relatieve paden en `file://`-paden laden niet. Bij ontbrekend beeld valt de slide terug op zwart (#111) en blijft de tekst leesbaar.
- Voer tekst aan in normale schrijfwijze; de templates zetten koppen en labels zelf om naar uppercase.
- Zet géén aanhalingstekens om een quote-veld — het ontwerp zet de typografische enkele aanhalingstekens zelf.
- Geen HTML in tokens, behalve `<br>` in koppen als je de regelval zelf wilt bepalen.
- Rood (#E90000) alleen in het label of de badge rechtsboven. Nooit als vlakvulling.
- Het logo zit in het ontwerp (rechtsonder, wit, als base64 data-URI, bron `assets/brand/ams-logo-now.png`). Verwijs in de CTA naar de bio, niet naar een URL in beeld.
- `{{layout_richting}}` bestaat niet meer: alle item-slides zijn full-bleed.
