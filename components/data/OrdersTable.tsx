"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ColumnDef } from "@tanstack/react-table";
import { ShoppingBag } from "lucide-react";
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

export function OrdersTable({ rows, t, lang, businessId, empty }: { rows: OrderRow[]; t: Dict; lang: Lang; businessId: string; empty?: React.ReactNode }) {
  const router = useRouter();
  const [tab, setTab] = React.useState("all");
  const counts = React.useMemo(() => rows.reduce<Record<string, number>>((a, r) => ((a[r.status] = (a[r.status] ?? 0) + 1), a), {}), [rows]);
  const data = tab === "all" ? rows : tab === "uncollected" ? rows.filter((r) => r.status === "delivered" && !r.collected) : rows.filter((r) => r.status === tab);

  const columns = React.useMemo<ColumnDef<OrderRow, unknown>[]>(() => [
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
          <Badge variant={STATUS_TONE[row.original.status]}>{t.orderStatuses[row.original.status]}</Badge>
          {row.original.status === "delivered" && <Badge variant={row.original.collected ? "success" : "warning"}>{row.original.collected ? t.collected : t.notCollected}</Badge>}
        </div>
      ),
    },
    {
      id: "courier", accessorFn: (r) => [r.courier, r.tracking_no].filter(Boolean).join(" "), header: t.courier, meta: { label: t.courier },
      cell: ({ row }) => <div className="text-[13px]"><p>{row.original.courier || "—"}</p><p className="text-xs text-muted-foreground">{row.original.tracking_no}</p></div>,
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
  ], [t, lang]);

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
  return (
    <div onClick={(e) => {
      const tr = (e.target as HTMLElement).closest("tbody tr") as HTMLElement | null;
      const id = tr?.dataset.id; if (id) router.push(`/b/${businessId}/orders/${id}`);
    }}>
      <DataTable data={data} columns={columns} t={t} toolbar={toolbar} exportName="orders" rowId={(r) => r.id}
        empty={empty ?? <div className="p-6"><EmptyState icon={ShoppingBag} title={t.noOrders} /></div>} />
    </div>
  );
}
