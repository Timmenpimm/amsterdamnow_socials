import "server-only";

import {
  getNowFamilyPlan,
  textPlaceholders,
  type NowFamilyStep,
  type NowStoredSlide,
} from "@/lib/now-carousel";
import type { CleanArticle } from "@/lib/carousel-prompt";
import type {
  NowPlaceholderSpec,
  NowSlideType,
  NowTemplateFamily,
} from "@/templates/now/manifest";

/**
 * Prompt construction for the Amsterdam NOW carousels (families hotspot,
 * lijstje, agenda, gids, event).
 *
 * The slide-by-slide part of the system prompt is generated from the
 * template manifest via lib/now-carousel.ts — never hand-copied. Adding a
 * token to templates/now/manifest.ts therefore automatically shows up in the
 * prompt with its own description, exactly like it shows up in the schema.
 */

/**
 * Wie er schrijft en in welke toon. Gedeeld door de volledige carousel en de
 * losse-slide-regeneratie, zodat een herschreven slide dezelfde stem houdt.
 */
const NOW_VOICE = `Schrijf alles in het Nederlands, in een redactionele stadsgids-toon: concreet, feitelijk, met details uit het artikel (namen, straten, buurten, tijden, prijzen). Je informeert de lezer, je verkoopt niets.

Verboden: marketingclichés en holle superlatieven. Gebruik nooit "ontdek nu", "niet te missen", "must-see", en ook geen varianten daarvan ("dit mag je niet missen", "de ultieme ...", "waanzinnig", "geweldig"). Geen uitroeptekens, geen influencer-toon, geen zinnen die niets zeggen ("dit is echt bijzonder").`;

/** De regels die voor elk tekstveld gelden, ongeacht welke slide je schrijft. */
const NOW_FIELD_RULES = `Regels voor de tekstvelden:
- Houd je aan de lengtes die in de beschrijving van een veld staan. Staat er "max ~110 tekens", dan is dat een harde grens; te lange tekst loopt uit de vormgeving.
- Elk veld is platte tekst. Geen HTML, geen markdown, geen emoji, geen aanhalingstekens rond het hele veld. De enige uitzondering is <br> in de velden die hierboven expliciet als zodanig zijn gemarkeerd — en gebruik die alleen midden in een tekst waar je de regel echt wilt breken. Nooit aan het begin of eind van een veld; dat levert een lege regel op in het ontwerp.
- Velden die om HOOFDLETTERS vragen (kicker, categorie, datum, label) lever je ook echt in hoofdletters aan.
- Verzin nooit beeld-URL's of bestandsnamen. Foto's worden door de applicatie ingevuld; er zit geen enkel beeldveld in wat jij aanlevert.
- Verzin geen feiten. Staat een prijs, tijd of adres niet in het artikel, schrijf dan wat er wél bekend is (bijvoorbeeld "Zie de site voor tijden") in plaats van iets te bedenken.
- Is een veld inhoudelijk niet van toepassing, lever dan een lege string — nooit "n.v.t." of een placeholder.`;

const NOW_CLOSING = "Lever alleen de gestructureerde data, zonder toelichting.";

/** "1 slide" / "2 tot 8 slides" — the repeat range of one plan step. */
function describeRange(step: NowFamilyStep): string {
  if (step.min === step.max) {
    return step.min === 1 ? "1 slide" : `${step.min} slides`;
  }
  return `${step.min} tot ${step.max} slides`;
}

/**
 * De tokens van één slide, één per regel, met de manifestbeschrijving als
 * instructie. Tokens waar een <br> in mag worden als zodanig gemarkeerd.
 */
function describePlaceholders(placeholders: NowPlaceholderSpec[]): string {
  return placeholders
    .map((placeholder) => {
      // The manifest description already mentions <br> for most of these; only
      // spell it out when it doesn't, so the line doesn't say it twice.
      const lineBreak =
        placeholder.allowsLineBreak && !placeholder.description.includes("<br>")
          ? " <br> is hier toegestaan om de regelval te sturen."
          : "";
      return `   - ${placeholder.name}: ${placeholder.description}.${lineBreak}`;
    })
    .join("\n");
}

/**
 * One plan step with its tokens. Steps without any writable token (e.g. de
 * statische lijstje-CTA) say so instead of listing nothing.
 */
function describeStep(
  family: NowTemplateFamily,
  step: NowFamilyStep,
  position: number
): string {
  const placeholders = textPlaceholders(step.templateFamily ?? family, step.slideType);
  const header = `${position}. "${step.slideType}" — ${describeRange(step)}`;

  if (placeholders.length === 0) {
    return `${header}\n   (geen tekstvelden: deze slide is volledig vormgegeven, lever een leeg object)`;
  }

  return `${header}\n${describePlaceholders(placeholders)}`;
}

/**
 * System prompt: who writes, in welke volgorde de slides komen en welke
 * tokens elke slide precies nodig heeft.
 */
