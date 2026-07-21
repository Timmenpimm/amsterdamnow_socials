import { magazineTemplate } from "./magazine";
import { minimalBusinessTemplate } from "./minimal-business";
import { modernNewsTemplate } from "./modern-news";
import type { SlideTemplate } from "./types";

export const TEMPLATE_IDS = ["modern-news", "minimal-business", "magazine"] as const;

export type TemplateId = (typeof TEMPLATE_IDS)[number];

const TEMPLATES: Record<TemplateId, SlideTemplate> = {
  "modern-news": modernNewsTemplate,
  "minimal-business": minimalBusinessTemplate,
  magazine: magazineTemplate,
};

/**
 * Looks up a template by id. Throws for unknown ids so callers (the render
 * API route, the test script) fail loudly instead of silently rendering
 * with the wrong layout.
 */
export function getTemplate(id: string): SlideTemplate {
  if (isTemplateId(id)) {
    return TEMPLATES[id];
  }

  throw new Error(
    `Unknown template id "${id}". Valid ids: ${TEMPLATE_IDS.join(", ")}`
  );
}

export function isTemplateId(id: string): id is TemplateId {
  return (TEMPLATE_IDS as readonly string[]).includes(id);
}

export type { SlideMeta, SlideTemplate } from "./types";
