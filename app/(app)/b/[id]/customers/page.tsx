import { Repeat, Users, UserX, Wallet } from "lucide-react";
import { Page } from "@/components/shell/Page";
import { Kpi } from "@/components/data/Kpi";
import { CustomersTable, type CustomerRow } from "@/components/data/CustomersTable";
import { loadBizPage } from "@/lib/bizpage";
import { getOrders } from "@/lib/sales";
import { fmtMoney, fmtNum } from "@/lib/i18n";

export const metadata = { title: "Customers" };

/** Bangladeshi numbers: keep the last 11 digits (01XXXXXXXXX), so +880 / 880 / spaces don't split one customer. */
const phoneKey = (p: string | null) => {
  const d = (p ?? "").replace(/[০-৯]/g, (c) => String(c.charCodeAt(0) - 0x09e6)).replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : "";
};

export default async function CustomersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await loadBizPage(id, { range: "all" });
  const { t, lang } = p;
  const orders = await getOrders(id, p.range);
  const map = new Map<string, CustomerRow>();
  for (const o of [...orders].sort((a, b) => a.order_date.localeCompare(b.order_date))) {
    const key = phoneKey(o.customer_phone) || (o.customer_name ?? "").trim().toLowerCase();
    if (!key) continue;
    const c = map.get(key) ?? { key, name: "", phone: null, address: null, orders: 0, delivered: 0, returned: 0, cancelled: 0, spent: 0, profit: 0, first: o.order_date, last: o.order_date, lastOrderId: o.id };
    c.orders++;
    if (o.customer_name) c.name = o.customer_name;
    if (o.customer_phone) c.phone = o.customer_phone;
    if (o.customer_address) c.address = o.customer_address;
    if (o.status === "delivered") { c.delivered++; c.spent += o.net_sales; c.profit += o.profit; }
    if (o.status === "returned") c.returned++;
    if (o.status === "cancelled") c.cancelled++;
    c.last = o.order_date; c.lastOrderId = o.id;
    map.set(key, c);
  }
  const rows = [...map.values()];
  const repeat = rows.filter((r) => r.delivered >= 2).length;
  const buyers = rows.filter((r) => r.delivered >= 1).length;
  const returners = rows.filter((r) => r.returned > 0).length;
  const avg = buyers ? rows.reduce((s, r) => s + r.spent, 0) / buyers : 0;
  return (
    <Page wide title={t.customers} description={t.customersDesc}>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label={t.customers} value={fmtNum(rows.length, lang)} icon={<Users />} hint={`${fmtNum(buyers, lang)} ${t.buyers}`} />
        <Kpi label={t.repeatCustomers} value={fmtNum(repeat, lang)} icon={<Repeat />} hint={buyers ? `${fmtNum((repeat / buyers) * 100, lang, 0)}% ${t.ofBuyers}` : undefined} />
        <Kpi label={t.avgPerCustomer} value={fmtMoney(avg, lang)} icon={<Wallet />} />
        <Kpi label={t.customersWithReturns} value={fmtNum(returners, lang)} icon={<UserX />} tone={returners ? "negative" : undefined} />
      </div>
      <CustomersTable rows={rows} t={t} lang={lang} businessId={id} />
    </Page>
  );
}
