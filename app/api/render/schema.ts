import { z } from "zod";

export {
  slideLayoutSchema,
  slideSchema,
  slidesSchema,
  templateIdSchema,
} from "@/lib/carousel-schema";

/** POST /api/render request body. `slideIndex` omitted = render the whole carousel. */
export const renderRequestSchema = z.object({
  carouselId: z.string().min(1, "carouselId is required"),
  slideIndex: z.number().int().min(0).optional(),
});

export type RenderRequest = z.infer<typeof renderRequestSchema>;
