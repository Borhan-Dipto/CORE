import { Page, Notice } from "@/components/shell/Page";
import { Kpi } from "@/components/data/Kpi";
import { DateRange } from "@/components/data/DateRange";
import { LedgerTable } from "@/components/data/LedgerTable";
import { RankBars } from "@/components/charts/Charts";
import { ExpenseDialog } from "@/components/forms/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { loadBizPage } from "@/lib/bizpage";
import { getSummary, getTransactions } from "@/lib/workspace";
import { fmtMoney, fmtNum } from "@/lib/i18n";

export const metadata = { title: "Expenses" };

export default async function ExpensesPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const p = await loadBizPage(id, await searchParams);
  const { t, lang, range } = p;
  const [s, rows] = await Promise.all([getSummary(id, range.from, range.to), getTransactions(id, range, { types: ["expense"] })]);
  const nonAd = s.expenses - s.ad_spend;
  return (
    <Page wide title={t.expenses} actions={<><DateRange t={t} current={range.key} from={range.from} to={range.to} />{p.writable && <ExpenseDialog t={t} businessId={id} opts={p.opts} openKey="expense" />}</>}>
      {!p.writable && <Notice tone="info">{t.readOnlyNote}</Notice>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi label={t.kpiExpenses} value={fmtMoney(s.expenses, lang)} definition={t.kpiExpensesDef} hint={`${fmtNum(s.expense_count, lang)} ${t.rows}`} />
        <Kpi label={t.kpiAdSpend} value={fmtMoney(s.ad_spend, lang)} definition={t.kpiAdSpendDef} />
        <Kpi label={t.byCategory} value={fmtMoney(nonAd, lang)} hint={s.by_category.filter((c) => !c.is_advertising)[0]?.name} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <LedgerTable rows={rows} t={t} lang={lang} variant="expenses" businessId={id} canWrite={p.writable} exportName={`expenses-${range.from}-${range.to}`}
          accounts={p.accountNames} partners={p.partnerNames} emptyText={t.noExpenses}
          emptyAction={p.writable ? <ExpenseDialog t={t} businessId={id} opts={p.opts} variant="outline" /> : undefined} />
        <Card className="h-fit">
          <CardHeader><CardTitle>{t.byCategory}</CardTitle></CardHeader>
          <CardContent>{s.by_category.length ? <RankBars lang={lang} data={s.by_category.map((c) => ({ label: c.name, value: c.total, accent: c.is_advertising }))} />
            : <p className="py-6 text-center text-sm text-muted-foreground">{t.noExpenses}</p>}</CardContent>
        </Card>
      </div>
    </Page>
  );
}
