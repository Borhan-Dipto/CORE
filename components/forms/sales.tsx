"use client";

import * as React from "react";
import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronDown, Download, FileUp, PackagePlus, Pencil, Plus, Trash2, Truck, Wallet } from "lucide-react";
import * as A from "@/app/actions";
import type { FormState, ImportResult, ImportRow } from "@/app/actions";
import { Button, type ButtonProps } from "@/components/ui/button";
import { ConfirmDialog, Dialog, DialogContent, DialogTrigger } from "@/components/ui/overlay";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { fmtMoney, type Dict, type Lang } from "@/lib/i18n";
import { cn, parseAmount } from "@/lib/utils";

const init: FormState = {};
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
const n = (v: string) => parseAmount(v);

function ErrorText({ msg }: { msg?: string }) {
  return msg ? <p role="alert" className="rounded-md border border-destructive/25 bg-destructive-soft px-3 py-2 text-[13px] text-destructive">{msg}</p> : null;
}
function MoneyInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <Input inputMode="decimal" pattern="[0-9০-৯.,]*" className="tabular" placeholder="0" {...props} />;
}

export type ProductOpt = { id: string; name: string; cost_price: number; sell_price: number; is_active: boolean };
type Acc = { id: string; name: string; type: string; is_active: boolean };

// ---------- Products ----------
export function ProductDialog({ t, lang, businessId, product, trigger }: {
  t: Dict; lang: Lang; businessId: string; product?: ProductOpt & { sku: string | null; category: string | null }; trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [key, setKey] = React.useState(0);
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setKey((k) => k + 1); }}>
      <DialogTrigger asChild>{trigger ?? <Button><PackagePlus /> {t.addProduct}</Button>}</DialogTrigger>
      <DialogContent title={product ? product.name : t.addProduct} description={t.productHint}>
        <ProductForm key={key} t={t} lang={lang} businessId={businessId} product={product} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ProductForm({ t, lang, businessId, product, onDone }: { t: Dict; lang: Lang; businessId: string; product?: ProductOpt & { sku: string | null; category: string | null }; onDone: () => void }) {
  const [state, run, pending] = useActionState(product ? A.updateProduct : A.addProduct, init);
  const [cost, setCost] = React.useState(String(product?.cost_price ?? ""));
  const [sell, setSell] = React.useState(String(product?.sell_price ?? ""));
  React.useEffect(() => { if (state.ok) { toast.success(state.ok); onDone(); } }, [state.at]); // eslint-disable-line react-hooks/exhaustive-deps
  const m = n(sell) > 0 ? Math.round(((n(sell) - n(cost)) / n(sell)) * 100) : null;
  return (
    <form action={run} className="grid gap-4">
      <input type="hidden" name="business_id" value={businessId} />
      {product && <input type="hidden" name="id" value={product.id} />}
      <Field label={t.productName} htmlFor="p-name"><Input id="p-name" name="name" required maxLength={160} defaultValue={product?.name} autoFocus /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={`${t.costPrice} (৳)`} htmlFor="p-cost"><MoneyInput id="p-cost" name="cost_price" value={cost} onChange={(e) => setCost(e.target.value)} required /></Field>
        <Field label={`${t.sellPrice} (৳)`} htmlFor="p-sell"><MoneyInput id="p-sell" name="sell_price" value={sell} onChange={(e) => setSell(e.target.value)} required /></Field>
      </div>
      {m !== null && <p className={cn("text-[13px]", m >= 0 ? "text-success" : "text-destructive")}>{t.margin}: {m}% · {t.profitLabel} {fmtMoney(n(sell) - n(cost), lang)}</p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t.sku} htmlFor="p-sku" optional={t.optional}><Input id="p-sku" name="sku" maxLength={60} defaultValue={product?.sku ?? ""} /></Field>
        <Field label={t.category} htmlFor="p-cat" optional={t.optional}><Input id="p-cat" name="category" maxLength={60} defaultValue={product?.category ?? ""} placeholder="iPhone Case" /></Field>
      </div>
      <ErrorText msg={state.error} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onDone}>{t.cancel}</Button>
        <Button type="submit" loading={pending}>{product ? t.save : t.addProduct}</Button>
      </div>
    </form>
  );
}

