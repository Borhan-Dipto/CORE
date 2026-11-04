import { ShoppingBag } from "lucide-react";
import { Page, Notice, EmptyState } from "@/components/shell/Page";
import { Kpi } from "@/components/data/Kpi";
import { DateRange } from "@/components/data/DateRange";
import { OrdersTable } from "@/components/data/OrdersTable";
import { OrderDialog, ImportDialog } from "@/components/forms/sales";
import { loadBizPage } from "@/lib/bizpage";
import { getOrders, getOrderSummary, getProducts } from "@/lib/sales";
import { getCampaignNames } from "@/lib/campaigns";
import { fmtMoney, fmtNum } from "@/lib/i18n";

export const metadata = { title: "Orders" };

export default async function OrdersPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { id } = await params;
  const p = await loadBizPage(id, await searchParams);
  const { t, lang, range } = p;
  const [orders, s, products, campaigns] = await Promise.all([getOrders(id, range), getOrderSummary(id, range.from, range.to), getProducts(id), getCampaignNames(id)]);
  const newOrder = p.writable ? <OrderDialog t={t} lang={lang} businessId={id} products={products} campaigns={campaigns} /> : null;
  const returnRate = s.delivered_count + s.returned_count ? Math.round((s.returned_count / (s.delivered_count + s.returned_count)) * 100) : 0;
  return (
    <Page wide title={t.orders}
      actions={<><DateRange t={t} current={range.key} from={range.from} to={range.to} />{p.writable && <ImportDialog t={t} businessId={id} />}{newOrder}</>}>
      {!p.writable && <Notice tone="info">{t.readOnlyOrders}</Notice>}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label={t.kpiOrders} value={fmtNum(s.orders_placed, lang)} hint={`${t.returnRate}: ${fmtNum(returnRate, lang)}%`} />
        <Kpi label={t.kpiRevenue} value={fmtMoney(s.revenue, lang)} definition={t.kpiRevenueDef} hint={`${fmtNum(s.delivered_count, lang)} ${t.orderStatuses.delivered}`} />
        <Kpi label={t.kpiPipeline} value={fmtMoney(s.pipeline_value, lang)} definition={t.kpiPipelineDef} hint={`${fmtNum(s.pipeline_count, lang)} ${t.orders}`} />
        <Kpi label={t.kpiUncollected} value={fmtMoney(s.uncollected, lang)} definition={t.kpiUncollectedDef} hint={`${fmtNum(s.uncollected_count, lang)} ${t.orders}`}
          tone={s.uncollected > 0 ? "negative" : undefined} />
      </div>
      <OrdersTable rows={orders} t={t} lang={lang} businessId={id}
        empty={<div className="p-6"><EmptyState icon={ShoppingBag} title={t.noOrders} description={products.length ? undefined : t.noProducts} action={newOrder} /></div>} />
    </Page>
  );
}
