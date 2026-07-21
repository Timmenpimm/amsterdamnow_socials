"use client";

import { LogIn } from "lucide-react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";

interface InstagramOAuthConnectProps {
  saved: { igUsername: string | null } | null;
  loading: boolean;
}

const ERROR_MESSAGES: Record<string, string> = {
  not_configured: "Instagram-login is nog niet geconfigureerd (Meta-app ontbreekt).",
  denied: "Koppeling geannuleerd.",
  invalid_state: "Koppeling verlopen of ongeldig. Probeer het opnieuw.",
  no_ig_account:
    "Geen Instagram-bedrijfsaccount gevonden op je Facebook-pagina's.",
  meta_error: "Meta gaf een foutmelding terug. Probeer het opnieuw.",
};

const DEFAULT_ERROR_MESSAGE =
  "Koppelen via Instagram-login is mislukt. Probeer het opnieuw.";

/**
 * "Login met Instagram" entry point, rendered above the manual token form
 * in InstagramConnectionForm. Reads ig_connected / ig_error query params
 * left by the OAuth callback (app/api/instagram/oauth/callback) for
 * feedback. The actual redirect flow is a plain full-page navigation to
 * /api/instagram/oauth/start — no fetch involved.
 */
export function InstagramOAuthConnect({
  saved,
  loading,
}: InstagramOAuthConnectProps) {
  const searchParams = useSearchParams();
  const connected = searchParams.get("ig_connected") === "1";
  const errorCode = searchParams.get("ig_error");

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-muted/30 p-4">
      {connected && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          Instagram-bedrijfsaccount succesvol gekoppeld.
        </p>
      )}
      {errorCode && (
        <p role="alert" className="text-sm text-destructive">
          {ERROR_MESSAGES[errorCode] ?? DEFAULT_ERROR_MESSAGE}
        </p>
      )}

      {!loading && saved && (
        <p className="text-sm text-muted-foreground">
          Gekoppeld als{" "}
          <span className="font-medium text-foreground">
            @{saved.igUsername ?? "onbekend"}
          </span>
          .
        </p>
      )}

      <Button asChild className="w-full sm:w-auto">
        <a href="/api/instagram/oauth/start">
          <LogIn />
          Login met Instagram
        </a>
      </Button>

      <p className="text-xs text-muted-foreground">
        {saved
          ? "Koppel opnieuw om de huidige verbinding te vervangen."
          : "Koppel je Instagram-bedrijfsaccount in één klik."}
      </p>
    </div>
  );
}
