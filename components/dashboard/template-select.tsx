"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TEMPLATE_METADATA_LIST } from "@/lib/template-metadata";
import { NOW_FAMILY_PLANS, nowTemplateId } from "@/lib/now-carousel";
import type { TemplateId } from "@/templates";

/**
 * Every id this dropdown can produce: a generic satori template id, or an
 * Amsterdam NOW family id (`now:hotspot` | `now:lijstje` | `now:agenda` |
 * `now:gids` | `now:event`). Kept as a documented union instead of a bare
 * string so callers still get autocompletion.
 */
export type NowTemplateId = `now:${(typeof NOW_FAMILY_PLANS)[number]["family"]}`;
export type CarouselTemplateId = TemplateId | NowTemplateId;

interface TemplateOption {
  id: CarouselTemplateId;
  name: string;
  description: string;
}

interface TemplateOptionGroup {
  label: string;
  options: TemplateOption[];
}

const GENERIC_GROUP: TemplateOptionGroup = {
  label: "Algemeen",
  options: TEMPLATE_METADATA_LIST.map((template) => ({
    id: template.id,
    name: template.name,
    description: template.description,
  })),
};

const NOW_GROUP: TemplateOptionGroup = {
  label: "Amsterdam NOW",
  options: NOW_FAMILY_PLANS.map((plan) => ({
    id: nowTemplateId(plan.family) as NowTemplateId,
    name: plan.label,
    description: plan.purpose,
  })),
};

/**
 * Small dropdown for picking a carousel template, showing each option's
 * name + short description. Reused by the "generate carousel" action on the
 * posts page (which opts into the Amsterdam NOW families via `includeNow`)
 * and by the template switcher in the carousel editor — that one stays on
 * the generic satori templates, since an existing carousel's slides can't be
 * re-pointed at a different slide model. Deliberately hand-rolled (no Radix
 * Select/Popover) since this project has no such dependency yet and the
 * interaction is simple enough for a plain absolutely-positioned panel +
 * outside-click handling.
 *
 * Generic in the id type so a caller that only handles TemplateId keeps its
 * narrow callback signature, while the generate flow can accept
 * CarouselTemplateId.
 */
interface TemplateSelectProps<T extends string = CarouselTemplateId> {
  value?: T;
  onSelect: (id: T) => void;
  disabled?: boolean;
  triggerLabel?: string;
  /** Also offer the Amsterdam NOW families (grouped separately). */
  includeNow?: boolean;
}

export function TemplateSelect<T extends string = CarouselTemplateId>({
  value,
  onSelect,
  disabled,
  triggerLabel,
  includeNow = false,
}: TemplateSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const groups = includeNow ? [NOW_GROUP, GENERIC_GROUP] : [GENERIC_GROUP];
  const selected = groups
    .flatMap((group) => group.options)
    .find((option) => option.id === value);
  const label = triggerLabel ?? selected?.name ?? "Kies een template";

  return (
    <div ref={containerRef} className="relative inline-block text-left">
      <Button
        type="button"
        variant="outline"
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {label}
        <ChevronDown className="size-4" />
      </Button>

      {open && (
        <div
          role="listbox"
          className="absolute z-20 mt-2 max-h-96 w-72 overflow-y-auto rounded-md border border-border bg-popover p-1 shadow-md"
        >
          {groups.map((group) => (
            <div key={group.label} className="py-1 first:pt-0 last:pb-0">
              {includeNow && (
                <p className="px-3 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </p>
              )}
              {group.options.map((option) => {
                const isSelected = option.id === value;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSelect(option.id as T);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                      isSelected && "bg-accent/60"
                    )}
                  >
                    <span className="flex w-full items-center justify-between gap-2 font-medium">
                      {option.name}
                      {isSelected && <Check className="size-4 shrink-0" />}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {option.description}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