export function buildNowSystemPrompt(family: NowTemplateFamily): string {
  const plan = getNowFamilyPlan(family);
  const steps = plan.steps
    .map((step, i) => describeStep(family, step, i + 1))
    .join("\n\n");

  return `Je bent eindredacteur bij Amsterdam NOW, een stadsgids voor Amsterdam. Je zet een gepubliceerd artikel om in een carousel van het type "${plan.label}".

Doel van dit carouseltype: ${plan.purpose}

${NOW_VOICE}

Bouw de carousel op in exact deze volgorde:

${steps}

${NOW_FIELD_RULES}

Daarnaast lever je:
- caption: 2 tot 4 zinnen in dezelfde toon. Noem minstens twee concrete dingen uit het artikel bij naam (een plek, een straat, een detail) — een caption die ook op een willekeurig ander artikel zou passen is fout. Schrijf zoals een redacteur die er zelf is geweest: feitelijk, droog, geen opgeklopte belofte. Verboden: "de mogelijkheden zijn eindeloos", "voor elk wat wils", "ga op zoek naar", "jouw nieuwe favoriete", "een must", en elke afsluiter die de lezer aanspoort iets te ontdekken. Verzin geen woorden en gebruik geen woord waarvan je de betekenis niet zeker weet.
- hashtags: 8 tot 12 hashtags zonder "#", passend bij het onderwerp en bij Amsterdam. Mix brede tags met specifieke (buurt, categorie). Geen spamtags zoals love, instagood of photooftheday.

${NOW_CLOSING}`;
}

/**
 * User prompt: het artikel waar de carousel op gebaseerd wordt.
 */
export function buildNowUserPrompt(
  article: CleanArticle,
  family: NowTemplateFamily
): string {
  const plan = getNowFamilyPlan(family);

  return `Maak een Amsterdam NOW "${plan.label}"-carousel op basis van het onderstaande artikel.

Titel: ${article.title}

Samenvatting: ${article.excerpt || "(geen samenvatting beschikbaar)"}

Artikel:
${article.content}`;
}

/** Hoeveel tekens van een naburige slide meegaan als context. */
const NEIGHBOUR_VALUE_MAX = 90;

/**
 * System prompt voor het herschrijven van één slide: dezelfde stem en
 * veldregels als de volledige carousel, maar met precies de tokens van deze
 * ene slide. Automatisch gevulde tokens (foto, volgnummer, aantal, layout)
 * blijven hier bewust buiten beeld — die vult de applicatie in.
 */
export function buildNowSlideSystemPrompt(
  family: NowTemplateFamily,
  slideType: NowSlideType,
  placeholders: NowPlaceholderSpec[]
): string {
  const plan = getNowFamilyPlan(family);

  return `Je bent eindredacteur bij Amsterdam NOW, een stadsgids voor Amsterdam. Je herschrijft één slide van een bestaande carousel van het type "${plan.label}".

Doel van dit carouseltype: ${plan.purpose}

${NOW_VOICE}

Je herschrijft uitsluitend de slide van het type "${slideType}". De overige slides blijven ongewijzigd: schrijf dus iets anders dan wat daar al staat en herhaal geen plek, feit of formulering die elders in de carousel voorkomt. De foto, het volgnummer en het aantal items van deze slide staan vast en lever je niet aan.

Deze slide heeft precies deze tekstvelden:
${describePlaceholders(placeholders)}

${NOW_FIELD_RULES}

${NOW_CLOSING}`;
}

/** "kop: De 10 beste …; categorie: HOTSPOTS" — één slide kort samengevat. */
function summariseSlide(
  slide: NowStoredSlide,
  resolvedFamily: NowTemplateFamily
): string {
  const writable = textPlaceholders(resolvedFamily, slide.slideType);
  const parts = writable
    .map((placeholder) => {
      const value = (slide.values[placeholder.name] ?? "").trim();
      if (!value) return null;
      const short =
        value.length > NEIGHBOUR_VALUE_MAX
          ? `${value.slice(0, NEIGHBOUR_VALUE_MAX)}…`
          : value;
      return `${placeholder.name}: ${short}`;
    })
    .filter((part): part is string => part !== null);

  const body = parts.length > 0 ? parts.join("; ") : "(geen tekst)";
  return `${slide.index + 1}. ${slide.slideType} — ${body}`;
}

/**
 * User prompt voor het herschrijven van één slide: het artikel, de huidige
 * inhoud van de slide en de andere slides in het kort, zodat de nieuwe tekst
 * niet herhaalt wat er al staat.
 */
export function buildNowSlideUserPrompt(
  article: CleanArticle,
  family: NowTemplateFamily,
  slides: readonly NowStoredSlide[],
  slideIndex: number,
  resolveFamily: (slide: NowStoredSlide) => NowTemplateFamily
): string {
  const plan = getNowFamilyPlan(family);
  const target = slides.find((slide) => slide.index === slideIndex);
  const others = slides.filter((slide) => slide.index !== slideIndex);

  const current = target
    ? summariseSlide(target, resolveFamily(target))
    : "(onbekend)";
  const context =
    others.length > 0
      ? others
          .map((slide) => summariseSlide(slide, resolveFamily(slide)))
          .join("\n")
      : "(deze carousel heeft geen andere slides)";

  return `Herschrijf slide ${slideIndex + 1} van deze Amsterdam NOW "${plan.label}"-carousel.

Huidige inhoud van die slide:
${current}

De andere slides — niet herschrijven, alleen om herhaling te voorkomen:
${context}

Titel: ${article.title}

Samenvatting: ${article.excerpt || "(geen samenvatting beschikbaar)"}

Artikel:
${article.content}`;
}
