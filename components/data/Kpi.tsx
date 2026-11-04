"use client";

import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/overlay";
import { cn } from "@/lib/utils";

/** KPI card: label, value, plain-language definition on hover/tap. */
export function Kpi({ label, value, definition, hint, tone, icon }: {
  label: string; value: string; definition?: string; hint?: string; tone?: "positive" | "negative" | "neutral";
  icon?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-2 p-4 sm:gap-3 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <p className="truncate text-[13px] font-medium text-muted-foreground">{label}</p>
          {definition && (
            <Tooltip content={definition}>
              <button type="button" className="rounded text-muted-foreground/70 hover:text-foreground" aria-label={definition}><Info className="size-3.5" /></button>
            </Tooltip>
          )}
        </div>
        {icon && <span className="shrink-0 text-muted-foreground/70 [&_svg]:size-4">{icon}</span>}
      </div>
      <p className={cn("tabular truncate text-xl font-semibold tracking-tight sm:text-2xl",
        tone === "positive" && "text-success", tone === "negative" && "text-destructive")}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