export function ProductEditButton(props: { t: Dict; lang: Lang; businessId: string; product: ProductOpt & { sku: string | null; category: string | null } }) {
  return <ProductDialog {...props} trigger={<Button variant="ghost" size="icon-sm" aria-label={props.t.edit}><Pencil /></Button>} />;
}

// ---------- New order ----------
type Line = { key: number; product_id: string; product_name: string; qty: string; unit_price: string; unit_cost: string };

export function OrderDialog({ t, lang, businessId, products, campaigns, variant = "default" }: {
  t: Dict; lang: Lang; businessId: string; products: ProductOpt[]; campaigns: string[]; variant?: ButtonProps["variant"];
}) {
  const [open, setOpen] = React.useState(false);
  const [key, setKey] = React.useState(0);
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setKey((k) => k + 1); }}>
      <DialogTrigger asChild><Button variant={variant}><Plus /> {t.newOrder}</Button></DialogTrigger>
      <DialogContent title={t.newOrder} className="sm:max-w-2xl">
        <OrderForm key={key} t={t} lang={lang} businessId={businessId} products={products} campaigns={campaigns} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function OrderForm({ t, lang, businessId, products, campaigns, onDone }: {
  t: Dict; lang: Lang; businessId: string; products: ProductOpt[]; campaigns: string[]; onDone: () => void;
}) {
  const router = useRouter();
  const [state, run, pending] = useActionState(A.createOrder, init);
  const active = products.filter((p) => p.is_active);
  const blank = (k: number): Line => ({ key: k, product_id: "", product_name: "", qty: "1", unit_price: "", unit_cost: "" });
  const [lines, setLines] = React.useState<Line[]>([blank(1)]);
  const [money, setMoney] = React.useState({ discount: "", delivery_charge: "", courier_cost: "", packaging_cost: "", cod_fee: "", other_cost: "" });
  const [showCosts, setShowCosts] = React.useState(false);
  React.useEffect(() => {
    if (state.ok) { toast.success(state.ok); onDone(); if (state.link) router.push(state.link); }
  }, [state.at]); // eslint-disable-line react-hooks/exhaustive-deps

  const setLine = (k: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === k ? { ...l, ...patch } : l)));
  const pick = (k: number, id: string) => {
    const p = active.find((x) => x.id === id);
    setLine(k, p ? { product_id: p.id, product_name: p.name, unit_price: String(p.sell_price) } : { product_id: "" });
  };
  const items = lines.filter((l) => l.product_id || l.product_name.trim());
  const sub = items.reduce((s, l) => s + n(l.qty) * n(l.unit_price), 0);
  const catalogCost = (l: Line) => active.find((x) => x.id === l.product_id)?.cost_price ?? 0;
  const lineCost = (l: Line) => (l.unit_cost.trim() === "" ? catalogCost(l) : n(l.unit_cost));
  const cogs = items.reduce((s, l) => s + n(l.qty) * lineCost(l), 0);
  const total = sub - n(money.discount) + n(money.delivery_charge);
  const direct = n(money.courier_cost) + n(money.packaging_cost) + n(money.cod_fee) + n(money.other_cost);
  const profit = total - cogs - direct;
  const payload = JSON.stringify(items.map((l) => ({ product_id: l.product_id || undefined, product_name: l.product_name, qty: Math.max(1, Math.round(n(l.qty))), unit_price: n(l.unit_price), unit_cost: l.unit_cost.trim() === "" ? undefined : n(l.unit_cost) })));

  return (
    <form action={run} className="grid gap-5">
      <input type="hidden" name="business_id" value={businessId} />
      <input type="hidden" name="items" value={payload} />
      {Object.entries(money).map(([k, v]) => <input key={k} type="hidden" name={k} value={n(v)} />)}

      <section className="grid gap-2">
        <p className="text-[13px] font-medium">{t.items}</p>
        <div className="hidden grid-cols-[1fr_64px_96px_96px_32px] gap-2 px-0.5 text-xs text-muted-foreground sm:grid">
          <span>{t.product}</span><span className="text-center">{t.qty}</span><span>{t.sellPrice}</span><span>{t.unitCost}</span><span />
        </div>
        {lines.map((l) => (
          <div key={l.key} className="grid grid-cols-[56px_1fr_1fr_auto] items-center gap-2 rounded-lg border border-border p-2.5 sm:grid-cols-[1fr_64px_96px_96px_32px] sm:border-0 sm:p-0">
            <div className="col-span-4 sm:col-span-1">
              {active.length > 0 ? (
                <Select value={l.product_id} onValueChange={(v) => pick(l.key, v)} placeholder={t.product}
                  options={active.map((p) => ({ value: p.id, label: p.name, hint: `${fmtMoney(p.sell_price, lang)} · ${t.unitCost} ${fmtMoney(p.cost_price, lang)}` }))} />
              ) : (
                <Input value={l.product_name} onChange={(e) => setLine(l.key, { product_name: e.target.value })} placeholder={t.productName} aria-label={t.productName} />
              )}
            </div>
            <Input value={l.qty} onChange={(e) => setLine(l.key, { qty: e.target.value })} inputMode="numeric" aria-label={t.qty} className="tabular text-center" />
            <MoneyInput value={l.unit_price} onChange={(e) => setLine(l.key, { unit_price: e.target.value })} aria-label={t.sellPrice} placeholder={t.sellPrice} />
            <MoneyInput value={l.unit_cost} onChange={(e) => setLine(l.key, { unit_cost: e.target.value })} aria-label={t.unitCost}
              placeholder={catalogCost(l) ? String(catalogCost(l)) : t.unitCost} title={t.unitCostHint} />
            <Button type="button" variant="ghost" size="icon-sm" aria-label={t.removeItem} disabled={lines.length === 1}
              onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}><Trash2 /></Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => setLines((ls) => [...ls, blank(Date.now())])}><Plus /> {t.addItem}</Button>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Field label={t.customerName} htmlFor="o-cn" optional={t.optional}><Input id="o-cn" name="customer_name" maxLength={120} /></Field>
        <Field label={t.customerPhone} htmlFor="o-cp" optional={t.optional}><Input id="o-cp" name="customer_phone" type="tel" maxLength={30} placeholder="01XXXXXXXXX" /></Field>
        <Field label={t.customerAddress} htmlFor="o-ca" optional={t.optional} className="sm:col-span-2"><Textarea id="o-ca" name="customer_address" maxLength={400} className="min-h-14" /></Field>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label={t.date} htmlFor="o-d"><Input id="o-d" name="order_date" type="date" defaultValue={today()} max={today()} required /></Field>
        <Field label={t.status} htmlFor="o-s"><Select id="o-s" name="status" defaultValue="pending" options={Object.entries(t.orderStatuses).map(([v, l]) => ({ value: v, label: l }))} /></Field>
        <Field label={t.source} htmlFor="o-src" className="col-span-2 sm:col-span-1"><Select id="o-src" name="source" defaultValue="website" options={Object.entries(t.orderSources).map(([v, l]) => ({ value: v, label: l }))} /></Field>
        <Field label={t.attribution} htmlFor="o-camp" optional={t.optional} className="col-span-2 sm:col-span-3">
          <Input id="o-camp" name="campaign_name" list="o-camp-list" maxLength={120} placeholder={t.campaignPh} />
          <datalist id="o-camp-list">{campaigns.map((c) => <option key={c} value={c} />)}</datalist>
        </Field>
        <Field label={t.courier} htmlFor="o-cr" optional={t.optional}><Input id="o-cr" name="courier" list="o-cr-list" maxLength={60} placeholder="Steadfast" />
          <datalist id="o-cr-list">{["Steadfast", "Pathao", "RedX", "Paperfly", "Sundarban"].map((c) => <option key={c} value={c} />)}</datalist></Field>
        <Field label={t.trackingNo} htmlFor="o-tr" optional={t.optional} className="sm:col-span-2"><Input id="o-tr" name="tracking_no" maxLength={80} /></Field>
      </section>

      <section className="rounded-lg border border-border">
        <button type="button" onClick={() => setShowCosts((s) => !s)} className="flex w-full items-center justify-between px-3 py-2.5 text-[13px] font-medium" aria-expanded={showCosts}>
          {t.orderCosts} <ChevronDown className={cn("size-4 transition", showCosts && "rotate-180")} />
        </button>
        {showCosts && (
          <div className="grid gap-3 border-t border-border p-3">
            <p className="text-xs text-muted-foreground">{t.orderCostsHint}</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {([["delivery_charge", t.deliveryCharge], ["discount", t.discount], ["courier_cost", t.courierCost], ["packaging_cost", t.packagingCost], ["cod_fee", t.codFee], ["other_cost", t.otherCost]] as const).map(([k, l]) => (
                <Field key={k} label={l} htmlFor={`o-${k}`}><MoneyInput id={`o-${k}`} value={money[k]} onChange={(e) => setMoney((m) => ({ ...m, [k]: e.target.value }))} /></Field>
              ))}
            </div>
          </div>
        )}
      </section>

      <div className="grid gap-1.5 rounded-lg bg-muted/60 p-3 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">{t.subtotal}</span><span className="tabular">{fmtMoney(sub, lang)}</span></div>
        <div className="flex justify-between font-semibold"><span>{t.orderTotal}</span><span className="tabular">{fmtMoney(total, lang)}</span></div>
        <div className="flex justify-between text-[13px]"><span className="text-muted-foreground">{t.orderProfit}</span>
          <span className={cn("tabular font-medium", profit >= 0 ? "text-success" : "text-destructive")}>{fmtMoney(profit, lang, { sign: true })}</span></div>
      </div>
      <ErrorText msg={state.error} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={onDone}>{t.cancel}</Button>
        <Button type="submit" loading={pending} disabled={!items.length}>{t.newOrder}</Button>
      </div>
    </form>
  );
}

