"use client";

import { CheckCircle2, Loader2, Send, Trash2, Undo2 } from "lucide-react";

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
  isUpdatingStatus: boolean;
  isDeleting: boolean;
  onSetStatus: (status: "DRAFT" | "APPROVED") => void;
  onDelete: () => void;
}

/**
 * Publishing-lifecycle actions: DRAFT <-> APPROVED toggle, a disabled
 * "Publish to Instagram" placeholder for the Phase 6 pipeline, and delete
 * (with a native confirm() — this app has no dialog component yet, and a
 * destructive one-off confirmation doesn't warrant adding one).
 */
export function CarouselActions({
  status,
  isUpdatingStatus,
  isDeleting,
  onSetStatus,
  onDelete,
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
          Keur de carousel goed zodra hij klaar is. Publiceren naar Instagram volgt in Fase 6.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        {status === "DRAFT" && (
          <Button
            onClick={() => onSetStatus("APPROVED")}
            disabled={isUpdatingStatus}
          >
            {isUpdatingStatus ? (
              <Loader2 className="animate-spin" />
            ) : (
              <CheckCircle2 />
            )}
            Goedkeuren voor publicatie
          </Button>
        )}

        {status === "APPROVED" && (
          <Button
            variant="outline"
            onClick={() => onSetStatus("DRAFT")}
            disabled={isUpdatingStatus}
          >
            {isUpdatingStatus ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Undo2 />
            )}
            Terug naar concept
          </Button>
        )}

        <Button disabled title="Publiceren naar Instagram volgt in Fase 6.">
          <Send />
          Publiceren naar Instagram
        </Button>

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
      </CardContent>
    </Card>
  );
}
