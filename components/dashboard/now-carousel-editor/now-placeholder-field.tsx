"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { NowPlaceholderSpec } from "@/templates/now/manifest";

interface NowPlaceholderFieldProps {
  slideIndex: number;
  spec: NowPlaceholderSpec;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}

/**
 * Longer copy gets a Textarea; short tokens stay a single-line Input.
 * Driven by the manifest description ("… sentence …", "body copy",
 * "max ~110 characters"), because the manifest is the only place that says
 * how much text a token is meant to hold.
 */
const LONG_TEXT_PATTERN = /\bsentence\b|\bbody\b|characters/i;

/** Dutch labels for the enum tokens the templates declare (layout_richting). */
const ENUM_LABELS: Record<string, string> = {
  "foto-links": "Foto links",
  "foto-rechts": "Foto rechts",
};

/** "cover_image_url" -> "Cover image url" — the token name stays visible as the hint below. */
function humanizeToken(name: string): string {
  const spaced = name.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * One form control per manifest placeholder. The control type follows the
 * placeholder spec rather than the value: enum tokens become a segmented
 * control (hand-rolled — this app only carries the shadcn primitives),
 * image tokens a URL input, and zero-padded tokens are read-only because
 * lib/renderer-now.ts derives and pads them itself.
 */
export function NowPlaceholderField({
  slideIndex,
  spec,
  value,
  disabled,
  onChange,
}: NowPlaceholderFieldProps) {
  const fieldId = `now-${slideIndex}-${spec.name}`;
  const label = humanizeToken(spec.name);

  if (spec.enumValues) {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={fieldId}>{label}</Label>
        <div
          id={fieldId}
          role="group"
          aria-label={label}
          className="inline-flex w-fit gap-1 rounded-md border border-input bg-background p-1"
        >
          {spec.enumValues.map((option) => {
            const isActive = value === option;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={isActive}
                disabled={disabled}
                onClick={() => onChange(option)}
                className={cn(
                  "rounded-sm px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {ENUM_LABELS[option] ?? option}
              </button>
            );
          })}
        </div>
        <FieldHint spec={spec} />
      </div>
    );
  }

  if (spec.zeroPadTo) {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={fieldId}>{label}</Label>
        <Input id={fieldId} value={value} readOnly disabled className="max-w-24" />
        <FieldHint
          spec={spec}
          extra={`Wordt automatisch genummerd bij het renderen (${"0".repeat(
            spec.zeroPadTo - 1
          )}1, …).`}
        />
      </div>
    );
  }

  if (spec.isUrl) {
    return (
      <div className="flex flex-col gap-2">
        <Label htmlFor={fieldId}>{label} (afbeelding-URL)</Label>
        <Input
          id={fieldId}
          type="url"
          inputMode="url"
          value={value}
          disabled={disabled}
          placeholder="https://…"
          onChange={(event) => onChange(event.target.value)}
        />
        <FieldHint spec={spec} />
      </div>
    );
  }

  const isLongText = !spec.allowsLineBreak && LONG_TEXT_PATTERN.test(spec.description);

  // Bewust bewerkbaar: de AI schrijft deze kop niet (hij komt letterlijk uit
  // WordPress), maar de redacteur mag hem net als bij een krantenkop inkorten.
  const hints = [
    spec.fromArticleTitle
      ? "Overgenomen uit de artikeltitel. Je mag hem hier inkorten; de AI raakt hem niet aan."
      : null,
    spec.allowsLineBreak
      ? "Gebruik <br> om zelf te bepalen waar de regel afbreekt."
      : null,
  ].filter((hint): hint is string => hint !== null);

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={fieldId}>{label}</Label>
      {isLongText ? (
        <Textarea
          id={fieldId}
          value={value}
          disabled={disabled}
          rows={3}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : (
        <Input
          id={fieldId}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
      <FieldHint spec={spec} extra={hints.join(" ") || undefined} />
    </div>
  );
}

/** Helper text: the manifest description, plus any control-specific note. */
function FieldHint({ spec, extra }: { spec: NowPlaceholderSpec; extra?: string }) {
  return (
    <p className="text-xs text-muted-foreground">
      <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">
        {spec.name}
      </code>{" "}
      — {spec.description}
      {extra ? ` ${extra}` : ""}
    </p>
  );
}