// ---------- Order detail actions ----------
const NEXT: Record<string, string[]> = {
  pending: ["confirmed", "shipped", "delivered", "cancelled"], confirmed: ["shipped", "delivered", "cancelled"],
  shipped: ["delivered", "returned"], delivered: ["returned"], returned: [], cancelled: [],
};

export function OrderStatusActions({ t, orderId, businessId, status, collected }: { t: Dict; orderId: string; businessId: string; status: string; collected: boolean }) {
  const [pending, start] = useTransition();
  const go = (s: string) => start(async () => { const r = await A.setOrderStatus(orderId, businessId, s); if (r.error) toast.error(r.error); else toast.success(r.ok); });
  const options = (NEXT[status] ?? []).filter((s) => !(collected && s === "returned"));
  if (!options.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((s) => s === "returned" || s === "cancelled" ? (
        <ConfirmDialog key={s} title={`${t.markAs}: ${t.orderStatuses[s]}?`} confirmLabel={t.orderStatuses[s]} cancelLabel={t.cancel} destructive onConfirm={() => go(s)}
          trigger={<Button variant="destructive-outline" size="sm" disabled={pending}>{t.orderStatuses[s]}</Button>} />
      ) : (
        <Button key={s} size="sm" variant={s === "delivered" ? "default" : "outline"} loading={pending} onClick={() => go(s)}>
          {s === "delivered" ? <Check /> : s === "shipped" ? <Truck /> : null} {t.orderStatuses[s]}
        </Button>
      ))}
    </div>
  );
}

