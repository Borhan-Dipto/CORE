import { Page } from "@/components/shell/Page";
import { Kpi } from "@/components/data/Kpi";
import { DateRange } from "@/components/data/DateRange";
import { RevenueTrendChart, RankBars } from "@/components/charts/Charts";
import { CampaignTable } from "@/components/data/CampaignTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { loadBizPage } from "@/lib/bizpage";
import { getOrderSummary, getPnl } from "@/lib/sales";
import { getCampaignPerformance } from "@/lib/campaignPerf";
import { chartRange } from "@/lib/range";
import { fmtMoney, fmtNum } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export const metadata = { title: "Profit & loss" };

export default async function PnlPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const p = await loadBizPage(id, await searchParams);
  const { t, lang, range, members } = p;
  const cr = chartRange(range);
  const [pl, s, chart] = await Promise.all([getPnl(id, range.from, range.to), getOrderSummary(id, range.from, range.to),
    range.key === "all" ? getOrderSummary(id, cr.from, cr.to) : Promise.resolve(null)]);
  const campaigns = await getCampaignPerformance(id, range.from, range.to, s);
  const line = (label: string, v: number, opts: { strong?: boolean; neg?: boolean; indent?: boolean } = {}) => (
    <div className={cn("flex items-baseline justify-between gap-4 py-2", opts.strong && "border-t border-border pt-3 text-base font-semibold", opts.indent && "pl-4 text-[13px] text-muted-foreground")}>
      <span>{label}</span>
      <span className={cn("tabular", opts.strong && (v >= 0 ? "text-success" : "text-destructive"))}>{opts.neg ? `−${fmtMoney(v, lang)}` : fmtMoney(v, lang, { sign: opts.strong })}</span>
    </div>
  );
  return (
    <Page wide title={t.pnl} actions={<DateRange t={t} current={range.key} from={range.from} to={range.to} />}>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label={t.kpiRevenue} value={fmtMoney(pl.revenue, lang)} definition={t.kpiRevenueDef} />
        <Kpi label={t.kpiGross} value={fmtMoney(pl.gross_profit, lang)} definition={t.kpiGrossDef} tone={pl.gross_profit < 0 ? "negative" : "positive"} />
        <Kpi label={t.kpiNet} value={fmtMoney(pl.net_profit, lang, { sign: true })} definition={t.kpiNetDef} tone={pl.net_profit < 0 ? "negative" : "positive"} />
        <Kpi label={t.kpiRoas} value={pl.roas === null ? "—" : `${fmtNum(pl.roas, lang, 1)}×`} definition={t.kpiRoasDef} hint={`${t.kpiAdSpend}: ${fmtMoney(pl.ad_spend, lang)}`} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader><CardTitle>{t.revenueTrend}</CardTitle><CardDescription>{t.revenueTrendDesc}</CardDescription></CardHeader>
          <CardContent><RevenueTrendChart data={(chart ?? s).daily} lang={lang} labels={{ revenue: t.kpiRevenue, profit: t.kpiGross }} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t.pnlStatement}</CardTitle></CardHeader>
          <CardContent className="pt-3 text-sm">
            {line(t.kpiRevenue, pl.revenue)}
            {line(t.cogs, pl.cogs, { neg: true, indent: true })}
            {line(t.directCosts, pl.direct_costs, { neg: true, indent: true })}
            {line(t.grossProfit, pl.gross_profit, { strong: true })}
            {line(t.operatingExpenses, pl.operating_expenses, { neg: true })}
            {pl.opex_by_category.slice(0, 6).map((c) => <div key={c.name}>{line(c.name, c.total, { neg: true, indent: true })}</div>)}
            {pl.other_income > 0 && line(t.otherIncome, pl.other_income)}
            {line(t.netProfit, pl.net_profit, { strong: true })}
            {pl.inventory_purchases > 0 && <p className="mt-3 rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">{t.inventoryNote} <span className="tabular font-medium text-foreground">{fmtMoney(pl.inventory_purchases, lang)}</span></p>}
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>{t.partnerProfit}</CardTitle><CardDescription>{t.partnerProfitDesc}</CardDescription></CardHeader>
          <CardContent className="grid gap-4">
            {pl.allocations.length === 0 ? <p className="text-sm text-muted-foreground">{t.noSplit}</p> : pl.allocations.map((a) => {
              const m = members.find((x) => x.user_id === a.user_id);
              return (
                <div key={a.user_id} className="flex items-center gap-3">
                  <Avatar name={m?.name ?? "?"} seed={m?.email} />
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{m?.name ?? "—"}</p><p className="text-xs text-muted-foreground">{fmtNum(a.percentage, lang)}%</p></div>
                  <p className={cn("tabular text-sm font-semibold", a.amount < 0 ? "text-destructive" : "")}>{fmtMoney(a.amount, lang, { sign: true })}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t.productProfit}</CardTitle><CardDescription>{t.unitsSold}: {fmtNum(s.units_sold, lang)}</CardDescription></CardHeader>
          <CardContent>{s.by_product.length ? <RankBars highlight lang={lang} data={s.by_product.slice(0, 8).map((x) => ({ label: `${x.product} · ${fmtNum(x.units, lang)}`, value: Math.max(0, x.profit) }))} />
            : <p className="py-4 text-center text-sm text-muted-foreground">{t.noOrders}</p>}</CardContent>
        </Card>
      </div>
      <CampaignTable rows={campaigns} t={t} lang={lang} />
    </Page>
  );
}
