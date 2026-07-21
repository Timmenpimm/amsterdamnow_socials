"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { CarouselStatus } from "@prisma/client";

const POLL_INTERVAL_MS = 2000;
// ~4 minutes of polling — comfortably above lib/instagram.ts's own
// POLL_TIMEOUT_MS (90s) per container, times up to two containers
// (item + carousel) in the worst case.
const MAX_POLL_ATTEMPTS = 120;

interface PublishStatusResponse {
  status: CarouselStatus;
  instagramId: string | null;
  permalink: string | null;
}

interface ErrorResponse {
  error: string;
}

export interface PublishUpdate {
  status: CarouselStatus;
  instagramId?: string | null;
}

async function fetchPublishStatus(
  carouselId: string
): Promise<PublishStatusResponse | null> {
  try {
    const response = await fetch(
      `/api/instagram/publish/status?carouselId=${encodeURIComponent(carouselId)}`
    );
    if (!response.ok) return null;
    return (await response.json()) as PublishStatusResponse;
  } catch {
    return null;
  }
}

/**
 * Drives the "Publiceren naar Instagram" flow for the editor: confirmation,
 * POST /api/instagram/publish, and polling GET /api/instagram/publish/status
 * for progress while that POST is in flight (it only resolves once the
 * whole Graph API pipeline finishes — see that route's own docs). Reports
 * every status change back through `onUpdate` so useCarouselEditor's
 * `applyPublishUpdate` can merge it into the carousel state the rest of the
 * editor renders from.
 */
export function useCarouselPublish(
  carouselId: string,
  initialStatus: CarouselStatus,
  onUpdate: (update: PublishUpdate) => void
) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [permalink, setPermalink] = useState<string | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimer.current !== null) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
  }, []);

  // Stop any in-flight polling if the editor unmounts mid-publish.
  useEffect(() => stopPolling, [stopPolling]);

  // A carousel that was already PUBLISHED before this page loaded (e.g. a
  // revisit) never goes through publish()/startPolling() in this session —
  // fetch its permalink once on mount so the "view on Instagram" link is
  // still the real post, not just the account's generic profile.
  useEffect(() => {
    if (initialStatus !== "PUBLISHED") return;
    let cancelled = false;
    void fetchPublishStatus(carouselId).then((data) => {
      if (!cancelled && data?.permalink) setPermalink(data.permalink);
    });
    return () => {
      cancelled = true;
    };
    // Mount-only: initialStatus is a snapshot of the status this page was
    // loaded with, not something that should re-trigger this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carouselId]);

  const startPolling = useCallback(() => {
    stopPolling();
    let attempts = 0;

    pollTimer.current = setInterval(async () => {
      attempts += 1;
      if (attempts > MAX_POLL_ATTEMPTS) {
        stopPolling();
        return;
      }

      const data = await fetchPublishStatus(carouselId);
      if (!data) return; // transient network hiccup — keep polling

      onUpdate({ status: data.status, instagramId: data.instagramId });
      if (data.permalink) setPermalink(data.permalink);

      if (data.status === "PUBLISHED" || data.status === "FAILED") {
        stopPolling();
      }
    }, POLL_INTERVAL_MS);
  }, [carouselId, onUpdate, stopPolling]);

  /**
   * Moves a carousel back from FAILED to APPROVED so the publish button
   * reappears and the user can retry, mirroring the "Terug naar concept"
   * PATCH pattern used elsewhere in the editor. Best-effort: if this PATCH
   * itself fails, the carousel is left at FAILED and the user can still
   * recover via the "Opnieuw proberen" action in CarouselActions.
   */
  const revertToApproved = useCallback(async () => {
    try {
      const response = await fetch(`/api/carousels/${carouselId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "APPROVED" }),
      });
      if (!response.ok) return;
      const data = (await response.json()) as {
        carousel: { status: CarouselStatus };
      };
      onUpdate({ status: data.carousel.status });
    } catch {
      // Best-effort — see docstring above.
    }
  }, [carouselId, onUpdate]);

  const publish = useCallback(
    async (currentStatus: CarouselStatus) => {
      if (currentStatus !== "APPROVED") return;
      if (
        !window.confirm(
          "Dit plaatst de carousel op het gekoppelde Instagram-account. Weet je het zeker?"
        )
      ) {
        return;
      }

      setPermalink(null);
      setIsPublishing(true);
      startPolling();

      try {
        const response = await fetch("/api/instagram/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ carouselId }),
        });
        const data = (await response.json()) as
          | { carousel: { status: CarouselStatus; instagramId: string | null } }
          | ErrorResponse;

        stopPolling();

        if (!response.ok) {
          const message =
            "error" in data ? data.error : "Publiceren is mislukt.";

          if (response.status === 503) {
            toast.error(
              `${message} Koppel eerst een Instagram-account via Instellingen.`
            );
          } else if (response.status === 409) {
            toast.error(message);
          } else {
            toast.error(message);
            await revertToApproved();
          }
          return;
        }

        if ("carousel" in data) {
          onUpdate({
            status: data.carousel.status,
            instagramId: data.carousel.instagramId,
          });
        }

        toast.success("Carousel gepubliceerd naar Instagram.");
        const status = await fetchPublishStatus(carouselId);
        if (status?.permalink) setPermalink(status.permalink);
      } catch {
        stopPolling();
        toast.error("Kon niet publiceren: geen verbinding met de server.");
        await revertToApproved();
      } finally {
        setIsPublishing(false);
      }
    },
    [carouselId, onUpdate, revertToApproved, startPolling, stopPolling]
  );

  return { publish, isPublishing, permalink };
}
