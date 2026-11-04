import { Page, Notice } from "@/components/shell/Page";
import { Kpi } from "@/components/data/Kpi";
import { LedgerTable } from "@/components/data/LedgerTable";
import { InvestmentDialog, WithdrawalDialog } from "@/components/forms/finance";
import { Card } from "@/components/ui/card";
import { DocumentMenu } from "@/components/documents";
import { Avatar } from "@/components/ui/avatar";
import { loadBizPage } from "@/lib/bizpage";
import { getTransactions } from "@/lib/workspace";
import { fmtMoney, fmtNum } from "@/lib/i18n";

export const metadata = { title: "Capital" };

export default async function CapitalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await loadBizPage(id, { range: "all" });
  const { t, lang, members } = p;
  const rows = await getTransactions(id, p.range, { types: ["investment", "withdrawal", "profit_share"] });
  const total = { invested: 0, withdrawn: 0, capital: 0 };
  members.forEach((m) => { total.invested += m.invested; total.withdrawn += m.withdrawn; total.capital += m.capital; });
  return (
    <Page wide title={t.capital} actions={p.writable && <><WithdrawalDialog t={t} businessId={id} opts={p.opts} /><InvestmentDialog t={t} businessId={id} opts={p.opts} /></>}>
      {!p.writable && <Notice tone="info">{t.readOnlyNote}</Notice>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi label={t.invested} value={fmtMoney(total.invested, lang)} definition={t.kpiInvestmentsDef} />
        <Kpi label={t.withdrawn} value={fmtMoney(total.withdrawn, lang)} />
        <Kpi label={t.kpiCapital} value={fmtMoney(total.capital, lang)} definition={t.kpiCapitalDef} tone={total.capital < 0 ? "negative" : undefined} />
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {members.map((m) => {
          const pct = total.capital > 0 ? Math.max(0, (m.capital / total.capital) * 100) : 0;
          return (
            <Card key={m.id} className="p-5">
              <div className="flex items-center gap-3">
                <Avatar name={m.name} seed={m.email} size="lg" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{t.profitShare}: {m.percentage === null ? t.noSplit : `${fmtNum(m.percentage, lang)}%`}</p>
                </div>
                <DocumentMenu t={t} href={`/doc/statement/${id}?partner=${m.user_id}`} label={t.capitalStatement} variant="ghost" iconOnly />
              </div>
              <p className="tabular mt-4 text-2xl font-semibold tracking-tight">{fmtMoney(m.capital, lang)}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-chart-1" style={{ width: `${pct}%` }} /></div>
              <p className="mt-1 text-xs text-muted-foreground">{fmtNum(Math.round(pct), lang)}% {t.of} {t.kpiCapital.toLowerCase()}</p>
              <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs">
                {[[t.invested, m.invested], [t.profitCredited, m.profitCredited], [t.withdrawn, m.withdrawn]].map(([l, v]) => (
                  <div key={String(l)} className="min-w-0"><dt className="truncate text-muted-foreground">{l}</dt><dd className="tabular truncate font-medium">{fmtMoney(Number(v), lang, { compact: true })}</dd></div>
                ))}
              </dl>
            </Card>
          );
        })}
      </div>
      <div className="grid gap-3">
        <h2 className="text-[15px] font-semibold">{t.capitalHistory}</h2>
        <LedgerTable rows={rows} t={t} lang={lang} variant="capital" businessId={id} canWrite={p.writable} exportName="capital"
          accounts={p.accountNames} partners={p.partnerNames} emptyText={t.noCapital}
          emptyAction={p.writable ? <InvestmentDialog t={t} businessId={id} opts={p.opts} variant="outline" /> : undefined} />
      </div>
    </Page>
  );
}
