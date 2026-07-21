import Link from "next/link";
import { ImageOff, Layers } from "lucide-react";

import { CarouselStatusBadge } from "@/components/dashboard/carousel-status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTemplateMetadata } from "@/lib/template-metadata";
import { isTemplateId } from "@/templates";
import type { CarouselStatus } from "@prisma/client";

export interface CarouselCardProps {
  id: string;
  articleTitle: string;
  articleImageUrl: string | null;
  template: string;
  status: CarouselStatus;
  slideCount: number;
  createdAt: Date;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

/** One card in the carousels grid — links through to the carousel editor. */
export function CarouselCard({
  id,
  articleTitle,
  articleImageUrl,
  template,
  status,
  slideCount,
  createdAt,
}: CarouselCardProps) {
  const templateName = isTemplateId(template)
    ? getTemplateMetadata(template).name
    : template;

  return (
    <Link href={`/dashboard/carousels/${id}`} className="block">
      <Card className="h-full transition-colors hover:border-foreground/30">
        <div className="mx-6 aspect-[4/5] overflow-hidden rounded-md bg-muted">
          {articleImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={articleImageUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <ImageOff className="size-6 text-muted-foreground" />
            </div>
          )}
        </div>
        <CardHeader>
          <CardTitle className="line-clamp-2 text-base">
            {articleTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Layers className="size-3.5" />
            {templateName} · {slideCount} slides
          </span>
          <span>{formatDate(createdAt)}</span>
        </CardContent>
        <CardContent className="pt-0">
          <CarouselStatusBadge status={status} />
        </CardContent>
      </Card>
    </Link>
  );
}
