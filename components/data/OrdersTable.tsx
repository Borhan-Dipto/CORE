"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { Check, Copy, MoreHorizontal, ShoppingBag, X } from "lucide-react";
import { toast } from "sonner";
import { bulkSetOrderStatus, setOrderStatus } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/overlay";
import { DataTable, type ColMeta } from "@/components/data/DataTable";
import { Badge } from "@/components/ui/card";
import { EmptyState } from "@/components/shell/Page";
import { fmtDate, fmtMoney, fmtNum, type Dict, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export type OrderRow = {
  id: string; order_no: string; order_date: string; status: string; source: string; customer_name: string | null; customer_phone: string | null;
  courier: string | null; tracking_no: string | null; campaign_name: string | null; collected: boolean; items: { product_name: string; qty: number }[];
  net_sales: number; profit: number; units: number;
};

export const STATUS_TONE: Record<string, "neutral" | "brand" | "warning" | "success" | "destructive"> = {
  pending: "warning", confirmed: "brand", shipped: "brand", delivered: "success", returned: "destructive", cancelled: "neutral",
};

/** Where an order can go next from its current status (mirrors the database rules). */
export function nextStatuses(r: { status: string; collected: boolean }): string[] {
  if (r.collected) return [];
  switch (r.status) {
    case "pending": return ["confirmed", "shipped", "delivered", "cancelled"];
    case "confirmed": return ["shipped", "delivered", "cancelled"];
    case "shipped": return ["delivered", "returned", "cancelled"];
    case "delivered": return ["returned"];
    default: return [];
  }
}

export function OrdersTable({ rows, t, lang, businessId, empty, canWrite }: { rows: OrderRow[]; t: Dict; lang: Lang; businessId: string; empty?: React.ReactNode; canWrite?: boolean }) {
  const router = useRouter();
  const [tab, setTab] = React.useState("all");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [busy, startBusy] = React.useTransition();
  React.useEffect(() => setSelected(new Set()), [tab]);
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const change = (id: string, status: string) => startBusy(async () => {
    const r = await setOrderStatus(id, businessId, status);
    if (r.error) toast.error(r.error); else toast.success(`${t.orderStatuses[status]} ✓`);
  });
  const bulk = (status: string) => startBusy(async () => {
    const r = await bulkSetOrderStatus(businessId, [...selected], status);
    if (r.done) toast.success(`${fmtNum(r.done, lang)} ${t.ordersUpdated}`);
    if (r.failed) toast.error(`${fmtNum(r.failed, lang)} ${t.ordersNotUpdated}`);
    setSelected(new Set());
  });
  const counts = React.useMemo(() => rows.reduce<Record<string, number>>((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {}), [rows]);
  const data = tab === "all" ? rows : tab === "uncollected" ? rows.filter((r) => r.status === "delivered" && !r.collected) : rows.filter((r) => r.status === tab);

  const columns = React.useMemo<ColumnDef<OrderRow, unknown>[]>(() => [
    ...(canWrite ? [{
      id: "select", enableSorting: false, enableHiding: false, meta: { className: "w-9 pr-0" } satisfies ColMeta,
      header: () => <span className="sr-only">{t.select}</span>,
      cell: ({ row }: { row: { original: OrderRow } }) => {
        const on = selected.has(row.original.id);
        return (
          <button type="button" data-noclick aria-pressed={on} aria-label={t.select} onClick={() => toggle(row.original.id)}
            className={cn("flex size-4.5 items-center justify-center rounded border transition", on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:border-foreground/40")}>
            {on && <Check className="size-3" />}
          </button>
        );
      },
    } as ColumnDef<OrderRow, unknown>] : []),
    {
      id: "order", accessorFn: (r) => `${r.order_no} ${r.tracking_no ?? ""}`, header: t.orderNo, meta: { label: t.orderNo, className: "w-32" } satisfies ColMeta,
      cell: ({ row }) => (
        <div><p className="font-medium">{row.original.order_no}</p><p className="tabular text-xs text-muted-foreground">{fmtDate(row.original.order_date, lang)}</p></div>
      ),
    },
    {
      id: "customer", accessorFn: (r) => `${r.customer_name ?? ""} ${r.customer_phone ?? ""}`, header: t.customer, meta: { label: t.customer, className: "min-w-40" },
      cell: ({ row }) => (
        <div className="min-w-0"><p className="truncate">{row.original.customer_name || "—"}</p><p className="truncate text-xs text-muted-foreground">{row.original.customer_phone}</p></div>
      ),
    },
    {
      id: "items", accessorFn: (r) => r.items.map((i) => i.product_name).join(", "), header: t.items, meta: { label: t.items, className: "min-w-48" },
      cell: ({ row }) => {
        const it = row.original.items;
        return <div className="min-w-0 text-[13px]"><p className="truncate">{it[0]?.product_name}{it[0]?.qty > 1 ? ` × ${fmtNum(it[0].qty, lang)}` : ""}</p>
          {it.length > 1 && <p className="text-xs text-muted-foreground">+{fmtNum(it.length - 1, lang)}</p>}</div>;
      },
    },
    {
      id: "status", accessorFn: (r) => t.orderStatuses[r.status], header: t.status, meta: { label: t.status },
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1">
          <Badge variant={STATUS_TONE[row.original.status]} className="before:size-1.5 before:rounded-full before:bg-current before:content-['']">{t.orderStatuses[row.original.status]}</Badge>
          {row.original.status === "delivered" && <Badge variant={row.original.collected ? "success" : "warning"}>{row.original.collected ? t.collected : t.notCollected}</Badge>}
        </div>
      ),
    },
    {
      id: "courier", accessorFn: (r) => [r.courier, r.tracking_no].filter(Boolean).join(" "), header: t.courier, meta: { label: t.courier },
      cell: ({ row }) => (
        <div className="text-[13px]"><p>{row.original.courier || "—"}</p>
          {row.original.tracking_no && (
            <button type="button" data-noclick title={t.copy} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={async () => { try { await navigator.clipboard.writeText(row.original.tracking_no!); toast.success(t.copied); } catch {} }}>
              {row.original.tracking_no} <Copy className="size-3" />
            </button>
          )}
        </div>
      ),
    },
    {
      id: "total", accessorKey: "net_sales", header: t.orderTotal, meta: { label: t.orderTotal, align: "right", csv: (r: unknown) => (r as OrderRow).net_sales } satisfies ColMeta,
      cell: ({ row }) => <span className="font-medium">{fmtMoney(row.original.net_sales, lang)}</span>,
    },
    {
      id: "profit", accessorKey: "profit", header: t.profitLabel, meta: { label: t.profitLabel, align: "right", csv: (r: unknown) => (r as OrderRow).profit } satisfies ColMeta,
      cell: ({ row }) => {
        const r = row.original; const counts = r.status === "delivered";
        return <span className={cn("whitespace-nowrap", !counts ? "text-muted-foreground" : r.profit >= 0 ? "text-success" : "text-destructive")}>{fmtMoney(r.profit, lang, { sign: counts })}</span>;
      },
    },
    ...(canWrite ? [{
      id: "actions", enableSorting: false, enableHiding: false, meta: { className: "w-10 pr-2" } satisfies ColMeta,
      header: () => <span className="sr-only">{t.actions}</span>,
      cell: ({ row }: { row: { original: OrderRow } }) => {
        const next = nextStatuses(row.original);
        if (!next.length) return null;
        return (
          <div data-noclick>
            <Menu>
              <MenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={t.changeStatus} disabled={busy}><MoreHorizontal /></Button></MenuTrigger>
              <MenuContent>
                <MenuLabel>{t.changeStatus}</MenuLabel>
                {next.map((st) => (
                  <MenuItem key={st} onSelect={() => change(row.original.id, st)} className={st === "cancelled" || st === "returned" ? "text-destructive" : undefined}>
                    <Badge variant={STATUS_TONE[st]}>{t.orderStatuses[st]}</Badge>
                  </MenuItem>
                ))}
              </MenuContent>
            </Menu>
          </div>
        );
      },
    } as ColumnDef<OrderRow, unknown>] : []),
  ], [t, lang, canWrite, selected, busy]); // eslint-disable-line react-hooks/exhaustive-deps

  const tabs = ["all", "pending", "confirmed", "shipped", "delivered", "uncollected", "returned", "cancelled"];
  const toolbar = (
    <div className="-mx-1 flex max-w-full gap-1 overflow-x-auto px-1" role="tablist">
      {tabs.map((k) => {
        const c = k === "all" ? rows.length : k === "uncollected" ? rows.filter((r) => r.status === "delivered" && !r.collected).length : counts[k] ?? 0;
        if (k !== "all" && !c) return null;
        return (
          <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={cn("h-8 shrink-0 rounded-md px-2.5 text-[13px] font-medium whitespace-nowrap transition", tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
            {k === "all" ? t.ordersAll : k === "uncollected" ? t.kpiUncollected : t.orderStatuses[k]} <span className="tabular opacity-70">{fmtNum(c, lang)}</span>
          </button>
        );
      })}
    </div>
  );
  const selRows = rows.filter((r) => selected.has(r.id));
  const common = ["confirmed", "shipped", "delivered", "cancelled"].filter((st) => selRows.length > 0 && selRows.every((r) => nextStatuses(r).includes(st)));
  const allVisible = data.length > 0 && data.every((r) => selected.has(r.id));
  return (
    <div onClick={(e) => {
      if ((e.target as HTMLElement).closest("[data-noclick],[role=menu]")) return;
      const tr = (e.target as HTMLElement).closest("tbody tr") as HTMLElement | null;
      const id = tr?.dataset.id; if (id) router.push(`/b/${businessId}/orders/${id}`);
    }}>
      {canWrite && data.length > 0 && (
        <div data-noclick className={cn("mb-2 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-[13px] transition",
          selected.size ? "border-brand/30 bg-brand-soft/50" : "border-transparent")}>
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(allVisible ? new Set() : new Set(data.map((r) => r.id)))}>
            {allVisible ? t.selectNone : t.selectAll}
          </Button>
          {selected.size > 0 && (
            <>
              <span className="font-medium">{fmtNum(selected.size, lang)} {t.selected}</span>
              <span className="text-muted-foreground">·</span>
              {common.length ? common.map((st) => (
                <Button key={st} type="button" size="sm" variant={st === "cancelled" ? "destructive-outline" : "outline"} loading={busy} onClick={() => bulk(st)}>
                  {t.markStatus.replace("{s}", t.orderStatuses[st])}
                </Button>
              )) : <span className="text-muted-foreground">{t.noCommonAction}</span>}
              <Button type="button" variant="ghost" size="icon-sm" aria-label={t.clear} onClick={() => setSelected(new Set())} className="ml-auto"><X /></Button>
            </>
          )}
        </div>
      )}
      <DataTable data={data} columns={columns} t={t} toolbar={toolbar} exportName="orders" rowId={(r) => r.id}
        empty={empty ?? <div className="p-6"><EmptyState icon={ShoppingBag} title={t.noOrders} /></div>} />
    </div>
  );
}
