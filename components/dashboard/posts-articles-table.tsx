import { ImageOff } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GenerateCarouselButton } from "@/components/dashboard/generate-carousel-button";
import type { ArticleStatus } from "@prisma/client";

export interface ArticleRow {
  id: string;
  title: string;
  imageUrl: string | null;
  categories: string[];
  status: ArticleStatus;
  publishedAt: Date | null;
}

const STATUS_LABEL: Record<ArticleStatus, string> = {
  IMPORTED: "Geïmporteerd",
  GENERATING: "Genereren...",
  GENERATED: "Gegenereerd",
  PUBLISHED: "Gepubliceerd",
  FAILED: "Mislukt",
};

const STATUS_VARIANT: Record<
  ArticleStatus,
  "default" | "secondary" | "success" | "warning" | "destructive"
> = {
  IMPORTED: "secondary",
  GENERATING: "warning",
  GENERATED: "default",
  PUBLISHED: "success",
  FAILED: "destructive",
};

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("nl-NL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function PostsArticlesTable({ articles }: { articles: ArticleRow[] }) {
  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">Afbeelding</TableHead>
            <TableHead>Titel</TableHead>
            <TableHead>Categorieën</TableHead>
            <TableHead>Datum</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actie</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {articles.map((article) => (
            <TableRow key={article.id}>
              <TableCell>
                {article.imageUrl ? (
                  // Featured images come from arbitrary WordPress hosts, so a
                  // plain <img> is used instead of next/image (which would
                  // require pre-registering every remote domain).
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={article.imageUrl}
                    alt=""
                    className="size-10 rounded-md object-cover"
                  />
                ) : (
                  <div className="flex size-10 items-center justify-center rounded-md bg-muted">
                    <ImageOff className="size-4 text-muted-foreground" />
                  </div>
                )}
              </TableCell>
              <TableCell className="max-w-md">
                <span className="line-clamp-2 font-medium">
                  {article.title}
                </span>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {article.categories.length > 0
                  ? article.categories.join(", ")
                  : "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {formatDate(article.publishedAt)}
              </TableCell>
              <TableCell>
                <Badge variant={STATUS_VARIANT[article.status]}>
                  {STATUS_LABEL[article.status]}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <GenerateCarouselButton articleId={article.id} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
