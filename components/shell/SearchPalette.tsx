"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { CornerDownLeft, FileText, Loader2, Search, ShoppingBag } from "lucide-react";
import { globalSearch, type SearchHit } from "@/app/actions";
import type { NavSection } from "@/components/shell/nav";
import { fmtMoney, type Dict, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Row = { key: string; group: string; title: string; sub?: string; href: string; icon: React.ElementType; amount?: number | null };

export function SearchPalette({ t, lang, sections, businessId, businesses, open, onOpenChange }: {
  t: Dict; lang: Lang; sections: NavSection[]; businessId: string | null; businesses: { id: string; name: string }[];
  open: boolean; onOpenChange: (o: boolean) => void;
}) {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [hits, setHits] = React.useState<SearchHit[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); onOpenChange(!open); }
      else if (e.key === "/" && !open && !(e.target as HTMLElement)?.closest("input,textarea,[contenteditable=true]")) { e.preventDefault(); onOpenChange(true); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  React.useEffect(() => { if (!open) { setQ(""); setHits([]); setActive(0); } }, [open]);

  React.useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setHits([]); setLoading(false); return; }
    setLoading(true);
    const id = setTimeout(async () => {
      try { setHits(await globalSearch(term, businessId)); } finally { setLoading(false); }
    }, 220);
    return () => clearTimeout(id);
  }, [q, businessId]);

  const ql = q.trim().toLowerCase();
  const pages: Row[] = ([
    ...sections.flatMap((s) => s.items.map((it): Row => ({ key: `p-${it.href}`, group: t.searchPages, title: it.label, sub: s.label, href: it.href, icon: it.icon }))),
    ...businesses.filter((b) => b.id !== businessId).map((b): Row => ({ key: `b-${b.id}`, group: t.businesses, title: b.name, href: `/b/${b.id}`, icon: ShoppingBag })),
  ] as Row[]).filter((r) => !ql || r.title.toLowerCase().includes(ql) || (r.sub ?? "").toLowerCase().includes(ql)).slice(0, ql ? 6 : 10);
  const rows: Row[] = [
    ...hits.filter((h) => h.kind === "order").map((h) => ({ key: h.id, group: t.searchOrders, title: h.title, sub: [h.sub, !businessId && h.business].filter(Boolean).join(" · "), href: h.href, icon: ShoppingBag })),
    ...hits.filter((h) => h.kind === "entry").map((h) => ({ key: h.id, group: t.searchEntries, title: h.title, sub: [h.sub, !businessId && h.business].filter(Boolean).join(" · "), href: h.href, icon: FileText, amount: h.amount })),
    ...pages,
  ];
  React.useEffect(() => setActive(0), [q, hits.length]);

  const go = (r?: Row) => { if (!r) return; onOpenChange(false); router.push(r.href); };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, rows.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); go(rows[active]); }
  };
  React.useEffect(() => { listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active]);

  let lastGroup = "";
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in" />
        <DialogPrimitive.Content onKeyDown={onKeyDown}
          className="fixed top-[10vh] left-1/2 z-50 flex max-h-[75dvh] w-[calc(100%-1.5rem)] max-w-xl -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-pop outline-none data-[state=open]:animate-in">
          <DialogPrimitive.Title className="sr-only">{t.searchTitle}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{t.searchPh}</DialogPrimitive.Description>
          <div className="flex items-center gap-2 border-b border-border px-3.5">
            {loading ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" /> : <Search className="size-4 shrink-0 text-muted-foreground" />}
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.searchPh} aria-label={t.searchTitle}
              className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
            <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline">Esc</kbd>
          </div>
          <div ref={listRef} className="overflow-y-auto p-1.5" role="listbox">
            {rows.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">{ql.length < 2 ? t.searchHint : loading ? "…" : t.searchEmpty}</p>
            ) : rows.map((r, i) => {
              const header = r.group !== lastGroup ? (lastGroup = r.group) : null;
              return (
                <React.Fragment key={r.key}>
                  {header && <p className="px-2.5 pt-2.5 pb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{header}</p>}
                  <button type="button" data-idx={i} role="option" aria-selected={i === active} onMouseMove={() => setActive(i)} onClick={() => go(r)}
                    className={cn("flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left text-sm", i === active ? "bg-accent" : "")}>
                    <r.icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.title}</span>
                      {r.sub && <span className="block truncate text-xs text-muted-foreground">{r.sub}</span>}</span>
                    {r.amount != null && <span className="tabular text-xs text-muted-foreground">{fmtMoney(r.amount, lang)}</span>}
                    {i === active && <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
