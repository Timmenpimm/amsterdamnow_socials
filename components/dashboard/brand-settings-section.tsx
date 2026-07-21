"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";

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
import type { BrandSettings } from "@/types/carousel";

const DEFAULTS: BrandSettings = {
  name: "",
  primaryColor: "#d0342c",
  secondaryColor: "#171715",
  textColor: "#171715",
  backgroundColor: "#ffffff",
  fontFamily: "Inter",
};

export function BrandSettingsSection() {
  const [loading, setLoading] = useState(true);
  const [values, setValues] = useState<BrandSettings>(DEFAULTS);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/settings/brand");
        const data = await response.json();
        if (!cancelled && response.ok && data.settings) {
          setValues({ ...DEFAULTS, ...data.settings });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function update<K extends keyof BrandSettings>(key: K, value: BrandSettings[K]) {
    setSaved(false);
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaveError(null);
    setSaving(true);
    setSaved(false);

    try {
      const response = await fetch("/api/settings/brand", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const data = await response.json();

      if (!response.ok) {
        setSaveError(data?.error ?? "Something went wrong. Please try again.");
        return;
      }

      setValues({ ...DEFAULTS, ...data.settings });
      setSaved(true);
    } catch {
      setSaveError("Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Merkinstellingen</CardTitle>
        <CardDescription>
          Logo, kleuren en lettertype voor je carousel-templates.
        </CardDescription>
      </CardHeader>

      {loading ? (
        <CardContent className="text-sm text-muted-foreground">Laden…</CardContent>
      ) : (
        <form onSubmit={handleSubmit}>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="brand-name">Merknaam</Label>
              <Input
                id="brand-name"
                value={values.name}
                onChange={(event) => update("name", event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="brand-handle">Instagram-handle (optioneel)</Label>
              <Input
                id="brand-handle"
                placeholder="@voorbeeld"
                value={values.handle ?? ""}
                onChange={(event) => update("handle", event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="brand-logo">Logo-URL (optioneel)</Label>
              <Input
                id="brand-logo"
                type="url"
                placeholder="https://voorbeeld.nl/logo.png"
                value={values.logoUrl ?? ""}
                onChange={(event) => update("logoUrl", event.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <ColorField
                id="brand-primary"
                label="Primaire kleur"
                value={values.primaryColor}
                onChange={(value) => update("primaryColor", value)}
              />
              <ColorField
                id="brand-secondary"
                label="Secundaire kleur"
                value={values.secondaryColor}
                onChange={(value) => update("secondaryColor", value)}
              />
              <ColorField
                id="brand-text"
                label="Tekstkleur"
                value={values.textColor}
                onChange={(value) => update("textColor", value)}
              />
              <ColorField
                id="brand-background"
                label="Achtergrondkleur"
                value={values.backgroundColor}
                onChange={(value) => update("backgroundColor", value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="brand-font">Lettertype</Label>
              <Input
                id="brand-font"
                value={values.fontFamily}
                onChange={(event) => update("fontFamily", event.target.value)}
              />
            </div>

            {saveError && (
              <p role="alert" className="text-sm text-destructive">
                {saveError}
              </p>
            )}
            {saved && !saveError && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                Merkinstellingen opgeslagen.
              </p>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Opslaan
            </Button>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}

interface ColorFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function ColorField({ id, label, value, onChange }: ColorFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000"}
          onChange={(event) => onChange(event.target.value)}
          className="size-9 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-0.5"
        />
        <Input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="font-mono"
        />
      </div>
    </div>
  );
}
