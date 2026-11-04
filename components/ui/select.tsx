"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type Option = { value: string; label: string; hint?: string };

/** Accessible select that also works inside plain <form> submissions (renders a hidden native select). */
export function Select({ name, options, defaultValue, value, onValueChange, placeholder, id, required, disabled, className }: {
  name?: string; options: Option[]; defaultValue?: string; value?: string; onValueChange?: (v: string) => void;
  placeholder?: string; id?: string; required?: boolean; disabled?: boolean; className?: string;
}) {
  return (
    <SelectPrimitive.Root name={name} defaultValue={defaultValue} value={value} onValueChange={onValueChange} required={required} disabled={disabled}>
      <SelectPrimitive.Trigger id={id}
        className={cn("flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-card px-3 text-sm shadow-card outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 disabled:opacity-50 data-[placeholder]:text-muted-foreground [&>span]:truncate", className)}>
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon><ChevronDown className="size-4 text-muted-foreground" /></SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content position="popper" sideOffset={4}
          className="z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-pop data-[state=open]:animate-in">
          <SelectPrimitive.Viewport>
            {options.map((o) => (
              <SelectPrimitive.Item key={o.value} value={o.value}
                className="relative flex cursor-pointer select-none items-center rounded-md py-1.5 pr-8 pl-2 text-sm outline-none data-[highlighted]:bg-accent data-[disabled]:opacity-50">
                <div className="min-w-0">
                  <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                  {o.hint && <p className="truncate text-xs text-muted-foreground">{o.hint}</p>}
                </div>
                <SelectPrimitive.ItemIndicator className="absolute right-2"><Check className="size-4" /></SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
