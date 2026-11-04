export type RangeKey = "today" | "7d" | "30d" | "month" | "prev_month" | "year" | "all" | "custom";
export type DateRange = { key: RangeKey; from: string; to: string };

const iso = (d: Date) => d.toISOString().slice(0, 10);
export function todayDhaka() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
}
const isIso = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Resolve ?range=&from=&to= into concrete Dhaka-local dates. Default: last 30 days. */
export function resolveRange(sp: { range?: string; from?: string; to?: string }): DateRange {
  const today = todayDhaka();
  const t = new Date(today + "T00:00:00Z");
  const shift = (days: number) => { const d = new Date(t); d.setUTCDate(d.getUTCDate() + days); return iso(d); };
  const key = (sp.range ?? "30d") as RangeKey;
  switch (key) {
    case "today": return { key, from: today, to: today };
    case "7d": return { key, from: shift(-6), to: today };
    case "month": return { key, from: today.slice(0, 8) + "01", to: today };
    case "prev_month": {
      const first = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1));
      const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0));
      return { key, from: iso(first), to: iso(last) };
    }
    case "year": return { key, from: today.slice(0, 4) + "-01-01", to: today };
    case "all": return { key, from: "2000-01-01", to: today };
    case "custom":
      if (isIso(sp.from) && isIso(sp.to) && sp.from! <= sp.to!) return { key, from: sp.from!, to: sp.to! };
      return { key: "30d", from: shift(-29), to: today };
    default: return { key: "30d", from: shift(-29), to: today };
  }
}

/** Charts get daily buckets; long ranges are trimmed to the last 366 days with data. */
export function chartRange(r: DateRange) {
  if (r.key !== "all") return r;
  const t = new Date(r.to + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() - 365);
  return { ...r, from: iso(t) };
}

/** The period of equal length right before `r` (for "vs previous" comparisons). Null for "all time". */
export function previousRange(r: DateRange): { from: string; to: string } | null {
  if (r.key === "all") return null;
  const day = 864e5;
  const from = Date.parse(r.from + "T00:00:00Z"), to = Date.parse(r.to + "T00:00:00Z");
  const len = Math.round((to - from) / day) + 1;
  if (r.key === "month" || r.key === "prev_month") {
    // calendar months compare with the same days of the month before
    const f = new Date(from); const pf = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() - 1, 1));
    const pt = new Date(Math.min(Date.UTC(pf.getUTCFullYear(), pf.getUTCMonth(), new Date(to).getUTCDate()), Date.UTC(pf.getUTCFullYear(), pf.getUTCMonth() + 1, 0)));
    return { from: iso(pf), to: iso(pt) };
  }
  return { from: iso(new Date(from - len * day)), to: iso(new Date(from - day)) };
}

/** % change, or null when there is no meaningful base. */
export function pctChange(cur: number, prev: number): number | null {
  if (!prev || !Number.isFinite(prev)) return null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}
