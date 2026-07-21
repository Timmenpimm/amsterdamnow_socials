"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { TEMPLATE_METADATA_LIST } from "@/lib/template-metadata";
import type { TemplateId } from "@/templates";

interface TemplateSelectProps {
  value?: TemplateId;
  onSelect: (id: TemplateId) => void;
  disabled?: boolean;
  triggerLabel?: string;
}

/**
 * Small dropdown for picking one of the satori templates, showing each
 * option's name + short description. Reused by the "generate carousel"
 * action on the posts page and the template switcher in the carousel
 * editor. Deliberately hand-rolled (no Radix Select/Popover) since this
 * project has no such dependency yet and the interaction is simple enough
 * for a plain absolutely-positioned panel + outside-click handling.
 */
export function TemplateSelect({
  value,
  onSelect,
  disabled,
  triggerLabel,
}: TemplateSelectProps) {
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

  const selected = TEMPLATE_METADATA_LIST.find((t) => t.id === value);
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
          className="absolute z-20 mt-2 w-72 rounded-md border border-border bg-popover p-1 shadow-md"
        >
          {TEMPLATE_METADATA_LIST.map((template) => {
            const isSelected = template.id === value;
            return (
              <button
                key={template.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onSelect(template.id);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                  isSelected && "bg-accent/60"
                )}
              >
                <span className="flex w-full items-center justify-between gap-2 font-medium">
                  {template.name}
                  {isSelected && <Check className="size-4 shrink-0" />}
                </span>
                <span className="text-xs text-muted-foreground">
                  {template.description}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
