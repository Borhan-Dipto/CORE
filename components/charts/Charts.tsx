"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell } from "recharts";
import { fmtMoney, fmtShortDate, type Lang } from "@/lib/i18n";

const axis = { stroke: "var(--muted-foreground)", fontSize: 12, tickLine: false, axisLine: false } as const;

function ChartTooltip({ active, payload, label, lang, labelFmt }: {
  active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; lang: Lang; labelFmt?: (l: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-40 rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-pop">
      <p className="mb-1.5 font-medium">{labelFmt ? labelFmt(String(label)) : label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground"><span className="size-2 rounded-full" style={{ background: p.color }} />{p.name}</span>
          <span className="tabular font-medium">{fmtMoney(p.value, lang)}</span>
        </div>
      ))}
    </div>
  );
}

export function SpendTrendChart({ data, lang, labels }: {
  data: { day: string; expenses: number; ad_spend: number }[]; lang: Lang; labels: { expenses: string; ads: string };
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.14} /><stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} /></linearGradient>
            <linearGradient id="gAd" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} /><stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} /></linearGradient>
          </defs>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="day" {...axis} interval="preserveStartEnd" minTickGap={36} tickFormatter={(d) => fmtShortDate(d, lang)} />
          <YAxis {...axis} width={64} tickFormatter={(v) => fmtMoney(v, lang, { compact: true })} />
          <Tooltip content={<ChartTooltip lang={lang} labelFmt={(d) => fmtShortDate(d, lang)} />} cursor={{ stroke: "var(--border)" }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Area type="monotone" dataKey="expenses" name={labels.expenses} stroke="var(--chart-2)" strokeWidth={2} fill="url(#gExp)" />
          <Area type="monotone" dataKey="ad_spend" name={labels.ads} stroke="var(--chart-1)" strokeWidth={2} fill="url(#gAd)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal ranked bars — readable on mobile, labels never collide. */
export function RankBars({ data, lang, highlight }: { data: { label: string; value: number; accent?: boolean }[]; lang: Lang; highlight?: boolean }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <ul className="grid gap-3">
      {data.map((d) => (
        <li key={d.label} className="grid gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="truncate">{d.label}</span>
            <span className="tabular shrink-0 font-medium">{fmtMoney(d.value, lang)} <span className="ml-1 text-xs font-normal text-muted-foreground">{Math.round((d.value / total) * 100)}%</span></span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(d.value / max) * 100}%`, background: d.accent || highlight ? "var(--chart-1)" : "var(--chart-2)" }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function ComparisonChart({ data, lang, labels }: {
  data: { name: string; expenses: number; ad_spend: number; cash: number }[]; lang: Lang; labels: { expenses: string; ads: string; cash: string };
}) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barGap={4}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="name" {...axis} interval={0} tickFormatter={(n: string) => (n.length > 12 ? n.slice(0, 11) + "…" : n)} />
          <YAxis {...axis} width={64} tickFormatter={(v) => fmtMoney(v, lang, { compact: true })} />
          <Tooltip content={<ChartTooltip lang={lang} />} cursor={{ fill: "var(--accent)" }} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
          <Bar dataKey="expenses" name={labels.expenses} fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={36} />
          <Bar dataKey="ad_spend" name={labels.ads} fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={36} />
          <Bar dataKey="cash" name={labels.cash} fill="var(--chart-3)" radius={[4, 4, 0, 0]} maxBarSize={36}>
            {data.map((d) => <Cell key={d.name} fill={d.cash < 0 ? "var(--destructive)" : "var(--chart-3)"} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
