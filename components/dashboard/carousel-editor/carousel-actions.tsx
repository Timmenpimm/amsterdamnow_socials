"use client";

import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  RefreshCw,
  Send,
  Trash2,
  Undo2,
  XCircle,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { CarouselStatus } from "@prisma/client";

interface CarouselActionsProps {
  status: CarouselStatus;
  /** The connected account's @handle, if known — used for the fallback "view on Instagram" link. */
  instagramUsername: string | null;
  /** Real post permalink, once the publish pipeline/status poll has resolved one. */
  permalink: string | null;
  isUpdatingStatus: boolean;
  isDeleting: boolean;
  isPublishing: boolean;
  onSetStatus: (status: "DRAFT" | "APPROVED") => void;
  onDelete: () => void;
  onPublish: () => void;
}

/** Best-effort "view on Instagram" link: the real permalink once known, else the account's profile, else the generic homepage. */
function instagramLink(permalink: string | null, username: string | null): string {
  if (permalink) return permalink;
  if (username) return `https://www.instagram.com/${username}/`;
  return "https://www.instagram.com/";
}

/**
 * Publishing-lifecycle actions: DRAFT <-> APPROVED toggle, "Publish to
 * Instagram" (Phase 6), and delete (with a native confirm() — this app has
 * no dialog component yet, and a destructive one-off confirmation doesn't
 * warrant adding one). Publishing itself is also confirmed via
 * window.confirm(), for the same reason.
 */
export function CarouselActions({
  status,
  instagramUsername,
  permalink,
  isUpdatingStatus,
  isDeleting,
  isPublishing,
  onSetStatus,
  onDelete,
  onPublish,
}: CarouselActionsProps) {
  const locked = status === "PUBLISHING" || status === "PUBLISHED";

  function handleDelete() {
    if (window.confirm("Deze carousel verwijderen? Dit kan niet ongedaan worden gemaakt.")) {
      onDelete();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Publicatie</CardTitle>
        <CardDescription>
          {status === "PUBLISHED"
            ? "Deze carousel is gepubliceerd en kan niet meer worden bewerkt."
            : "Keur de carousel goed zodra hij klaar is, en publiceer daarna naar Instagram."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {status === "PUBLISHED" && (
          <div className="flex items-center gap-2 rounded-md border border-emerald-600/30 bg-emerald-600/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>Gepubliceerd op Instagram.</span>
            <Link
              href={instagramLink(permalink, instagramUsername)}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto flex items-center gap-1 font-medium underline underline-offset-2"
            >
              Bekijk op Instagram
              <ExternalLink className="size-3.5" />
            </Link>
          </div>
        )}

        {status === "FAILED" && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <XCircle className="size-4 shrink-0" />
            <span>Publiceren naar Instagram is mislukt.</span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {status === "DRAFT" && (
            <Button onClick={() => onSetStatus("APPROVED")} disabled={isUpdatingStatus}>
              {isUpdatingStatus ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
              Goedkeuren voor publicatie
            </Button>
          )}

          {status === "APPROVED" && (
            <>
              <Button
                variant="outline"
                onClick={() => onSetStatus("DRAFT")}
                disabled={isUpdatingStatus || isPublishing}
              >
                {isUpdatingStatus ? <Loader2 className="animate-spin" /> : <Undo2 />}
                Terug naar concept
              </Button>
              <Button onClick={onPublish} disabled={isPublishing}>
                {isPublishing ? <Loader2 className="animate-spin" /> : <Send />}
                {isPublishing ? "Publiceren..." : "Publiceren naar Instagram"}
              </Button>
            </>
          )}

          {status === "PUBLISHING" && (
            <Button disabled>
              <Loader2 className="animate-spin" />
              Publiceren...
            </Button>
          )}

          {status === "FAILED" && (
            <Button onClick={() => onSetStatus("APPROVED")} disabled={isUpdatingStatus}>
              {isUpdatingStatus ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Opnieuw proberen
            </Button>
          )}

          {status === "DRAFT" && (
            <Button disabled title="Keur de carousel eerst goed voordat je publiceert.">
              <Send />
              Publiceren naar Instagram
            </Button>
          )}

          {!locked && (
            <Button
              variant="destructive"
              className="ml-auto"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
              Verwijderen
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
