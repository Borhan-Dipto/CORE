import Link from "next/link";
import { ArrowRight, Building2, Megaphone, Receipt, Wallet } from "lucide-react";
import { Page, EmptyState } from "@/components/shell/Page";
import { Kpi } from "@/components/data/Kpi";
import { DateRange } from "@/components/data/DateRange";
import { ComparisonChart } from "@/components/charts/Charts";
import { NewBusinessDialog } from "@/components/forms/core";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, Badge } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { getBusinesses, getContext, getT } from "@/lib/session";
import { resolveRange } from "@/lib/range";
import { fmtMoney, fmtNum } from "@/lib/i18n";

type Row = { business_id: string; name: string; status: string; expenses: number; ad_spend: number; income: number; investments: number; cash_balance: number; partners: number; revenue: number; net_profit: number };

export default async function OverviewPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const range = resolveRange(sp);
  const [{ supabase, isOwner, name }, { lang, t }, businesses] = await Promise.all([getContext(), getT(), getBusinesses()]);
  const { data } = await supabase.rpc("global_summary", { p_from: range.from, p_to: range.to });
  const rows = ((data ?? []) as Row[]).map((r) => ({ ...r, expenses: +r.expenses, ad_spend: +r.ad_spend, investments: +r.investments, cash_balance: +r.cash_balance, partners: +r.partners, revenue: +r.revenue, net_profit: +r.net_profit }));
  const active = rows.filter((r) => r.status === "active");
  const sum = (k: keyof Row) => active.reduce((s, r) => s + Number(r[k]), 0);
  const first = name.split(/\s+/)[0];

  return (
    <Page wide title={`${t.welcome}, ${first}`} description={isOwner ? t.greetingOwner : t.greetingPartner}
      actions={<>{businesses.length > 0 && <DateRange t={t} current={range.key} from={range.from} to={range.to} />}{isOwner && <NewBusinessDialog t={t} />}</>}>
      {businesses.length === 0 ? (
        <EmptyState icon={Building2} title={isOwner ? t.newBusiness : t.noBusinessesPartner} description={isOwner ? t.noBusinessesOwner : undefined}
          action={isOwner ? <NewBusinessDialog t={t} /> : undefined} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Kpi label={t.kpiRevenue} value={fmtMoney(sum("revenue"), lang)} definition={t.kpiRevenueDef} icon={<Building2 />} hint={`${fmtNum(active.length, lang)} ${t.activeBusinesses.toLowerCase()}`} />
            <Kpi label={t.kpiNet} value={fmtMoney(sum("net_profit"), lang, { sign: true })} definition={t.kpiNetDef} icon={<Receipt />} tone={sum("net_profit") < 0 ? "negative" : sum("net_profit") > 0 ? "positive" : undefined} />
            <Kpi label={t.totalAdSpend} value={fmtMoney(sum("ad_spend"), lang)} definition={t.kpiAdSpendDef} icon={<Megaphone />} />
            <Kpi label={t.totalCash} value={fmtMoney(sum("cash_balance"), lang)} definition={t.kpiCashDef} icon={<Wallet />}
              tone={sum("cash_balance") < 0 ? "negative" : undefined} />
          </div>

          {active.length > 1 && (
            <Card>
              <CardHeader><CardTitle>{t.comparison}</CardTitle><CardDescription>{t.comparisonDesc}</CardDescription></CardHeader>
              <CardContent>
                <ComparisonChart lang={lang} labels={{ expenses: t.kpiExpenses, ads: t.kpiAdSpend, cash: t.kpiCash }}
                  data={active.map((r) => ({ name: r.name, expenses: r.expenses, ad_spend: r.ad_spend, cash: r.cash_balance }))} />
              </CardContent>
            </Card>
          )}

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {rows.map((r) => (
              <Link key={r.business_id} href={`/b/${r.business_id}`} className="group outline-none">
                <Card className="h-full p-5 transition group-hover:border-foreground/20 group-hover:shadow-pop group-focus-visible:ring-2 group-focus-visible:ring-ring/60">
                  <div className="flex items-start gap-3">
                    <Avatar name={r.name} seed={r.business_id} size="lg" square />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-semibold">{r.name}</h3>
                        {r.status === "archived" && <Badge>{t.archived}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{fmtNum(r.partners, lang)} {t.partners}</p>
                    </div>
                    <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground" />
                  </div>
                  <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-border pt-4">
                    {[[t.kpiRevenue, r.revenue], [t.kpiNet, r.net_profit], [t.kpiCash, r.cash_balance]].map(([l, v]) => (
                      <div key={String(l)} className="min-w-0">
                        <dt className="truncate text-[11px] text-muted-foreground">{l}</dt>
                        <dd className={`tabular truncate text-sm font-semibold ${Number(v) < 0 ? "text-destructive" : ""}`}>{fmtMoney(Number(v), lang, { compact: true })}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              </Link>
            ))}
          </div>
          
        </>
      )}
    </Page>
  );
}
