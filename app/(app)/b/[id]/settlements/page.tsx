import { HandCoins, AlertTriangle } from "lucide-react";
import { Page, Notice, EmptyState } from "@/components/shell/Page";
import { Kpi } from "@/components/data/Kpi";
import { Badge, Card, CardContent } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { DocumentMenu } from "@/components/documents";
import { PayShareDialog, SettleDialog, VoidSettlementButton } from "@/components/forms/settlement";
import { loadBizPage } from "@/lib/bizpage";
import { getSettlements, suggestPeriod } from "@/lib/settlements";
import { fmtDate, fmtMoney, fmtNum } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const metadata = { title: "Profit distribution" };

export default async function SettlementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await loadBizPage(id, { range: "all" });
  const { t, lang, members } = p;
  const settlements = await getSettlements(id);
  const suggested = await suggestPeriod(id, settlements, p.business.start_date);
  const finals = settlements.filter((s) => s.status === "final");
  const latestId = finals[0]?.id;
  const totals = finals.reduce((a, s) => ({ dist: a.dist + s.distributable, paid: a.paid + s.paid }), { dist: 0, paid: 0 });
  const names = p.partnerNames;
  const emailOf = Object.fromEntries(members.map((m) => [m.user_id, m.email]));

  return (
    <Page wide title={t.settlements} description={t.settlementsDesc}
      actions={p.writable && <SettleDialog t={t} lang={lang} businessId={id} suggested={suggested} accounts={p.opts.accounts} partnerNames={names} />}>
      {!p.writable && <Notice tone="info">{t.readOnlySettlement}</Notice>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label={t.distributable} value={fmtMoney(totals.dist, lang)} />
        <Kpi label={t.paid} value={fmtMoney(totals.paid, lang)} />
        <Kpi label={t.retained} value={fmtMoney(totals.dist - totals.paid, lang)} />
        <Kpi label={t.lossCarriedNext} value={fmtMoney(finals[0]?.carry_out ?? 0, lang)} tone={(finals[0]?.carry_out ?? 0) > 0 ? "negative" : undefined} />
      </div>

      {settlements.length === 0 ? (
        <Card><EmptyState icon={HandCoins} title={t.noSettlements} description={t.noSettlementsDesc}
          action={p.writable ? <SettleDialog t={t} lang={lang} businessId={id} suggested={suggested} accounts={p.opts.accounts} partnerNames={names} /> : undefined} /></Card>
      ) : (
        <div className="grid gap-4">
          {settlements.map((s) => {
            const isVoid = s.status === "void";
            const changed = !isVoid && s.live_net_profit !== null && Math.abs(s.live_net_profit - s.net_profit) >= 0.01;
            return (
              <Card key={s.id} className={cn("overflow-hidden", isVoid && "opacity-60")}>
                <div className="flex flex-wrap items-start gap-3 border-b border-border p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{t.settlementNo} #{fmtNum(s.settlement_no, lang)}</p>
                      {isVoid ? <Badge variant="warning">{t.voided}</Badge> : s.distributable > 0 ? <Badge variant="success">{fmtMoney(s.distributable, lang)}</Badge> : <Badge variant="neutral">{t.lossCarriedNext}</Badge>}
                    </div>
                    <p className="mt-0.5 text-[13px] text-muted-foreground">{fmtDate(s.period_from, lang)} – {fmtDate(s.period_to, lang)}{s.note ? ` · ${s.note}` : ""}</p>
                    {isVoid && s.void_reason && <p className="mt-1 text-xs text-muted-foreground">{t.reason}: {s.void_reason}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <DocumentMenu t={t} href={`/doc/settlement/${s.id}`} label={t.settlementDoc} />
                    {p.writable && !isVoid && s.id === latestId && <VoidSettlementButton t={t} settlementId={s.id} businessId={id} />}
                  </div>
                </div>
                {changed && (
                  <div className="flex items-start gap-2 border-b border-border bg-warning-soft px-5 py-2.5 text-[13px] text-warning">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    <span>{t.changedSince}. {t.changedSinceDesc}<span className="tabular font-medium">{fmtMoney(s.live_net_profit ?? 0, lang)}</span></span>
                  </div>
                )}
                <CardContent className="grid gap-5 p-5 lg:grid-cols-[260px_1fr]">
                  <dl className="grid h-fit gap-1.5 text-sm">
                    <div className="flex justify-between"><dt className="text-muted-foreground">{t.netProfitPeriod}</dt><dd className={cn("tabular", s.net_profit < 0 && "text-destructive")}>{fmtMoney(s.net_profit, lang)}</dd></div>
                    {s.carry_in > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">{t.carriedLoss}</dt><dd className="tabular">−{fmtMoney(s.carry_in, lang)}</dd></div>}
                    <div className="flex justify-between border-t border-border pt-1.5 font-semibold"><dt>{t.distributable}</dt><dd className="tabular">{fmtMoney(s.distributable, lang)}</dd></div>
                    {s.carry_out > 0 && <div className="flex justify-between text-destructive"><dt>{t.lossCarriedNext}</dt><dd className="tabular">{fmtMoney(s.carry_out, lang)}</dd></div>}
                  </dl>
                  {s.allocations.length > 0 && s.distributable > 0 ? (
                    <div className="grid gap-2">
                      {s.allocations.map((a) => (
                        <div key={a.partner_id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3">
                          <Avatar name={names[a.partner_id] ?? "?"} seed={emailOf[a.partner_id]} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{names[a.partner_id] ?? "—"} <span className="text-xs font-normal text-muted-foreground">· {fmtNum(a.percentage, lang, 2).replace(/[.,]0+$/, "")}%</span></p>
                            <p className="tabular text-xs text-muted-foreground">
                              {t.shareOfProfit} {fmtMoney(a.share, lang)} · {t.paid} {fmtMoney(a.paid, lang)} · {t.retained} {fmtMoney(a.remaining, lang)}
                            </p>
                          </div>
                          {p.writable && !isVoid && a.remaining > 0 && (
                            <PayShareDialog t={t} lang={lang} businessId={id} settlementId={s.id} partnerId={a.partner_id}
                              partnerName={names[a.partner_id] ?? "—"} remaining={a.remaining} accounts={p.opts.accounts} />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-[13px] text-muted-foreground">{t.lossPeriodNote}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </Page>
  );
}
