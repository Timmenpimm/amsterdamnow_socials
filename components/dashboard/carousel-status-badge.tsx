import { Badge } from "@/components/ui/badge";
import type { CarouselStatus } from "@prisma/client";

const STATUS_LABEL: Record<CarouselStatus, string> = {
  DRAFT: "Concept",
  APPROVED: "Goedgekeurd",
  PUBLISHING: "Publiceren...",
  PUBLISHED: "Gepubliceerd",
  FAILED: "Mislukt",
};

const STATUS_VARIANT: Record<
  CarouselStatus,
  "default" | "secondary" | "success" | "warning" | "destructive"
> = {
  DRAFT: "secondary",
  APPROVED: "default",
  PUBLISHING: "warning",
  PUBLISHED: "success",
  FAILED: "destructive",
};

/** Shared status badge for CarouselStatus, used on the carousels grid and in the editor. */
export function CarouselStatusBadge({ status }: { status: CarouselStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}