export function CollectDialog({ t, lang, businessId, orderId, suggested, accounts }: {
  t: Dict; lang: Lang; businessId: string; orderId: string; suggested: number; accounts: Acc[];
}) {
  const [open, setOpen] = React.useState(false);
  const [state, run, pending] = useActionState(A.collectOrder, init);
  React.useEffect(() => { if (state.ok) { toast.success(state.ok); setOpen(false); } }, [state.at]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="brand"><Wallet /> {t.collect}</Button></DialogTrigger>
      <DialogContent title={t.collectTitle} description={t.collectDesc}>
        <form action={run} className="grid gap-4">
          <input type="hidden" name="business_id" value={businessId} /><input type="hidden" name="order_id" value={orderId} />
          <div className="grid grid-cols-2 gap-3">
            <Field label={`${t.amountReceived} (৳)`} htmlFor="c-amt"><MoneyInput id="c-amt" name="amount" defaultValue={String(Math.max(0, suggested))} required className="tabular text-base font-medium" /></Field>
            <Field label={t.date} htmlFor="c-d"><Input id="c-d" name="date" type="date" defaultValue={today()} max={today()} /></Field>
          </div>
          <Field label={t.receivedInto} htmlFor="c-acc">
            <Select id="c-acc" name="account_id" required defaultValue={accounts.find((a) => a.is_active)?.id}
              options={accounts.filter((a) => a.is_active).map((a) => ({ value: a.id, label: a.name, hint: t.accountTypes[a.type] }))} />
          </Field>
          <p className="text-xs text-muted-foreground">{fmtMoney(suggested, lang)} = {t.orderTotal} − {t.courierCost} − {t.codFee}</p>
          <ErrorText msg={state.error} />
          <Button type="submit" loading={pending}>{t.collect}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function OrderInfoForm({ t, businessId, order, disabled }: {
  t: Dict; businessId: string; disabled?: boolean;
  order: { id: string; customer_name: string | null; customer_phone: string | null; customer_address: string | null; courier: string | null; tracking_no: string | null;
    campaign_name: string | null; notes: string | null; delivery_charge: number; discount: number; courier_cost: number; packaging_cost: number; cod_fee: number; other_cost: number };
}) {
  const [state, run, pending] = useActionState(A.updateOrderInfo, init);
  React.useEffect(() => { if (state.ok) toast.success(state.ok); }, [state.at]);
  return (
    <form action={run} className="grid gap-4">
      <input type="hidden" name="business_id" value={businessId} /><input type="hidden" name="order_id" value={order.id} />
      <fieldset disabled={disabled} className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t.customerName} htmlFor="e-cn"><Input id="e-cn" name="customer_name" defaultValue={order.customer_name ?? ""} /></Field>
          <Field label={t.customerPhone} htmlFor="e-cp"><Input id="e-cp" name="customer_phone" defaultValue={order.customer_phone ?? ""} /></Field>
          <Field label={t.customerAddress} htmlFor="e-ca" className="sm:col-span-2"><Textarea id="e-ca" name="customer_address" defaultValue={order.customer_address ?? ""} className="min-h-14" /></Field>
          <Field label={t.courier} htmlFor="e-cr"><Input id="e-cr" name="courier" defaultValue={order.courier ?? ""} /></Field>
          <Field label={t.trackingNo} htmlFor="e-tr"><Input id="e-tr" name="tracking_no" defaultValue={order.tracking_no ?? ""} /></Field>
          <Field label={t.attribution} htmlFor="e-camp" className="sm:col-span-2"><Input id="e-camp" name="campaign_name" defaultValue={order.campaign_name ?? ""} /></Field>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {([["delivery_charge", t.deliveryCharge], ["discount", t.discount], ["courier_cost", t.courierCost], ["packaging_cost", t.packagingCost], ["cod_fee", t.codFee], ["other_cost", t.otherCost]] as const).map(([k, l]) => (
            <Field key={k} label={l} htmlFor={`e-${k}`}><MoneyInput id={`e-${k}`} name={k} defaultValue={String(order[k])} /></Field>
          ))}
        </div>
        <Field label={t.note} htmlFor="e-n" optional={t.optional}><Textarea id="e-n" name="notes" defaultValue={order.notes ?? ""} className="min-h-14" /></Field>
        <ErrorText msg={state.error} />
        {!disabled && <div><Button type="submit" loading={pending}>{t.save}</Button></div>}
      </fieldset>
    </form>
  );
}

// ---------- CSV import ----------
const TEMPLATE = "order_id,date,customer_name,phone,address,product,qty,unit_price,delivery_charge,discount,courier,tracking_no,courier_cost,status,source,campaign\n" +
  "WEB-1001,2026-11-01,Rahim Uddin,01711000000,\"House 1, Road 2, Dhaka\",MagSafe Carbon Case,1,1250,60,0,Steadfast,SF123456,70,delivered,website,MagSafe Nov\n";

const ALIASES: Record<string, string[]> = {
  external_ref: ["order_id", "order id", "order no", "order number", "order", "id", "invoice"],
  order_date: ["date", "order date", "created", "created at", "order_date"],
  customer_name: ["customer_name", "customer", "name", "customer name", "billing name"],
  customer_phone: ["phone", "mobile", "customer phone", "phone number", "contact"],
  customer_address: ["address", "shipping address", "customer address", "delivery address"],
  product_name: ["product", "product name", "item", "item name", "product_name"],
  qty: ["qty", "quantity", "qnty"],
  unit_price: ["unit_price", "price", "unit price", "rate", "selling price"],
  delivery_charge: ["delivery_charge", "delivery charge", "shipping", "shipping charge", "delivery fee"],
  discount: ["discount"],
  courier: ["courier", "courier name", "shipping method"],
  tracking_no: ["tracking_no", "tracking", "tracking number", "consignment id", "consignment"],
  courier_cost: ["courier_cost", "courier cost", "courier charge"],
  status: ["status", "order status"],
  source: ["source", "channel"],
  campaign_name: ["campaign", "campaign_name", "campaign name"],
};
const STATUS_MAP: Record<string, string> = { pending: "pending", processing: "confirmed", confirmed: "confirmed", "on-hold": "pending", shipped: "shipped", "in transit": "shipped",
  delivered: "delivered", completed: "delivered", complete: "delivered", returned: "returned", return: "returned", cancelled: "cancelled", canceled: "cancelled", refunded: "returned" };

function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim()));
}
function toIsoDate(v: string) {
  const s = v.trim(); if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/); // dd/mm/yyyy (Bangladesh)
  if (m) { const y = m[3].length === 2 ? "20" + m[3] : m[3]; return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
  const d = new Date(s); return isNaN(+d) ? "" : d.toISOString().slice(0, 10);
}

