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

## Deployment: gekozen optie 2 (`@sparticuz/chromium`)

**Status: geïmplementeerd.** `POST /api/render` rendert nu beide paden. Bij een
carrousel met `template = "now:<family>"` gaat de request naar
`lib/renderer-now.ts` (Playwright → HTML → PNG); elk ander bekend template-id
blijft ongewijzigd via satori lopen. De response is in beide gevallen
`{ slides: [{ index, dataUrl }] }`, dus de preview-editor merkt het verschil niet.

### Hoe het werkt

| Omgeving | Launcher | Chromium |
|---|---|---|
| lokaal / dev / scripts | `playwright` (devDependency) | de door Playwright gedownloade Chromium |
| Vercel / AWS Lambda | `playwright-core` (dependency) | `@sparticuz/chromium` — `executablePath()` + `args` |

De keuze gebeurt op runtime in `lib/renderer-now.ts`:
`process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME` → serverless-tak,
anders de lokale tak. Beide takken worden dynamisch geïmporteerd, zodat
`playwright` (die op Vercel niet geïnstalleerd is) daar nooit geladen wordt.

Verder:

- Eén gecachede browser per process (warme invocaties hergebruiken hem). Een
  mislukte launch wist de cache, zodat de volgende request opnieuw probeert;
  een gecrashte browser wist de cache via `disconnected`.
- `setGraphicsMode = false`: de templates zijn HTML/CSS met base64-ingesloten
  fonts, geen WebGL — dat scheelt het uitpakken van `swiftshader.tar.br` bij een
  cold start.
- Launch-fouten worden een `NowRendererUnavailableError` → de route antwoordt
  **503** ("NOW-rendering niet beschikbaar in deze omgeving") in plaats van een
  generieke 500. Andere renderfouten → 500, ongeldige slides → **422** met
  `issues[]` uit `validateNowSlides()`.
- `next.config.ts`: `@sparticuz/chromium`, `playwright-core` en `playwright`
  staan in `serverExternalPackages` (ze resolven binaries via relatieve paden en
  mogen niet gebundeld worden), en `templates/now/*.html` wordt via
  `outputFileTracingIncludes` ook naar `/api/render` getraceerd. De renderer
  zoekt de HTML eerst vanaf `process.cwd()` en pas daarna module-relatief —
  hetzelfde patroon als `app/api/templates/import/builtin/route.ts`.

### Openstaande caveats

- **Cold start.** Eerste render na een koude functie: Chromium-binary
  decomprimeren naar `/tmp` + launch. Reken op enkele seconden bovenop de
  render zelf; `maxDuration = 60` op de route is daarop berekend, maar een
  lange carrousel (8 gids-items) plus cold start kan er tegenaan lopen.
- **Bundle size.** `@sparticuz/chromium` is >50 MB (brotli). Dat past binnen de
  Vercel-limiet, maar samen met de rest van de app zit er weinig marge. Loopt
  het alsnog vast, dan is `@sparticuz/chromium-min` + een externe
  `chromium-pack.tar` het alternatief.
- **Geheugen.** Sparticuz adviseert minimaal 512 MB, liefst 1600 MB+. De
  Vercel-functie moet dus op een ruim memory-profiel staan; op de default kan
  Chromium OOM-killed worden (zichtbaar als 503 via de disconnected-cache).
- **Node-versie.** `@sparticuz/chromium@149` declareert
  `engines: node ^22.17.0 || >=24.0.0`. De Node-versie van het Vercel-project
  moet daaraan voldoen (22.17+ of 24.x).
- **Niet lokaal te testen.** De meegeleverde Chromium is een Linux-binary; op
  macOS faalt de serverless-tak met `spawn ENOEXEC` (netjes afgevangen als 503).
  De echte serverless render is dus pas op een Vercel-deploy te verifiëren.

### Overwogen alternatieven

Voor de volledigheid — de opties die niet gekozen zijn:

1. **Aparte render-worker** — een klein los service (Fly.io, Render, Railway,
   AWS Fargate/ECS, of een always-on VM) met Playwright + Chromium
   geïnstalleerd, die de Next.js app via een interne API aanroept
   (`POST /render` met `{family, slideType, values}` → PNG). Meest robuust,
   voegt wel een deploybaar component toe.
2. ~~**`@sparticuz/chromium`**~~ — dit is de gekozen optie, zie hierboven.
3. **Pre-renderen, niet on-demand** — carrousels/stories worden lokaal of in
   CI gerenderd (bijv. na goedkeuring in de preview-editor) en de PNG's gaan
   naar blob storage (Vercel Blob / S3); de productie-app serveert dan alleen
   statische afbeeldingen, zonder dat Playwright ooit in de request-cyclus
   hoeft te draaien. Past goed bij een editorial workflow (content wordt
   vooraf goedgekeurd, niet realtime gegenereerd bij page-view).

Optie 3 blijft een zinnige aanvulling (Fase 6: gerenderde PNG's naar blob
storage in plaats van base64 data-URLs), en optie 1 is het upgrade-pad zodra
cold starts of bundle size op Vercel echt gaan knellen.
