import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone, MapPin, Truck } from "lucide-react";
import { Page } from "@/components/shell/Page";
import { CollectDialog, OrderInfoForm, OrderStatusActions } from "@/components/forms/sales";
import { STATUS_TONE } from "@/components/data/OrdersTable";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { loadBizPage } from "@/lib/bizpage";
import { getOrder } from "@/lib/sales";
import { fmtDate, fmtMoney, fmtNum } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { DocumentMenu } from "@/components/documents";
import { invoiceNo } from "@/lib/documents/numbers";

export const metadata = { title: "Order" };

export default async function OrderPage({ params }: { params: Promise<{ id: string; orderId: string }> }) {
  const { id, orderId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) notFound();
  const [p, res] = await Promise.all([loadBizPage(id), getOrder(id, orderId)]);
  if (!res) notFound();
  const { order: o, history } = res;
  const { t, lang } = p;
  const suggested = o.net_sales - o.courier_cost - o.cod_fee;
  const rows: [string, number, string?][] = [
    [t.subtotal, o.net_sales - o.delivery_charge + o.discount],
    ...(o.discount ? [[t.discount, -o.discount] as [string, number]] : []),
    ...(o.delivery_charge ? [[t.deliveryCharge, o.delivery_charge] as [string, number]] : []),
  ];
  return (
    <Page title={`${t.orderNo} ${o.order_no}`} description={`${fmtDate(o.order_date, lang)} · ${t.orderSources[o.source]}`}
      actions={<><Button asChild variant="ghost" size="sm"><Link href={`/b/${id}/orders`}><ArrowLeft /> {t.orders}</Link></Button>
        <DocumentMenu t={t} href={`/doc/invoice/${o.id}`} label={`${t.invoice} · ${invoiceNo(o.order_no)}`} variant="default" /></>}>
      <Card className="flex flex-wrap items-center gap-3 p-4">
        <Badge variant={STATUS_TONE[o.status]} className="text-sm">{t.orderStatuses[o.status]}</Badge>
        {o.status === "delivered" && <Badge variant={o.collected ? "success" : "warning"}>{o.collected ? `${t.collected} · ${fmtMoney(o.collected_amount, lang)}` : t.notCollected}</Badge>}
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {p.writable && <OrderStatusActions t={t} orderId={o.id} businessId={id} status={o.status} collected={o.collected} />}
          {p.writable && o.status === "delivered" && !o.collected && <CollectDialog t={t} lang={lang} businessId={id} orderId={o.id} suggested={suggested} accounts={p.opts.accounts} />}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="grid h-fit gap-6">
          <Card>
            <CardHeader><CardTitle>{t.items}</CardTitle></CardHeader>
            <CardContent className="grid gap-0 p-0 pt-3">
              {o.items.map((i) => (
                <div key={i.id} className="flex items-center gap-3 border-t border-border px-5 py-3 text-sm">
                  <div className="min-w-0 flex-1"><p className="truncate font-medium">{i.product_name}</p>
                    <p className="tabular text-xs text-muted-foreground">{fmtNum(i.qty, lang)} × {fmtMoney(i.unit_price, lang)} · {t.unitCost} {fmtMoney(i.unit_cost, lang)}</p></div>
                  <span className="tabular font-medium">{fmtMoney(i.qty * i.unit_price, lang)}</span>
                </div>
              ))}
              <div className="grid gap-1.5 border-t border-border bg-muted/40 px-5 py-4 text-sm">
                {rows.map(([l, v]) => <div key={l} className="flex justify-between"><span className="text-muted-foreground">{l}</span><span className="tabular">{fmtMoney(v, lang)}</span></div>)}
                <div className="flex justify-between text-base font-semibold"><span>{t.orderTotal}</span><span className="tabular">{fmtMoney(o.net_sales, lang)}</span></div>
                <div className="mt-2 grid gap-1 border-t border-border pt-2 text-[13px]">
                  <div className="flex justify-between text-muted-foreground"><span>{t.cogs}</span><span className="tabular">−{fmtMoney(o.cogs, lang)}</span></div>
                  <div className="flex justify-between text-muted-foreground"><span>{t.directCosts}</span><span className="tabular">−{fmtMoney(o.direct_costs, lang)}</span></div>
                  <div className="flex justify-between font-medium"><span>{t.orderProfit}</span>
                    <span className={cn("tabular", o.profit >= 0 ? "text-success" : "text-destructive")}>{fmtMoney(o.profit, lang, { sign: true })}</span></div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t.details}</CardTitle></CardHeader>
            <CardContent><OrderInfoForm t={t} businessId={id} order={o} disabled={!p.writable || o.collected} /></CardContent>
          </Card>
        </div>
        <div className="grid h-fit gap-6">
          <Card>
            <CardHeader><CardTitle>{t.customer}</CardTitle></CardHeader>
            <CardContent className="grid gap-2 text-sm">
              <p className="font-medium">{o.customer_name || "—"}</p>
              {o.customer_phone && <a href={`tel:${o.customer_phone}`} className="flex items-center gap-2 text-brand hover:underline"><Phone className="size-4" /> {o.customer_phone}</a>}
              {o.customer_address && <p className="flex gap-2 text-muted-foreground"><MapPin className="mt-0.5 size-4 shrink-0" /> {o.customer_address}</p>}
              {(o.courier || o.tracking_no) && <p className="flex items-center gap-2 text-muted-foreground"><Truck className="size-4" /> {[o.courier, o.tracking_no].filter(Boolean).join(" · ")}</p>}
              {o.campaign_name && <p className="text-xs text-muted-foreground">{t.attribution}: <span className="text-foreground">{o.campaign_name}</span></p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t.history}</CardTitle></CardHeader>
            <CardContent>
              <ol className="relative grid gap-4 border-l border-border pl-4">
                {history.map((h) => (
                  <li key={h.id} className="text-sm">
                    <span className="absolute -left-[5px] mt-1.5 size-2.5 rounded-full border-2 border-card bg-brand" aria-hidden />
                    <p className="font-medium">{t.orderStatuses[h.to_status]}</p>
                    <p className="text-xs text-muted-foreground">{fmtDate(h.changed_at, lang, true)}{h.note && h.note !== "created" ? ` · ${h.note}` : ""}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </Page>
  );
}
