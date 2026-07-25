import "server-only";

import {
  getNowFamilyPlan,
  textPlaceholders,
  type NowFamilyStep,
} from "@/lib/now-carousel";
import type { CleanArticle } from "@/lib/carousel-prompt";
import type { NowTemplateFamily } from "@/templates/now/manifest";

/**
 * Prompt construction for the Amsterdam NOW carousels (families hotspot,
 * lijstje, agenda, gids, event).
 *
 * The slide-by-slide part of the system prompt is generated from the
 * template manifest via lib/now-carousel.ts — never hand-copied. Adding a
 * token to templates/now/manifest.ts therefore automatically shows up in the
 * prompt with its own description, exactly like it shows up in the schema.
 */

/** "1 slide" / "2 tot 8 slides" — the repeat range of one plan step. */
function describeRange(step: NowFamilyStep): string {
  if (step.min === step.max) {
    return step.min === 1 ? "1 slide" : `${step.min} slides`;
  }
  return `${step.min} tot ${step.max} slides`;
}

/**
 * The tokens of one step, one per line, with the manifest description as the
 * instruction. Tokens that may contain a <br> are marked as such; steps
 * without any writable token (e.g. de statische lijstje-CTA) say so.
 */
function describeStep(
  family: NowTemplateFamily,
  step: NowFamilyStep,
  position: number
): string {
  const placeholders = textPlaceholders(family, step.slideType);
  const header = `${position}. "${step.slideType}" — ${describeRange(step)}`;

  if (placeholders.length === 0) {
    return `${header}\n   (geen tekstvelden: deze slide is volledig vormgegeven, lever een leeg object)`;
  }

  const lines = placeholders.map((placeholder) => {
    // The manifest description already mentions <br> for most of these; only
    // spell it out when it doesn't, so the line doesn't say it twice.
    const lineBreak =
      placeholder.allowsLineBreak && !placeholder.description.includes("<br>")
        ? " <br> is hier toegestaan om de regelval te sturen."
        : "";
    return `   - ${placeholder.name}: ${placeholder.description}.${lineBreak}`;
  });

  return `${header}\n${lines.join("\n")}`;
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

Schrijf alles in het Nederlands, in een redactionele stadsgids-toon: concreet, feitelijk, met details uit het artikel (namen, straten, buurten, tijden, prijzen). Je informeert de lezer, je verkoopt niets.

Verboden: marketingclichés en holle superlatieven. Gebruik nooit "ontdek nu", "niet te missen", "must-see", en ook geen varianten daarvan ("dit mag je niet missen", "de ultieme ...", "waanzinnig", "geweldig"). Geen uitroeptekens, geen influencer-toon, geen zinnen die niets zeggen ("dit is echt bijzonder").

Bouw de carousel op in exact deze volgorde:

${steps}

Regels voor de tekstvelden:
- Houd je aan de lengtes die in de beschrijving van een veld staan. Staat er "max ~110 tekens", dan is dat een harde grens; te lange tekst loopt uit de vormgeving.
- Elk veld is platte tekst. Geen HTML, geen markdown, geen emoji, geen aanhalingstekens rond het hele veld. De enige uitzondering is <br> in de velden die hierboven expliciet als zodanig zijn gemarkeerd.
- Velden die om HOOFDLETTERS vragen (kicker, categorie, datum, label) lever je ook echt in hoofdletters aan.
- Verzin nooit beeld-URL's of bestandsnamen. Foto's worden door de applicatie ingevuld; er zit geen enkel beeldveld in wat jij aanlevert.
- Verzin geen feiten. Staat een prijs, tijd of adres niet in het artikel, schrijf dan wat er wél bekend is (bijvoorbeeld "Zie de site voor tijden") in plaats van iets te bedenken.
- Is een veld inhoudelijk niet van toepassing, lever dan een lege string — nooit "n.v.t." of een placeholder.

Daarnaast lever je:
- caption: 2 tot 4 zinnen in dezelfde toon. Noem minstens twee concrete dingen uit het artikel bij naam (een plek, een straat, een detail) — een caption die ook op een willekeurig ander artikel zou passen is fout. Schrijf zoals een redacteur die er zelf is geweest: feitelijk, droog, geen opgeklopte belofte. Verboden: "de mogelijkheden zijn eindeloos", "voor elk wat wils", "ga op zoek naar", "jouw nieuwe favoriete", "een must", en elke afsluiter die de lezer aanspoort iets te ontdekken. Verzin geen woorden en gebruik geen woord waarvan je de betekenis niet zeker weet.
- hashtags: 8 tot 12 hashtags zonder "#", passend bij het onderwerp en bij Amsterdam. Mix brede tags met specifieke (buurt, categorie). Geen spamtags zoals love, instagood of photooftheday.

Lever alleen de gestructureerde data, zonder toelichting.`;
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
