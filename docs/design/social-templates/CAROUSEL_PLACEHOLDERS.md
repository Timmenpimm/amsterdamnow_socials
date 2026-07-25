> Design handoff uit Claude Design, aangeleverd door Martijn. Verbatim gekopieerd — niet herschrijven. Bijbehorende HTML-templates staan in `templates/now/` (agenda_*, gids_*, lijstje_editie_cover).

# Carousel-templates — placeholders

Alle bestanden: 1080 × 1350 px (Instagram 4:5), self-contained (fonts + logo als base64), geen JS, geen externe requests. Render met een headless browser op exact 1080×1350 en screenshot.

Vervang de `{{tokens}}` met string-replace. Lege tokens: geef een lege string mee — de layout blijft staan. Alle koppen worden geclampt (`-webkit-line-clamp`), dus te lange tekst breekt de slide niet, maar wordt afgekapt.

## Agenda-carousel (4 slides)
| Bestand | Placeholders |
|---|---|
| `agenda_cover.html` | `{{cover_image_url}}`, `{{kicker}}` (bv. AGENDA / CULTUUR), `{{datum}}` (rode balk, 1 regel, bv. 25 JUL — 16 AUG), `{{event_titel}}` (max ~3 regels, ~20 tekens/regel), `{{locatie}}` (bv. NDSM — AMSTERDAM NOORD) |
| `agenda_wat.html` | `{{sfeer_image_url}}`, `{{label}}` (bv. WAT IS HET?), `{{reden_zin}}` (1 zin, max ~120 tekens) |
| `agenda_praktisch.html` | `{{wanneer}}` + `{{wanneer_extra}}`, `{{waar}}` + `{{waar_extra}}`, `{{tickets}}` + `{{tickets_extra}}` |
| `agenda_cta.html` | `{{cta_titel}}` (bv. PLAN JE BEZOEK), `{{cta_sub}}` (bv. Meer in de agenda) |

## Gids-carousel (cover + item ×2–8 + CTA)
| Bestand | Placeholders |
|---|---|
| `gids_cover.html` | `{{cover_image_url}}`, `{{kicker}}` (bv. BUURTEN / WEST), `{{gids_titel}}`, `{{gids_sub}}` |
| `gids_item.html` | `{{layout_richting}}` = `foto-links` of `foto-rechts`, `{{item_image_url}}`, `{{item_categorie}}`, `{{item_nummer}}` (01, 02 …), `{{item_naam}}`, `{{item_body}}` (max ~110 tekens) |
| `gids_cta.html` | `{{cta_titel}}` (bv. BEWAAR DEZE GIDS), `{{cta_sub}}` |

Wissel `{{layout_richting}}` per item af (`foto-links`, `foto-rechts`, `foto-links` …) voor ritme in de carousel.

## Lijstje-carousel (editie-cover + items)
| Bestand | Placeholders |
|---|---|
| `lijstje_editie_cover.html` | `{{editie_titel}}` (bv. DE BESTE HOTSPOTS VAN JULI 2026), `{{editie_footer}}` |
| `gids_item.html` | zelfde tokens als hierboven — de item-slide is voor beide carousels dezelfde |

## Regels voor de generator
- `{{*_image_url}}` moet een absolute URL of `file://`-pad zijn; bij een lege/ontbrekende afbeelding valt de slide terug op zwart (#111) en blijft de tekst leesbaar.
- Voer titels aan in normale schrijfwijze; de templates zetten zelf om naar uppercase.
- Geen HTML in tokens behalve een `<br>` in `{{event_titel}}`, `{{gids_titel}}`, `{{cta_titel}}` en `{{item_naam}}` als je de regelval zelf wilt bepalen.
- Rood (#E90000) is systeem-kleur: alleen datum-balk, labels en de streep. Nooit als vlakvulling toevoegen.
