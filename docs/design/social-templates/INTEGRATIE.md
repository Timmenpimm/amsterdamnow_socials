# Integratie: NOW-templatepad vs generiek satori-pad

Twee renderpaden bestaan naast elkaar in deze repo (parallel gebouwd in aparte worktrees):

- **`now` (dit pad)** — merkspecifiek, pixel-perfect. 11 vaste HTML-bestanden
  (`templates/now/*.html`, zie `templates/now/manifest.ts`) die met
  Playwright (`lib/renderer-now.ts`) worden gescreenshot op exacte
  pixelmaat. Geen React, geen build-step voor de templates zelf — de HTML is
  een verbatim design-handoff (`docs/design/social-templates/HANDOFF-README.md`)
  en wordt alleen via `{{token}}`-substitutie gevuld.
- **satori-pad (parallel, generiek)** — React-componenten (`templates/*.tsx`
  volgens de oorspronkelijke CLAUDE.md-architectuur) gerenderd via
  Satori/@vercel/og. Generieke fallback-templates, niet Amsterdam
  NOW-specifiek qua opmaak, bedoeld voor merken/situaties zonder eigen
  pixel-perfect ontwerp of voor snelle server-side rendering zonder
  headless browser.

Praktisch: gebruik `now` wanneer de content een Amsterdam NOW-artikel/event
betreft en de exacte merkbeleving telt (Instagram-posts, stories). Gebruik
satori voor generieke/snelle previews of andere merken.

## Mapping naar `CarouselContent` (types/carousel.ts)

De AI-generator (parallel gebouwd) produceert `CarouselContent` met
`Slide[]` waarvan `layout: SlideLayout` (`'hero' | 'text' | 'list' | 'quote'
| 'image' | 'cta'`). Voorstel voor de latere koppeling — welke NOW-slidetype
bij welke generieke layout hoort:

| Family     | Slide type  | `SlideLayout` | Toelichting |
|------------|-------------|---------------|-------------|
| hotspot    | `cover`     | `hero`        | Openingsslide, full-bleed foto + hook. |
| hotspot    | `statement` | `quote`       | Editoriale pull-quote, geen foto. |
| hotspot    | `detail`    | `text` / `image` | Foto + tekstpaneel gecombineerd — past niet 1-op-1 op een enkele generieke layout. Voorstel: laat de AI-generator dit als `image`-layout aanmerken zodra er een bijschrift/detailtekst nodig is, met `layout_richting` afgeleid uit slide-index (even/oneven alterneert links/rechts). Vereist mogelijk een uitbreiding van `SlideLayout` of een aparte `imageText`-variant als het onderscheid met pure `image`-slides relevant wordt. |
| hotspot    | `cta`       | `cta`         | Sluitslide. |
| lijstje    | `cover`     | `hero`        | Openingsslide met aantal + kop. |
| lijstje    | `item`      | `list`        | Eén item per ranking-entry; `item_nummer` komt uit de slide-positie binnen de lijst. |
| lijstje    | `cta`       | `cta`         | Statische sluitslide, geen AI-content nodig. |
| event      | `hook`      | `hero`        | Frame 1 van de story. |
| event      | `reason`    | `quote`       | Eén overtuigende zin, vergelijkbaar met een quote-slide. |
| event      | `practical` | `text`        | WANNEER/WAAR/PRIJS — puur informatief. |
| event      | `link`      | `cta`         | Frame 4, verwijst naar bio-link. |

Dit is een voorstel, geen vastgelegd contract — de AI-generator-agent bepaalt
uiteindelijk hoe `CarouselContent.slides` naar NOW-slidetypes vertaald wordt
(inclusief de `family`-keuze: hotspot vs lijstje vs event zal waarschijnlijk
uit het brontype van het WordPress-artikel of een expliciete gebruikerskeuze
volgen, niet uit `SlideLayout` alleen).

## Open beslispunt: deployment

**Playwright draait niet op Vercel serverless as-is** (geen headless-browser
runtime beschikbaar in de standaard Node.js function runtime; Chromium-binary
is te groot/niet compatibel met de gebruikelijke deployment bundle). Opties,
nog niet gekozen:

1. **Aparte render-worker** — een klein los service (Fly.io, Render, Railway,
   AWS Fargate/ECS, of een always-on VM) met Playwright + Chromium
   geïnstalleerd, die de Next.js app via een interne API aanroept
   (`POST /render` met `{family, slideType, values}` → PNG). Meest robuust,
   voegt wel een deploybaar component toe.
2. **`@sparticuz/chromium`** — een voor AWS Lambda/Vercel-functions
   geoptimaliseerde Chromium-build, gebruikt met `playwright-core` of
   `puppeteer-core` in plaats van de volledige `playwright`-package. Blijft
   binnen Vercel, maar cold starts zijn trager en er zijn package-size- en
   architectuurbeperkingen (moet matchen met de Vercel function runtime).
3. **Pre-renderen, niet on-demand** — carrousels/stories worden lokaal of in
   CI gerenderd (bijv. na goedkeuring in de preview-editor) en de PNG's gaan
   naar blob storage (Vercel Blob / S3); de productie-app serveert dan alleen
   statische afbeeldingen, zonder dat Playwright ooit in de request-cyclus
   hoeft te draaien. Past goed bij een editorial workflow (content wordt
   vooraf goedgekeurd, niet realtime gegenereerd bij page-view).

Voorlopig advies: optie 3 voor de eerste werkende versie (render gebeurt in
de preview-editor / een lokaal of CI-proces, resultaat wordt opgeslagen), met
optie 1 als upgrade-pad zodra render-on-demand nodig is.
