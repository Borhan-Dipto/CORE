import { Megaphone } from "lucide-react";
import { Page, Notice } from "@/components/shell/Page";
import { Kpi } from "@/components/data/Kpi";
import { DateRange } from "@/components/data/DateRange";
import { LedgerTable } from "@/components/data/LedgerTable";
import { SpendTrendChart, RankBars } from "@/components/charts/Charts";
import { ExpenseDialog } from "@/components/forms/finance";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadBizPage } from "@/lib/bizpage";
import { getOrderSummary } from "@/lib/sales";
import { getCampaignPerformance } from "@/lib/campaignPerf";
import { CampaignTable } from "@/components/data/CampaignTable";
import { getSummary, getTransactions } from "@/lib/workspace";
import { chartRange } from "@/lib/range";
import { fmtMoney, fmtNum } from "@/lib/i18n";

export const metadata = { title: "Advertising" };

export default async function AdvertisingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const p = await loadBizPage(id, await searchParams);
  const { t, lang, range } = p;
  const cr = chartRange(range);
  const [s, rows, chart] = await Promise.all([
    getSummary(id, range.from, range.to), getTransactions(id, range, { types: ["expense"], adsOnly: true }),
    range.key === "all" ? getSummary(id, cr.from, cr.to) : Promise.resolve(null),
  ]);
  const os = await getOrderSummary(id, range.from, range.to);
  const perf = await getCampaignPerformance(id, range.from, range.to, os);
  const days = Math.max(1, (chart ?? s).daily.length);
  const campaigns = new Set(rows.filter((r) => r.status === "posted" && r.campaign_name).map((r) => r.campaign_name)).size;
  return (
    <Page wide title={t.advertising} actions={<><DateRange t={t} current={range.key} from={range.from} to={range.to} />{p.writable && <ExpenseDialog t={t} businessId={id} opts={p.opts} advertising />}</>}>
      {!p.writable && <Notice tone="info">{t.readOnlyNote}</Notice>}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label={t.kpiAdSpend} value={fmtMoney(s.ad_spend, lang)} definition={t.kpiAdSpendDef} icon={<Megaphone />} />
        <Kpi label={`${t.kpiAdSpend} / ${t.today.toLowerCase()}`} value={fmtMoney(Math.round(s.ad_spend / days), lang)} hint={`${fmtNum(days, lang)} ${t.date.toLowerCase()}`} />
        <Kpi label={t.campaigns} value={fmtNum(campaigns, lang)} />
        <Kpi label={t.kpiRoas} value={s.ad_spend > 0 && os.revenue > 0 ? `${fmtNum(os.revenue / s.ad_spend, lang, 1)}×` : "—"} definition={t.kpiRoasDef} hint={`${t.kpiRevenue}: ${fmtMoney(os.revenue, lang)}`} />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>{t.spendTrend}</CardTitle><CardDescription>{t.kpiAdSpend}</CardDescription></CardHeader>
          <CardContent><SpendTrendChart data={(chart ?? s).daily} lang={lang} labels={{ expenses: t.kpiExpenses, ads: t.kpiAdSpend }} /></CardContent>
        </Card>
        <div className="grid gap-6">
          <Card><CardHeader><CardTitle>{t.adsByPlatform}</CardTitle></CardHeader><CardContent>
            {s.by_platform.length ? <RankBars highlight lang={lang} data={s.by_platform.map((x) => ({ label: t.platforms[x.platform] ?? x.platform, value: x.total }))} />
              : <p className="py-4 text-center text-sm text-muted-foreground">{t.noAds}</p>}
          </CardContent></Card>
          <Card><CardHeader><CardTitle>{t.adsByProduct}</CardTitle></CardHeader><CardContent>
            {s.by_product.length ? <RankBars highlight lang={lang} data={s.by_product.slice(0, 6).map((x) => ({ label: x.product, value: x.total }))} />
              : <p className="py-4 text-center text-sm text-muted-foreground">{t.noAds}</p>}
          </CardContent></Card>
        </div>
      </div>
      <CampaignTable rows={perf} t={t} lang={lang} />
      <LedgerTable rows={rows} t={t} lang={lang} variant="ads" businessId={id} canWrite={p.writable} exportName={`advertising-${range.from}-${range.to}`}
        accounts={p.accountNames} partners={p.partnerNames} emptyText={t.noAds}
        emptyAction={p.writable ? <ExpenseDialog t={t} businessId={id} opts={p.opts} advertising variant="outline" /> : undefined} />
    </Page>
  );
}
