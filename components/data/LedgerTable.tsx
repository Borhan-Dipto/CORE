"use client";

import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, MoreHorizontal, Undo2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type ColMeta } from "@/components/data/DataTable";
import { Badge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Menu, MenuTrigger, MenuContent, MenuItem, Dialog, DialogContent } from "@/components/ui/overlay";
import { Textarea, Field } from "@/components/ui/form";
import { EmptyState } from "@/components/shell/Page";
import { reverseTxn } from "@/app/actions";
import { fmtDate, fmtMoney, type Dict, type Lang } from "@/lib/i18n";
import type { Txn } from "@/lib/workspace";
import { cn } from "@/lib/utils";

type Variant = "all" | "expenses" | "ads" | "capital" | "recent";

const SIGN: Record<string, 1 | -1 | 0> = { expense: -1, withdrawal: -1, income: 1, investment: 1, transfer: 0 };

export function LedgerTable({ rows, t, lang, variant, businessId, canWrite, accounts, partners, exportName, emptyText, emptyAction }: {
  rows: Txn[]; t: Dict; lang: Lang; variant: Variant; businessId: string; canWrite: boolean;
  accounts: Record<string, string>; partners: Record<string, string>; exportName?: string; emptyText: string; emptyAction?: React.ReactNode;
}) {
  const [reversing, setReversing] = React.useState<Txn | null>(null);

  const columns = React.useMemo<ColumnDef<Txn, unknown>[]>(() => {
    const cols: ColumnDef<Txn, unknown>[] = [
      {
        id: "date", accessorKey: "txn_date", header: t.date, meta: { label: t.date, className: "w-28" } satisfies ColMeta,
        cell: ({ row }) => <span className="tabular whitespace-nowrap text-muted-foreground">{fmtDate(row.original.txn_date, lang)}</span>,
      },
    ];
    if (variant === "all" || variant === "capital" || variant === "recent") {
      cols.push({
        id: "type", accessorFn: (r) => t.txnTypes[r.txn_type], header: t.type, meta: { label: t.type },
        cell: ({ row }) => <TypeBadge type={row.original.txn_type} t={t} />,
      });
    }
    cols.push({
      id: "title", header: variant === "capital" ? t.partner : t.title, meta: { label: t.title, className: "min-w-52" },
      accessorFn: (r) => [r.title, r.category_name, r.partner_id && partners[r.partner_id], r.campaign_name, r.target_product, r.reference].filter(Boolean).join(" "),
      cell: ({ row }) => {
        const r = row.original;
        const person = r.partner_id ? partners[r.partner_id] : undefined;
        const main = variant === "capital" ? person ?? "—" : r.title || r.category_name || ((r.txn_type === "investment" || r.txn_type === "withdrawal") && person) || t.txnTypes[r.txn_type];
        const sub = variant === "capital" ? r.title : [r.title ? r.category_name : null, r.reference].filter(Boolean).join(" · ");
        return (
          <div className={cn("min-w-0", r.status === "reversed" && "opacity-60")}>
            <p className={cn("truncate font-medium", r.status === "reversed" && "line-through")}>{main}</p>
            {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
          </div>
        );
      },
    });
    if (variant === "ads") {
      cols.push({
        id: "platform", accessorFn: (r) => (r.ad_platform ? t.platforms[r.ad_platform] : ""), header: t.platform, meta: { label: t.platform },
        cell: ({ row }) => row.original.ad_platform ? <Badge variant="brand">{t.platforms[row.original.ad_platform]}</Badge> : <span className="text-muted-foreground">—</span>,
      });
      cols.push({
        id: "campaign", accessorFn: (r) => [r.campaign_name, r.target_product].filter(Boolean).join(" · "), header: t.campaign, meta: { label: t.campaign },
        cell: ({ row }) => (
          <div className="min-w-0 text-[13px]">
            <p className="truncate">{row.original.campaign_name || "—"}</p>
            {row.original.target_product && <p className="truncate text-xs text-muted-foreground">{row.original.target_product}</p>}
          </div>
        ),
      });
    }
    if (variant === "expenses" || variant === "all") {
      cols.push({
        id: "category", accessorKey: "category_name", header: t.category, meta: { label: t.category },
        cell: ({ row }) => row.original.category_name
          ? <Badge variant={row.original.is_advertising ? "brand" : "neutral"}>{row.original.category_name}</Badge>
          : <span className="text-muted-foreground">—</span>,
      });
    }
    cols.push({
      id: "source", header: variant === "capital" ? t.account_ : t.paidFrom, meta: { label: t.account_ },
      accessorFn: (r) => sourceLabel(r, accounts, partners, t),
      cell: ({ row }) => <span className="whitespace-nowrap text-[13px] text-muted-foreground">{sourceLabel(row.original, accounts, partners, t)}</span>,
    });
    cols.push({
      id: "amount", accessorKey: "amount", header: t.amount, meta: { label: t.amount, align: "right", csv: (r) => (r as Txn).amount } satisfies ColMeta,
      cell: ({ row }) => {
        const r = row.original; const s = SIGN[r.txn_type];
        return (
          <span className={cn("font-medium whitespace-nowrap", r.status === "reversed" && "text-muted-foreground line-through",
            r.status !== "reversed" && s > 0 && "text-success")}>
            {fmtMoney(s === 0 ? r.amount : s * r.amount, lang, { sign: s > 0 })}
          </span>
        );
      },
    });
    cols.push({
      id: "status", accessorFn: (r) => (r.status === "reversed" ? t.reversed : ""), header: "", enableSorting: false, meta: { className: "w-24" },
      cell: ({ row }) => row.original.status === "reversed"
        ? <Badge variant="warning" title={row.original.reversal_reason ?? ""}><Undo2 /> {t.reversed}</Badge> : null,
    });
    if (canWrite) {
      cols.push({
        id: "actions", header: () => <span className="sr-only">{t.actions}</span>, enableSorting: false, enableHiding: false, meta: { className: "w-10 pr-2" },
        cell: ({ row }) => row.original.status === "posted" ? (
          <Menu>
            <MenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label={t.actions}><MoreHorizontal /></Button></MenuTrigger>
            <MenuContent>
              <MenuItem onSelect={() => setReversing(row.original)} className="text-destructive"><Undo2 className="!text-destructive" /> {t.reverse}</MenuItem>
            </MenuContent>
          </Menu>
        ) : null,
      });
    }
    return cols;
  }, [t, lang, variant, accounts, partners, canWrite]);

  const empty = <div className="p-6"><EmptyState icon={Receipt} title={emptyText} action={emptyAction} /></div>;
  return (
    <>
      <DataTable data={rows} columns={columns} t={t} exportName={exportName} empty={empty} pageSize={variant === "recent" ? 8 : 20} dense={variant === "recent"} />
      <ReverseDialog txn={reversing} onClose={() => setReversing(null)} t={t} lang={lang} businessId={businessId} />
    </>
  );
}

function sourceLabel(r: Txn, accounts: Record<string, string>, partners: Record<string, string>, t: Dict) {
  if (r.txn_type === "transfer") return `${accounts[r.account_id ?? ""] ?? "—"} → ${accounts[r.to_account_id ?? ""] ?? "—"}`;
  if (r.txn_type === "expense" && !r.account_id && r.partner_id) return `${t.paidPersonally}: ${partners[r.partner_id] ?? "—"}`;
  if ((r.txn_type === "investment" || r.txn_type === "withdrawal") && !r.account_id) return r.linked_txn_id ? t.paidPersonally : t.notDeposited;
  return accounts[r.account_id ?? ""] ?? "—";
}

function TypeBadge({ type, t }: { type: string; t: Dict }) {
  const map: Record<string, { v: "neutral" | "success" | "destructive" | "brand"; I: typeof ArrowUpRight }> = {
    expense: { v: "neutral", I: ArrowUpRight }, withdrawal: { v: "destructive", I: ArrowUpRight },
    income: { v: "success", I: ArrowDownLeft }, investment: { v: "success", I: ArrowDownLeft }, transfer: { v: "brand", I: ArrowLeftRight },
  };
  const m = map[type] ?? map.expense;
  return <Badge variant={m.v}><m.I /> {t.txnTypes[type]}</Badge>;
}

function ReverseDialog({ txn, onClose, t, lang, businessId }: { txn: Txn | null; onClose: () => void; t: Dict; lang: Lang; businessId: string }) {
  const [reason, setReason] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string>();
  React.useEffect(() => { setReason(""); setErr(undefined); }, [txn]);
  return (
    <Dialog open={!!txn} onOpenChange={(o) => !o && onClose()}>
      <DialogContent title={t.reverseTitle} description={t.reverseDesc}>
        {txn && (
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="truncate font-medium">{txn.title || txn.category_name || t.txnTypes[txn.txn_type]}</span>
              <span className="tabular font-semibold">{fmtMoney(txn.amount, lang)}</span>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">{fmtDate(txn.txn_date, lang)} · {t.txnTypes[txn.txn_type]}</p>
          </div>
        )}
        <Field label={t.reason} htmlFor="rev-reason" error={err}>
          <Textarea id="rev-reason" value={reason} onChange={(e) => { setReason(e.target.value); setErr(undefined); }} placeholder={t.reverseReasonPh} maxLength={300} />
        </Field>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={onClose}>{t.cancel}</Button>
          <Button variant="destructive" loading={busy} onClick={async () => {
            if (!reason.trim()) return setErr(t.err_reason_required);
            setBusy(true);
            const res = await reverseTxn(txn!.id, businessId, reason);
            setBusy(false);
            if (res.error) setErr(res.error); else { toast.success(res.ok); onClose(); }
          }}><Undo2 /> {t.reverse}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