function buildRows(text: string): { rows: ImportRow[]; errors: { line: number; error: string }[] } {
  const grid = parseCsv(text.replace(/^﻿/, ""));
  const head = (grid[0] ?? []).map((h) => h.trim().toLowerCase());
  const col: Record<string, number> = {};
  Object.entries(ALIASES).forEach(([k, al]) => { const i = head.findIndex((h) => al.includes(h)); if (i >= 0) col[k] = i; });
  const get = (r: string[], k: string) => (col[k] !== undefined ? (r[col[k]] ?? "").trim() : "");
  const byRef = new Map<string, ImportRow>(); const out: ImportRow[] = []; const errors: { line: number; error: string }[] = [];
  grid.slice(1).forEach((r, idx) => {
    const line = idx + 2; const product = get(r, "product_name");
    if (!product) { errors.push({ line, error: "product?" }); return; }
    const ref = get(r, "external_ref");
    const item = { product_name: product, qty: Math.max(1, Math.round(n(get(r, "qty")) || 1)), unit_price: get(r, "unit_price") ? n(get(r, "unit_price")) : undefined };
    if (ref && byRef.has(ref)) { byRef.get(ref)!.items.push(item); return; }
    const st = STATUS_MAP[get(r, "status").toLowerCase()] ?? "pending";
    const src = get(r, "source").toLowerCase();
    const order: Record<string, unknown> = {
      external_ref: ref || undefined, order_date: toIsoDate(get(r, "order_date")) || undefined, status: st,
      source: ["website", "facebook", "instagram", "whatsapp", "phone", "other"].includes(src) ? src : "website",
      customer_name: get(r, "customer_name"), customer_phone: get(r, "customer_phone"), customer_address: get(r, "customer_address"),
      courier: get(r, "courier"), tracking_no: get(r, "tracking_no"), campaign_name: get(r, "campaign_name"),
      delivery_charge: n(get(r, "delivery_charge")), discount: n(get(r, "discount")), courier_cost: n(get(r, "courier_cost")),
    };
    const row = { order, items: [item], line };
    if (ref) byRef.set(ref, row);
    out.push(row);
  });
  return { rows: out, errors };
}

