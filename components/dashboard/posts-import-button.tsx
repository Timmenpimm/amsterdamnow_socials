"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { toast, Toaster } from "sonner";

import { Button } from "@/components/ui/button";

interface PostsImportButtonProps {
  connectionId: string;
  /** How many of the latest posts to import. Defaults to 10 on the server. */
  count?: number;
}

interface ImportResponse {
  imported: number;
  created: number;
  updated: number;
}

interface ImportErrorResponse {
  error: string;
}

/**
 * Triggers POST /api/wordpress/import for the given connection, shows a
 * loading state while the request is in flight, and surfaces success/error
 * feedback via a toast. Mounts its own <Toaster /> so this feature doesn't
 * require wiring anything into the shared root layout.
 */
export function PostsImportButton({
  connectionId,
  count,
}: PostsImportButtonProps) {
  const router = useRouter();
  const [isImporting, setIsImporting] = useState(false);

  async function handleImport() {
    setIsImporting(true);

    try {
      const response = await fetch("/api/wordpress/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionId, count }),
      });

      const data = (await response.json()) as
        | ImportResponse
        | ImportErrorResponse;

      if (!response.ok) {
        const message =
          "error" in data ? data.error : "Importeren is mislukt.";
        toast.error(message);
        return;
      }

      const result = data as ImportResponse;
      toast.success(
        `${result.imported} posts opgehaald — ${result.created} nieuw, ${result.updated} bijgewerkt.`
      );
      router.refresh();
    } catch {
      toast.error("Kon geen verbinding maken met de server.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <>
      <Toaster richColors position="top-right" />
      <Button onClick={handleImport} disabled={isImporting}>
        {isImporting ? (
          <Loader2 className="animate-spin" />
        ) : (
          <RefreshCw />
        )}
        Importeer nieuwste posts
      </Button>
    </>
  );
}
