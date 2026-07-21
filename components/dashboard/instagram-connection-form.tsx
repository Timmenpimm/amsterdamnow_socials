"use client";

import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface SavedConnection {
  businessAccountId: string;
  igUsername: string | null;
  accessTokenMasked: string;
}

interface TestResult {
  ok: boolean;
  username?: string;
  error?: string;
}

export function InstagramConnectionForm() {
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState<SavedConnection | null>(null);
  const [editing, setEditing] = useState(false);

  const [accessToken, setAccessToken] = useState("");
  const [businessAccountId, setBusinessAccountId] = useState("");
  const [igUsername, setIgUsername] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/settings/instagram");
        const data = await response.json();
        if (cancelled) return;

        if (response.ok && data.connection) {
          setSaved(data.connection);
          setBusinessAccountId(data.connection.businessAccountId);
          setIgUsername(data.connection.igUsername ?? "");
        } else {
          setEditing(true);
        }
      } catch {
        if (!cancelled) setEditing(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(null);
    setSaving(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/settings/instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accessToken,
          businessAccountId,
          igUsername: igUsername || undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setSaveError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }

      setSaved(data.connection);
      setAccessToken("");
      setEditing(false);
    } catch {
      setSaveError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);

    try {
      const response = await fetch("/api/settings/instagram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editing
            ? {
                accessToken: accessToken || undefined,
                businessAccountId: businessAccountId || undefined,
              }
            : {}
        ),
      });
      const data = await response.json();
      setTestResult(data);
    } catch {
      setTestResult({ ok: false, error: "Kon geen verbinding maken." });
    } finally {
      setTesting(false);
    }
  }

  function handleReplace() {
    setAccessToken("");
    setTestResult(null);
    setEditing(true);
  }

  function handleCancel() {
    if (!saved) return;
    setBusinessAccountId(saved.businessAccountId);
    setIgUsername(saved.igUsername ?? "");
    setAccessToken("");
    setSaveError(null);
    setTestResult(null);
    setEditing(false);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Instagram-verbinding</CardTitle>
        <CardDescription>
          Koppel een Instagram-bedrijfsaccount om carousels te publiceren.
        </CardDescription>
      </CardHeader>

      {loading ? (
        <CardContent className="text-sm text-muted-foreground">Laden…</CardContent>
      ) : editing ? (
        <form onSubmit={handleSubmit}>
          <CardContent className="flex flex-col gap-4">
            <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              Haal je toegangstoken en business account-ID op via Meta Business
              Suite → Instellingen → Bedrijfsinstellingen → Systeemgebruikers
              (of de Graph API Explorer). OAuth-login volgt in een latere
              versie — voorlopig voer je deze waarden handmatig in.
            </p>

            <div className="flex flex-col gap-2">
              <Label htmlFor="ig-token">Toegangstoken</Label>
              <Input
                id="ig-token"
                name="accessToken"
                type="password"
                autoComplete="off"
                required
                value={accessToken}
                onChange={(event) => setAccessToken(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ig-business-id">Business account-ID</Label>
              <Input
                id="ig-business-id"
                name="businessAccountId"
                type="text"
                required
                value={businessAccountId}
                onChange={(event) => setBusinessAccountId(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ig-username">Instagram-gebruikersnaam (optioneel)</Label>
              <Input
                id="ig-username"
                name="igUsername"
                type="text"
                value={igUsername}
                onChange={(event) => setIgUsername(event.target.value)}
              />
            </div>

            {saveError && (
              <p role="alert" className="text-sm text-destructive">
                {saveError}
              </p>
            )}
            <TestResultBadge result={testResult} />
          </CardContent>
          <CardFooter className="flex flex-wrap gap-3">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Opslaan
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={testing || !businessAccountId}
              onClick={handleTest}
            >
              {testing && <Loader2 className="animate-spin" />}
              Test verbinding
            </Button>
            {saved && (
              <Button type="button" variant="ghost" onClick={handleCancel}>
                Annuleren
              </Button>
            )}
          </CardFooter>
        </form>
      ) : (
        <>
          <CardContent className="flex flex-col gap-3">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Business account-ID</dt>
              <dd className="truncate">{saved?.businessAccountId}</dd>
              <dt className="text-muted-foreground">Gebruikersnaam</dt>
              <dd className="truncate">{saved?.igUsername ?? "—"}</dd>
              <dt className="text-muted-foreground">Toegangstoken</dt>
              <dd className="font-mono">{saved?.accessTokenMasked}</dd>
            </dl>
            <TestResultBadge result={testResult} />
          </CardContent>
          <CardFooter className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={testing}
              onClick={handleTest}
            >
              {testing && <Loader2 className="animate-spin" />}
              Test verbinding
            </Button>
            <Button type="button" variant="ghost" onClick={handleReplace}>
              Vervang
            </Button>
          </CardFooter>
        </>
      )}
    </Card>
  );
}

function TestResultBadge({ result }: { result: TestResult | null }) {
  if (!result) return null;

  if (result.ok) {
    return (
      <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-4 shrink-0" />
        Verbinding gelukt{result.username ? ` — @${result.username}` : ""}
      </p>
    );
  }

  return (
    <p className="flex items-center gap-2 text-sm text-destructive">
      <XCircle className="size-4 shrink-0" />
      {result.error ?? "Verbinding mislukt."}
    </p>
  );
}
