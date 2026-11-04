"use client";

import * as React from "react";
import { useActionState } from "react";
import { toast } from "sonner";
import { Calculator, HandCoins, Undo2 } from "lucide-react";
import * as A from "@/app/actions";
import type { FormState } from "@/app/actions";
import type { Preview } from "@/lib/settlements";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent, DialogTrigger } from "@/components/ui/overlay";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { fmtDate, fmtMoney, fmtNum, type Dict, type Lang } from "@/lib/i18n";
import { cn, parseAmount } from "@/lib/utils";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
const n = (v: string) => parseAmount(v);
type Acc = { id: string; name: string; type: string; is_active: boolean };

function ErrorText({ msg }: { msg?: string }) {
  return msg ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive-soft px-3 py-2 text-[13px] text-destructive">{msg}</p> : null;
}
function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "neg" | "pos" }) {
  return (
    <div className={cn("flex items-center justify-between gap-4", strong && "border-t border-border pt-2 text-base font-semibold")}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span className={cn("tabular", tone === "neg" && "text-destructive", tone === "pos" && "text-success")}>{value}</span>
    </div>
  );
}

export function SettleDialog({ t, lang, businessId, suggested, accounts, partnerNames }: {
  t: Dict; lang: Lang; businessId: string; suggested: { from: string; to: string; locked: boolean };
  accounts: Acc[]; partnerNames: Record<string, string>;
}) {
  const active = accounts.filter((a) => a.is_active);
  const [open, setOpen] = React.useState(false);
  const [from, setFrom] = React.useState(suggested.from);
  const [to, setTo] = React.useState(suggested.to);
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [loading, startLoading] = React.useTransition();
  const [previewError, setPreviewError] = React.useState<string>();
  const [pay, setPay] = React.useState<Record<string, { amount: string; account: string }>>({});
  const [state, run, pending] = useActionState(A.settleProfit, {} as FormState);

  const calc = React.useCallback((f: string, tt: string) => {
    startLoading(async () => {
      const res = await A.previewSettlement(businessId, f, tt);
      setPreviewError(res.error);
      setPreview(res.preview ?? null);
      setPay(Object.fromEntries((res.preview?.allocations ?? []).map((a) => [a.partner_id, { amount: "0", account: active[0]?.id ?? "" }])));
    });
  }, [businessId, active]);

  React.useEffect(() => { if (open) calc(from, to); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);
  React.useEffect(() => { if (state.ok) { toast.success(state.ok); setOpen(false); } }, [state]);

  const payouts = preview?.allocations.map((a) => ({ partner_id: a.partner_id, amount: n(pay[a.partner_id]?.amount ?? "0"), account_id: pay[a.partner_id]?.account || null })) ?? [];
  const over = preview?.allocations.some((a) => n(pay[a.partner_id]?.amount ?? "0") > a.share);
  const splitProblem = preview && preview.distributable > 0 && (preview.shares_total !== 100 || preview.allocations.some((a) => !a.active));
  const setAll = (mode: "pay" | "keep") => setPay((p) => Object.fromEntries(Object.entries(p).map(([k, v]) => {
    const a = preview?.allocations.find((x) => x.partner_id === k);
    return [k, { ...v, amount: mode === "pay" ? String(a?.share ?? 0) : "0" }];
  })));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button><HandCoins /> {t.closePeriod}</Button></DialogTrigger>
      <DialogContent title={t.closePeriod} description={t.settlementsDesc} className="sm:max-w-2xl">
        <form action={run} className="grid gap-5">
          <input type="hidden" name="business_id" value={businessId} />
          <input type="hidden" name="from" value={from} /><input type="hidden" name="to" value={to} />
          <input type="hidden" name="payouts" value={JSON.stringify(payouts)} />
          <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
            <Field label={t.periodFrom} htmlFor="s-from"><Input id="s-from" type="date" value={from} disabled={suggested.locked} max={today()} onChange={(e) => setFrom(e.target.value)} /></Field>
            <Field label={t.periodTo} htmlFor="s-to"><Input id="s-to" type="date" value={to} min={from} max={today()} onChange={(e) => setTo(e.target.value)} /></Field>
            <Button type="button" variant="outline" className="col-span-2 sm:col-span-1" onClick={() => calc(from, to)} loading={loading}><Calculator /> {t.previewSettlement}</Button>
          </div>
          {suggested.locked && <p className="-mt-3 text-xs text-muted-foreground">{t.nextPeriodHint}: {fmtDate(suggested.from, lang)}</p>}
          <ErrorText msg={previewError} />

          {preview && (
            <>
              <div className="grid gap-1.5 rounded-lg border border-border bg-muted/40 p-4 text-sm">
                <Row label={t.netProfitPeriod} value={fmtMoney(preview.net_profit, lang)} tone={preview.net_profit < 0 ? "neg" : undefined} />
                {preview.carry_in > 0 && <Row label={t.carriedLoss} value={`−${fmtMoney(preview.carry_in, lang)}`} />}
                <Row label={t.distributable} value={fmtMoney(preview.distributable, lang)} strong tone={preview.distributable > 0 ? "pos" : undefined} />
                {preview.carry_out > 0 && <Row label={t.lossCarriedNext} value={fmtMoney(preview.carry_out, lang)} tone="neg" />}
              </div>
              {preview.distributable === 0 && <p className="text-[13px] text-muted-foreground">{t.lossPeriodNote}</p>}
              {splitProblem && <ErrorText msg={preview.allocations.some((a) => !a.active) ? t.err_share_partner_inactive : t.splitMissing} />}

              {preview.distributable > 0 && !splitProblem && (
                <div className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{t.shareSplitHint}</p>
                    <div className="flex gap-1">
                      <Button type="button" size="sm" variant="ghost" onClick={() => setAll("pay")}>{t.payAll}</Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => setAll("keep")}>{t.keepAll}</Button>
                    </div>
                  </div>
                  <div className="overflow-hidden rounded-lg border border-border">
                    {preview.allocations.map((a) => {
                      const p = pay[a.partner_id] ?? { amount: "0", account: "" };
                      const keep = Math.max(a.share - n(p.amount), 0);
                      return (
                        <div key={a.partner_id} className="grid gap-3 border-b border-border p-3 last:border-0 sm:grid-cols-[1fr_140px_150px] sm:items-end">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{partnerNames[a.partner_id] ?? a.name ?? "—"}</p>
                            <p className="tabular text-xs text-muted-foreground">{fmtNum(a.percentage, lang, 2).replace(/[.,]0+$/, "")}% · {t.shareOfProfit} {fmtMoney(a.share, lang)} · {t.keepInBusiness} {fmtMoney(keep, lang)}</p>
                          </div>
                          <Field label={`${t.payNow} (৳)`} htmlFor={`pay-${a.partner_id}`}>
                            <Input id={`pay-${a.partner_id}`} inputMode="decimal" className={cn("tabular", n(p.amount) > a.share && "border-destructive")} value={p.amount}
                              onChange={(e) => setPay((s) => ({ ...s, [a.partner_id]: { ...p, amount: e.target.value } }))} />
                          </Field>
                          <Field label={t.payFrom} htmlFor={`acc-${a.partner_id}`}>
                            <Select id={`acc-${a.partner_id}`} value={p.account} disabled={n(p.amount) <= 0}
                              onValueChange={(v) => setPay((s) => ({ ...s, [a.partner_id]: { ...p, account: v } }))}
                              options={active.map((x) => ({ value: x.id, label: x.name, hint: t.accountTypes[x.type] }))} />
                          </Field>
                        </div>
                      );
                    })}
                  </div>
                  {over && <ErrorText msg={t.err_payout_exceeds_share} />}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label={t.paidOn} htmlFor="s-paid"><Input id="s-paid" name="paid_on" type="date" defaultValue={today()} max={today()} /></Field>
                  </div>
                </div>
              )}
              <Field label={t.note} htmlFor="s-note" optional={t.optional}><Textarea id="s-note" name="note" rows={2} maxLength={500} /></Field>
            </>
          )}
          <ErrorText msg={state.error} />
          <Button type="submit" loading={pending} disabled={!preview || loading || !!over || !!splitProblem}>{t.settleConfirm}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function PayShareDialog({ t, lang, businessId, settlementId, partnerId, partnerName, remaining, accounts }: {
  t: Dict; lang: Lang; businessId: string; settlementId: string; partnerId: string; partnerName: string; remaining: number; accounts: Acc[];
}) {
  const [open, setOpen] = React.useState(false);
  const [state, run, pending] = useActionState(A.payProfit, {} as FormState);
  React.useEffect(() => { if (state.ok) { toast.success(state.ok); setOpen(false); } }, [state]);
  const active = accounts.filter((a) => a.is_active);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><HandCoins /> {t.payRemaining}</Button></DialogTrigger>
      <DialogContent title={t.payProfitTitle} description={`${partnerName} · ${t.remaining} ${fmtMoney(remaining, lang)}`}>
        <form action={run} className="grid gap-4">
          <input type="hidden" name="business_id" value={businessId} /><input type="hidden" name="settlement_id" value={settlementId} />
          <input type="hidden" name="partner_id" value={partnerId} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={`${t.amount} (৳)`} htmlFor="pp-amt"><Input id="pp-amt" name="amount" inputMode="decimal" className="tabular text-base font-medium" defaultValue={String(remaining)} required /></Field>
            <Field label={t.date} htmlFor="pp-d"><Input id="pp-d" name="date" type="date" defaultValue={today()} max={today()} /></Field>
          </div>
          <Field label={t.payFrom} htmlFor="pp-acc">
            <Select id="pp-acc" name="account_id" required defaultValue={active[0]?.id} options={active.map((a) => ({ value: a.id, label: a.name, hint: t.accountTypes[a.type] }))} />
          </Field>
          <ErrorText msg={state.error} />
          <Button type="submit" loading={pending}>{t.payRemaining}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function VoidSettlementButton({ t, settlementId, businessId }: { t: Dict; settlementId: string; businessId: string }) {
  const [reason, setReason] = React.useState("");
  return (
    <ConfirmDialog destructive title={t.voidSettlement} description={t.voidDesc} confirmLabel={t.voidSettlement} cancelLabel={t.cancel}
      trigger={<Button size="sm" variant="ghost" className="text-destructive"><Undo2 /> {t.voidSettlement}</Button>}
      onConfirm={async () => {
        if (!reason.trim()) { toast.error(t.err_reason_required); throw new Error("reason"); }
        const r = await A.voidSettlement(settlementId, businessId, reason);
        if (r.error) { toast.error(r.error); throw new Error(r.error); }
        toast.success(t.saved);
      }}>
      <Field label={t.reason} htmlFor="v-reason"><Input id="v-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t.reverseReasonPh} /></Field>
    </ConfirmDialog>
  );
}
