"use client";

import { Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/overlay";
import { cn } from "@/lib/utils";

/** KPI card: label, value, plain-language definition on hover/tap. */
export function Kpi({ label, value, definition, hint, tone, icon, delta, featured, className }: {
  label: string; value: string; definition?: string; hint?: string; tone?: "positive" | "negative" | "neutral";
  icon?: React.ReactNode;
  /** change vs previous period; `invert` when going down is good (costs) */
  delta?: { pct: number | null; label: string; invert?: boolean; lang?: "bn" | "en" };
  /** the one headline figure of a page: larger serif numerals on a brass-lit panel */
  featured?: boolean; className?: string;
}) {
  const d = delta && delta.pct !== null && Number.isFinite(delta.pct) ? delta : null;
  const good = d ? (d.invert ? d.pct! <= 0 : d.pct! >= 0) : false;
  return (
    <Card className={cn("relative flex flex-col gap-2 overflow-hidden p-4 sm:gap-3 sm:p-5",
      featured && "border-hairline/50 bg-[radial-gradient(120%_140%_at_100%_0%,var(--glow),transparent_60%),linear-gradient(180deg,var(--card),var(--card))] sm:p-6", className)}>
      {featured && <span aria-hidden className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-hairline to-transparent" />}
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
      <p className={cn("font-display tabular truncate font-semibold", featured ? "text-[34px] leading-none sm:text-[44px]" : "text-[24px] leading-tight sm:text-[28px]",
        tone === "positive" && "text-success", tone === "negative" && "text-destructive")}>{value}</p>
      {(hint || d) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {d && (
            <span className={cn("tabular inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-medium",
              Math.abs(d.pct!) < 0.5 ? "bg-muted" : good ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive")} title={d.label}>
              {d.pct! > 0 ? "▲" : d.pct! < 0 ? "▼" : "•"} {new Intl.NumberFormat(d.lang === "bn" ? "bn-BD" : "en-IN", { maximumFractionDigits: Math.abs(d.pct!) < 10 ? 1 : 0 }).format(Math.min(Math.abs(d.pct!), 999))}%
            </span>
          )}
          {hint && <span className="truncate">{hint}</span>}
        </div>
      )}
    </Card>
  );
}
