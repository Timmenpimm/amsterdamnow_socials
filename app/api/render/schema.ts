import { z } from "zod";

import { TEMPLATE_IDS } from "@/templates";

/** POST /api/render request body. `slideIndex` omitted = render the whole carousel. */
export const renderRequestSchema = z.object({
  carouselId: z.string().min(1, "carouselId is required"),
  slideIndex: z.number().int().min(0).optional(),
});

export type RenderRequest = z.infer<typeof renderRequestSchema>;

const slideLayoutSchema = z.enum(["hero", "text", "list", "quote", "image", "cta"]);

/**
 * Carousel.slides is stored as Prisma `Json` — validated at read time so a
 * malformed/legacy row fails with a clear 422 instead of a confusing satori
 * crash deep in the renderer.
 */
export const slideSchema = z.object({
  index: z.number().int().min(0),
  layout: slideLayoutSchema,
  headline: z.string().min(1),
  body: z.string().optional(),
  imagePrompt: z.string().optional(),
  imageUrl: z.string().optional(),
});

export const slidesSchema = z.array(slideSchema);

export const templateIdSchema = z.enum(
  TEMPLATE_IDS as unknown as [string, ...string[]]
);
