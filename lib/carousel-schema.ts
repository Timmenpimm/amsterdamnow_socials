import { z } from "zod";

import { TEMPLATE_IDS } from "@/templates";

/**
 * Shared zod schemas describing the Carousel/Slide shapes as they cross API
 * boundaries. Kept separate from lib/carousels.ts (CRUD logic) and
 * lib/openai.ts (generation logic) so both — plus /api/render — validate
 * against the exact same rules instead of each route hand-rolling its own.
 */

export const slideLayoutSchema = z.enum([
  "hero",
  "text",
  "list",
  "quote",
  "image",
  "cta",
]);

/**
 * Canonical single-slide shape, mirroring types/carousel.ts Slide. Used both
 * to validate Carousel.slides read back from the database (Prisma stores it
 * as untyped Json) and to validate a full slides-array replacement on PATCH.
 */
export const slideSchema = z.object({
  index: z.number().int().min(0),
  layout: slideLayoutSchema,
  headline: z.string().trim().min(1).max(220),
  body: z.string().trim().max(500).optional(),
  imagePrompt: z.string().trim().max(500).optional(),
  imageUrl: z.string().trim().optional(),
});

export const slidesSchema = z.array(slideSchema).min(1).max(20);

export const carouselStatusSchema = z.enum([
  "DRAFT",
  "APPROVED",
  "PUBLISHING",
  "PUBLISHED",
  "FAILED",
]);

export const templateIdSchema = z.enum(
  TEMPLATE_IDS as unknown as [string, ...string[]]
);

/**
 * PATCH /api/carousels/[id] request body. Every field is optional so callers
 * can update just the slice they touched (e.g. only `caption`), but at least
 * one field must be present. `status` is restricted to DRAFT<->APPROVED here
 * — PUBLISHING/PUBLISHED are only ever set by the (future) publish pipeline,
 * see lib/carousels.ts's transition table for the enforced rules.
 */
export const carouselUpdateSchema = z
  .object({
    slides: slidesSchema.optional(),
    caption: z.string().trim().min(1).max(2200).optional(),
    hashtags: z.array(z.string().trim().min(1).max(100)).max(30).optional(),
    template: templateIdSchema.optional(),
    status: carouselStatusSchema.optional(),
  })
  .refine(
    (value) =>
      value.slides !== undefined ||
      value.caption !== undefined ||
      value.hashtags !== undefined ||
      value.template !== undefined ||
      value.status !== undefined,
    { message: "At least one field must be provided." }
  );

export type CarouselUpdateInput = z.infer<typeof carouselUpdateSchema>;

/** POST /api/generate/slide request body. */
export const regenerateSlideRequestSchema = z.object({
  carouselId: z.string().trim().min(1, "carouselId is required"),
  slideIndex: z.number().int().min(0),
});

export type RegenerateSlideRequest = z.infer<
  typeof regenerateSlideRequestSchema
>;
