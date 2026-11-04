import Link from "next/link";
import { ArrowRight, CheckCircle2, Circle, Landmark, Megaphone, Receipt, Wallet, Users } from "lucide-react";
import { Page } from "@/components/shell/Page";
import { Kpi } from "@/components/data/Kpi";
import { DateRange } from "@/components/data/DateRange";
import { SpendTrendChart, RankBars } from "@/components/charts/Charts";
import { LedgerTable } from "@/components/data/LedgerTable";
import { ExpenseDialog } from "@/components/forms/finance";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { loadBizPage } from "@/lib/bizpage";
import { getSummary, getTransactions, getPendingInvites } from "@/lib/workspace";
import { chartRange } from "@/lib/range";
import { fmtMoney, fmtNum } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export default async function Dashboard({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const p = await loadBizPage(id, await searchParams);
  const { t, lang, range, business, members } = p;
  const cr = chartRange(range);
  const [s, chart, recent, invites] = await Promise.all([
    getSummary(id, range.from, range.to),
    range.key === "all" ? getSummary(id, cr.from, cr.to) : Promise.resolve(null),
    getTransactions(id, range, { limit: 8 }),
    getPendingInvites(id),
  ]);
  const daily = (chart ?? s).daily;
  const hasSplit = members.some((m) => m.percentage !== null);
  const steps = [
    { done: members.length > 1 || invites.length > 0, label: t.setupInvite, href: `/b/${id}/partners` },
    { done: hasSplit, label: t.setupSplit, href: `/b/${id}/partners` },
    { done: s.expense_count > 0 || recent.length > 0, label: t.setupFirstExpense, href: `/b/${id}/expenses` },
  ];
  const showSetup = p.writable && steps.some((x) => !x.done);
  const capitalTotal = members.reduce((a, m) => a + m.capital, 0);

  return (
    <Page wide title={business.name} description={business.category ?? undefined}
      actions={<><DateRange t={t} current={range.key} from={range.from} to={range.to} />{p.writable && <ExpenseDialog t={t} businessId={id} opts={p.opts} />}</>}>
      {showSetup && (
        <Card className="border-brand/25 bg-brand-soft/40">
          <CardHeader><CardTitle>{t.setupTitle}</CardTitle><CardDescription>{t.setupDesc}</CardDescription></CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3">
            {steps.map((x) => (
              <Link key={x.label} href={x.href} className={cn("flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5 text-sm transition hover:border-foreground/20", x.done && "text-muted-foreground")}>
                {x.done ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-muted-foreground" />}
                <span className={cn("flex-1", x.done && "line-through")}>{x.label}</span>
                {!x.done && <ArrowRight className="size-4 text-muted-foreground" />}
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label={t.kpiExpenses} value={fmtMoney(s.expenses, lang)} definition={t.kpiExpensesDef} icon={<Receipt />} hint={`${fmtNum(s.expense_count, lang)} ${t.expenses.toLowerCase()}`} />
        <Kpi label={t.kpiAdSpend} value={fmtMoney(s.ad_spend, lang)} definition={t.kpiAdSpendDef} icon={<Megaphone />}
          hint={s.expenses ? `${Math.round((s.ad_spend / s.expenses) * 100)}% ${t.of} ${t.kpiExpenses.toLowerCase()}` : undefined} />
        <Kpi label={t.kpiInvestments} value={fmtMoney(s.investments, lang)} definition={t.kpiInvestmentsDef} icon={<Landmark />} />
        <Kpi label={t.kpiCash} value={fmtMoney(s.cash_balance, lang)} definition={t.kpiCashDef} icon={<Wallet />} tone={s.cash_balance < 0 ? "negative" : undefined} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>{t.spendTrend}</CardTitle><CardDescription>{t.spendTrendDesc}</CardDescription></CardHeader>
          <CardContent><SpendTrendChart data={daily} lang={lang} labels={{ expenses: t.kpiExpenses, ads: t.kpiAdSpend }} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>{t.byCategory}</CardTitle></CardHeader>
          <CardContent>
            {s.by_category.length ? <RankBars lang={lang} data={s.by_category.slice(0, 7).map((c) => ({ label: c.name, value: c.total, accent: c.is_advertising }))} />
              : <p className="py-10 text-center text-sm text-muted-foreground">{t.noExpenses}</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="grid gap-3 xl:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">{t.recentTransactions}</h2>
            <Button asChild variant="ghost" size="sm"><Link href={`/b/${id}/transactions`}>{t.viewAll} <ArrowRight /></Link></Button>
          </div>
          <LedgerTable rows={recent} t={t} lang={lang} variant="recent" businessId={id} canWrite={false}
            accounts={p.accountNames} partners={p.partnerNames} emptyText={t.noTransactions} />
        </div>
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div><CardTitle>{t.partnerCapital}</CardTitle><CardDescription className="tabular">{t.total}: {fmtMoney(capitalTotal, lang)}</CardDescription></div>
            <Button asChild variant="ghost" size="icon-sm" aria-label={t.capital}><Link href={`/b/${id}/capital`}><ArrowRight /></Link></Button>
          </CardHeader>
          <CardContent className="grid gap-4">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3">
                <Avatar name={m.name} seed={m.email} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{t.profitShare}: {m.percentage === null ? t.noSplit : `${fmtNum(m.percentage, lang)}%`}</p>
                </div>
                <p className="tabular text-sm font-semibold">{fmtMoney(m.capital, lang)}</p>
              </div>
            ))}
            {members.length <= 1 && p.writable && (
              <Button asChild variant="outline" size="sm"><Link href={`/b/${id}/partners`}><Users /> {t.setupInvite}</Link></Button>
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