export function ImportDialog({ t, businessId }: { t: Dict; businessId: string }) {
  const [open, setOpen] = React.useState(false);
  const [parsed, setParsed] = React.useState<ReturnType<typeof buildRows> | null>(null);
  const [result, setResult] = React.useState<ImportResult | null>(null);
  const [pending, start] = useTransition();
  const reset = () => { setParsed(null); setResult(null); };
  const download = () => {
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(new Blob(["﻿" + TEMPLATE], { type: "text/csv" })), download: "core-orders-template.csv" });
    a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild><Button variant="outline"><FileUp /> {t.importOrders}</Button></DialogTrigger>
      <DialogContent title={t.importTitle} description={t.importDesc}>
        {result ? (
          <div className="grid gap-3 text-sm">
            <p className="rounded-md border border-success/25 bg-success-soft px-3 py-2 text-success">✓ {result.created} {t.importDone}{result.skipped ? ` · ${result.skipped} ${t.importSkipped}` : ""}</p>
            {result.failed.length > 0 && (
              <div className="rounded-md border border-destructive/25 bg-destructive-soft px-3 py-2 text-[13px] text-destructive">
                <p className="font-medium">{result.failed.length} {t.importFailed}</p>
                <ul className="mt-1 max-h-32 overflow-y-auto">{result.failed.slice(0, 20).map((f) => <li key={f.line}>#{f.line}: {f.error}</li>)}</ul>
              </div>
            )}
            <Button onClick={() => setOpen(false)}>{t.close}</Button>
          </div>
        ) : (
          <div className="grid gap-4">
            <Button variant="outline" onClick={download} className="w-fit"><Download /> {t.downloadTemplate}</Button>
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-8 text-center text-sm hover:bg-muted">
              <FileUp className="size-5 text-muted-foreground" /> {t.chooseFile}
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={async (e) => {
                const f = e.target.files?.[0]; if (!f) return; setParsed(buildRows(await f.text()));
              }} />
            </label>
            {parsed && (
              <div className="grid gap-2 text-[13px]">
                <p><strong className="tabular">{parsed.rows.length}</strong> {t.importPreview}</p>
                {parsed.errors.length > 0 && <p className="text-warning">{parsed.errors.length} {t.importErrors}: {parsed.errors.slice(0, 8).map((e) => `#${e.line}`).join(", ")}</p>}
                <Button loading={pending} disabled={!parsed.rows.length} onClick={() => start(async () => setResult(await A.importOrders(businessId, parsed.rows)))}>{t.importRun}</Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ProductToggle({ action, active, labels }: { action: () => Promise<void>; active: boolean; labels: { on: string; off: string } }) {
  const [pending, start] = useTransition();
  return <Button variant="ghost" size="sm" loading={pending} onClick={() => start(action)} className="text-muted-foreground">{active ? labels.off : labels.on}</Button>;
}
