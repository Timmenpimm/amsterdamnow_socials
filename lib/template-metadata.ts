import { TEMPLATE_IDS, type TemplateId } from "@/templates";

/**
 * Human-facing name + short description per satori template. Shared between
 * /dashboard/templates, the "generate carousel" template picker on the posts
 * page, and the template switcher in the carousel editor, so the copy only
 * lives in one place.
 */
export interface TemplateMetadata {
  id: TemplateId;
  name: string;
  description: string;
}

const TEMPLATE_METADATA: Record<TemplateId, TemplateMetadata> = {
  "modern-news": {
    id: "modern-news",
    name: "Modern News",
    description: "Strak nieuwsformat met grote koppen en een consistente merkbalk.",
  },
  "minimal-business": {
    id: "minimal-business",
    name: "Minimal Business",
    description: "Rustige, zakelijke lay-out met veel witruimte en subtiele accenten.",
  },
  magazine: {
    id: "magazine",
    name: "Magazine",
    description: "Editorial format met beeldvullende foto's en uitgesproken typografie.",
  },
};

export const TEMPLATE_METADATA_LIST: TemplateMetadata[] = TEMPLATE_IDS.map(
  (id) => TEMPLATE_METADATA[id]
);

export function getTemplateMetadata(id: TemplateId): TemplateMetadata {
  return TEMPLATE_METADATA[id];
}
