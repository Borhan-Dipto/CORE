import { Sparkline } from "@/components/data/Sparkline";
import { cn } from "@/lib/utils";

export type HeroStat = { label: string; value: string; note?: string; tone?: "good" | "bad" | "neutral" };

/** The signature panel at the top of the dashboard and overview: always graphite, brass-lit, one headline figure. */
export function Hero({ mark, title, subtitle, actions, headlineLabel, headline, headlineTone, delta, stats, trend, trendLabel }: {
  mark: React.ReactNode; title: string; subtitle?: string; actions?: React.ReactNode;
  headlineLabel: string; headline: string; headlineTone?: "negative";
  delta?: { text: string; good: boolean } | null; stats: HeroStat[]; trend?: number[]; trendLabel?: string;
}) {
  return (
    <section className="dark relative isolate overflow-hidden rounded-[22px] border border-white/[0.07] text-foreground shadow-[0_30px_80px_-30px_rgb(0_0_0/0.65)]">
      {/* layered surface */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[linear-gradient(135deg,#151a23_0%,#0e1218_45%,#0b0e13_100%)]" />
      <div aria-hidden className="absolute -top-40 -right-24 -z-10 size-[520px] rounded-full bg-[#d4af6a] opacity-[0.13] blur-[110px]" />
      <div aria-hidden className="absolute -bottom-48 -left-32 -z-10 size-[460px] rounded-full bg-[#3c5a8a] opacity-[0.16] blur-[120px]" />
      <div aria-hidden className="absolute inset-0 -z-10 opacity-50 [mask-image:radial-gradient(ellipse_at_75%_20%,black,transparent_65%)]"
        style={{ backgroundImage: "linear-gradient(rgb(212 175 106 / 0.06) 1px, transparent 1px), linear-gradient(90deg, rgb(212 175 106 / 0.06) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      <div aria-hidden className="absolute inset-x-10 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-[#d4af6a]/60 to-transparent" />

      <div className="relative flex flex-col gap-6 p-5 sm:p-7 lg:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            {mark}
            <div className="min-w-0">
              <h1 className="font-display truncate text-[28px] font-medium leading-tight sm:text-[34px]">{title}</h1>
              {subtitle && <p className="mt-0.5 truncate text-[13px] text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)] lg:items-end">
          <div className="min-w-0">
            <p className="text-[13px] text-muted-foreground">{headlineLabel}</p>
            <p className={cn("font-display tabular mt-1 truncate text-[44px] font-semibold leading-none tracking-[-0.02em] sm:text-[60px]",
              headlineTone === "negative" ? "text-destructive" : "bg-gradient-to-b from-[#f7e8bf] via-[#e2c27f] to-[#b98f45] bg-clip-text text-transparent")}>{headline}</p>
            {delta && (
              <p className="mt-3 flex items-center gap-2 text-[13px]">
                <span className={cn("tabular inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
                  delta.good ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive")}>{delta.text}</span>
              </p>
            )}
          </div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="min-w-0 bg-[#10141b]/90 px-4 py-3.5 backdrop-blur">
                <dt className="truncate text-xs text-muted-foreground">{s.label}</dt>
                <dd className={cn("font-display tabular mt-1 truncate text-[21px] font-semibold leading-tight",
                  s.tone === "bad" && "text-destructive", s.tone === "good" && "text-success")}>{s.value}</dd>
                {s.note && <dd className="mt-0.5 truncate text-[11px] text-muted-foreground">{s.note}</dd>}
              </div>
            ))}
          </dl>
        </div>
      </div>
      {trend && trend.length > 1 && (
        <div className="pointer-events-none relative -mt-2 h-20 sm:h-24" title={trendLabel}>
          <Sparkline values={trend} className="h-full" color="#d4af6a" strokeWidth={2} fillOpacity={0.22} />
        </div>
      )}
    </section>
  );
}

/** Monogram tile in brass for a business (no logo images needed). */
export function BrassMark({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "C";
  return (
    <span aria-hidden className="relative flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(145deg,#f1dca6,#c9a25c_55%,#8f6c2e)] font-display text-lg font-semibold text-[#17130a] shadow-[0_10px_30px_-10px_rgb(212_175_106/0.6)] ring-1 ring-white/20 sm:size-14 sm:text-xl">
      {initials}
    </span>
  );
}
