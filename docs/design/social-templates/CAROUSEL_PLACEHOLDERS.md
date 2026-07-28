# Carousel-templates — placeholders

Alle bestanden: 1080 × 1350 px (Instagram 4:5), self-contained (fonts als base64), geen JS, geen externe requests, **geen logo en geen "Amsterdam NOW" in beeld**. Render met een headless browser op exact 1080×1350 en screenshot.

Vervang de `{{tokens}}` met string-replace. Lege tokens: geef een lege string mee — de layout blijft staan. Koppen worden geclampt (`-webkit-line-clamp`), dus te lange tekst kapt af in plaats van de slide te breken.

## Eén layout-principe
Full-bleed foto, verloop naar zwart onderaan, tekstblok linksonder: kicker (klein, uppercase, gespatieerd — rood deel is datum/nummer/categorie), kop in condensed bold uppercase, optioneel één regel body eronder. Info- en CTA-slides zijn dezelfde opbouw zonder foto.

## Agenda-carousel
| Bestand | Placeholders |
|---|---|
| `agenda_cover.html` | `{{cover_image_url}}`, `{{datum}}` (rood, bv. 25 jul — 16 aug), `{{kicker}}` (bv. Cultuur), `{{event_titel}}` (max 3 regels, ~18 tekens/regel), `{{locatie}}` |
| `agenda_wat.html` | `{{sfeer_image_url}}`, `{{label}}` (bv. Wat is het?), `{{reden_zin}}` (max ~130 tekens) |
| `agenda_praktisch.html` | `{{wanneer}}` + `{{wanneer_extra}}`, `{{waar}}` + `{{waar_extra}}`, `{{tickets}}` + `{{tickets_extra}}` |
| `agenda_cta.html` | `{{cta_titel}}`, `{{cta_sub}}` |

## Gids-carousel
| Bestand | Placeholders |
|---|---|
| `gids_cover.html` | `{{cover_image_url}}`, `{{kicker}}`, `{{gids_titel}}`, `{{gids_sub}}` |
| `gids_item.html` | `{{item_image_url}}`, `{{item_nummer}}` (rood: 01, 02 …), `{{item_categorie}}`, `{{item_naam}}` (max 2 regels), `{{item_body}}` (max ~110 tekens) |
| `gids_cta.html` | `{{cta_titel}}`, `{{cta_sub}}` |

## Lijstje-carousel
| Bestand | Placeholders |
|---|---|
| `lijstje_cover.html` | `{{cover_image_url}}`, `{{aantal_items}}` (rood), `{{categorie}}`, `{{kop}}` |
| `lijstje_editie_cover.html` | `{{cover_image_url}}`, `{{editie_footer}}` (kicker), `{{editie_titel}}` |
| `lijstje_item.html` | `{{item_image_url}}`, `{{item_nummer}}`, `{{item_wijk}}`, `{{item_naam}}`, `{{item_body}}` |
| `lijstje_cta.html` | `{{cta_titel}}`, `{{cta_sub}}` |

## Event- en hotspot-carousel
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
- `{{*_image_url}}` moet een absolute URL of `file://`-pad zijn; bij ontbrekend beeld valt de slide terug op zwart (#111) en blijft de tekst leesbaar.
- Voer tekst aan in normale schrijfwijze; de templates zetten zelf om naar uppercase.
- Geen HTML in tokens, behalve `<br>` in koppen als je de regelval zelf wilt bepalen.
- Rood (#E90000) alleen in de kicker (datum, nummer, label) en de CTA-streep. Nooit als vlakvulling.
- Geen logo, geen "Amsterdam NOW", geen amsterdamnow.com in beeld — account en profielfoto doen dat al. Verwijs in de CTA naar de bio.
- `{{layout_richting}}` bestaat niet meer: alle item-slides zijn full-bleed.
