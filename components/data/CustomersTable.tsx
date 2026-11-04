"use client";

import * as React from "react";
import Link from "next/link";
import type { ColumnDef } from "@tanstack/react-table";
import { Users } from "lucide-react";
import { DataTable, type ColMeta } from "@/components/data/DataTable";
import { Badge } from "@/components/ui/card";
import { EmptyState } from "@/components/shell/Page";
import { fmtDate, fmtMoney, fmtNum, type Dict, type Lang } from "@/lib/i18n";

export type CustomerRow = {
  key: string; name: string; phone: string | null; address: string | null; orders: number; delivered: number; returned: number; cancelled: number;
  spent: number; profit: number; first: string; last: string; lastOrderId: string;
};

export function CustomersTable({ rows, t, lang, businessId }: { rows: CustomerRow[]; t: Dict; lang: Lang; businessId: string }) {
  const columns = React.useMemo<ColumnDef<CustomerRow, unknown>[]>(() => [
    {
      id: "customer", accessorFn: (r) => `${r.name} ${r.phone ?? ""} ${r.address ?? ""}`, header: t.customer, meta: { label: t.customer, className: "min-w-52" } satisfies ColMeta,
      cell: ({ row }) => {
        const r = row.original;
        return (
          <div className="min-w-0">
            <div className="flex items-center gap-1.5"><p className="truncate font-medium">{r.name || "—"}</p>
              {r.delivered >= 2 && <Badge variant="success">{t.repeatCustomer}</Badge>}
              {r.returned >= 2 && r.returned >= r.delivered && <Badge variant="destructive">{t.riskyCustomer}</Badge>}</div>
            <p className="truncate text-xs text-muted-foreground">{[r.phone, r.address].filter(Boolean).join(" · ")}</p>
          </div>
        );
      },
    },
    { id: "orders", accessorKey: "orders", header: t.orders, meta: { label: t.orders, align: "right" } satisfies ColMeta,
      cell: ({ row }) => <span>{fmtNum(row.original.orders, lang)}</span> },
    { id: "delivered", accessorKey: "delivered", header: t.orderStatuses.delivered, meta: { label: t.orderStatuses.delivered, align: "right" } satisfies ColMeta,
      cell: ({ row }) => <span>{fmtNum(row.original.delivered, lang)}</span> },
    { id: "returned", accessorKey: "returned", header: t.orderStatuses.returned, meta: { label: t.orderStatuses.returned, align: "right" } satisfies ColMeta,
      cell: ({ row }) => <span className={row.original.returned ? "text-destructive" : "text-muted-foreground"}>{fmtNum(row.original.returned, lang)}</span> },
    { id: "spent", accessorKey: "spent", header: t.totalBought, meta: { label: t.totalBought, align: "right", csv: (r: unknown) => (r as CustomerRow).spent } satisfies ColMeta,
      cell: ({ row }) => <span className="font-medium">{fmtMoney(row.original.spent, lang)}</span> },
    { id: "profit", accessorKey: "profit", header: t.profitLabel, meta: { label: t.profitLabel, align: "right", csv: (r: unknown) => (r as CustomerRow).profit } satisfies ColMeta,
      cell: ({ row }) => <span className={row.original.profit < 0 ? "text-destructive" : "text-success"}>{fmtMoney(row.original.profit, lang, { sign: true })}</span> },
    { id: "last", accessorKey: "last", header: t.lastOrder, meta: { label: t.lastOrder, align: "right" } satisfies ColMeta,
      cell: ({ row }) => <Link href={`/b/${businessId}/orders/${row.original.lastOrderId}`} className="whitespace-nowrap text-brand hover:underline">{fmtDate(row.original.last, lang)}</Link> },
  ], [t, lang, businessId]);
  return (
    <DataTable data={rows} columns={columns} t={t} exportName="customers" initialSort={[{ id: "spent", desc: true }]}
      empty={<div className="p-6"><EmptyState icon={Users} title={t.noCustomers} description={t.noCustomersDesc} /></div>} />
  );
}
