import { Page } from "@/components/shell/Page";
import { DateRange } from "@/components/data/DateRange";
import { LedgerTable } from "@/components/data/LedgerTable";
import { loadBizPage } from "@/lib/bizpage";
import { getTransactions } from "@/lib/workspace";

export const metadata = { title: "Transactions" };

export default async function TransactionsPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const p = await loadBizPage(id, await searchParams);
  const rows = await getTransactions(id, p.range);
  return (
    <Page wide title={p.t.transactions} description={p.t.reverseDesc} actions={<DateRange t={p.t} current={p.range.key} from={p.range.from} to={p.range.to} />}>
      <LedgerTable rows={rows} t={p.t} lang={p.lang} variant="all" businessId={id} canWrite={p.writable} exportName={`ledger-${p.range.from}-${p.range.to}`}
        accounts={p.accountNames} partners={p.partnerNames} emptyText={p.t.noTransactions} />
    </Page>
  );
}
