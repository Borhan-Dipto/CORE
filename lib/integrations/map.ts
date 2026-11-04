import "server-only";

export type Mapped = { order: Record<string, unknown>; items: Record<string, unknown>[]; status: string | null };
type J = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const num = (v: unknown) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const str = (...v: unknown[]) => v.map((x) => (x == null ? "" : String(x).trim())).filter(Boolean).join(" ").trim() || undefined;
const join = (...v: unknown[]) => v.map((x) => (x == null ? "" : String(x).trim())).filter(Boolean).join(" · ") || undefined;
const day = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : undefined);
const addr = (a: J | undefined) => a && str([a.address_1 ?? a.address1, a.address_2 ?? a.address2, a.city, a.state ?? a.province].filter(Boolean).join(", "));

const WOO: Record<string, string | null> = {
  pending: "pending", "on-hold": "pending", processing: "confirmed", completed: "delivered",
  cancelled: "cancelled", refunded: "cancelled", failed: "cancelled", "checkout-draft": null, trash: "cancelled",
};

export function fromWoo(o: J): Mapped {
  const b = o.billing ?? {}, s = o.shipping ?? {};
  const items = (o.line_items ?? []).map((li: J) => {
    const qty = Math.max(1, Math.round(num(li.quantity)));
    const sub = li.subtotal != null ? num(li.subtotal) : num(li.price) * qty;
    return { product_name: str(li.name) ?? "Item", qty, unit_price: Math.round((sub / qty) * 100) / 100 };
  });
  return {
    order: {
      external_ref: `woo-${o.id}`, order_date: day(o.date_created),
      customer_name: str(s.first_name || b.first_name, s.last_name || b.last_name),
      customer_phone: str(b.phone || s.phone), customer_address: addr(s.address_1 ? s : b),
      notes: join(o.customer_note, o.payment_method_title && `Payment: ${o.payment_method_title}`, `Web #${o.number ?? o.id}`),
      delivery_charge: num(o.shipping_total), discount: num(o.discount_total), source: "website",
    },
    items, status: o.status in WOO ? WOO[o.status] : "pending",
  };
}

export function fromShopify(o: J): Mapped {
  const s = o.shipping_address ?? o.billing_address ?? {}, c = o.customer ?? {};
  const items = (o.line_items ?? []).map((li: J) => ({
    product_name: str(li.title, li.variant_title && li.variant_title !== "Default Title" ? `(${li.variant_title})` : "") ?? "Item",
    qty: Math.max(1, Math.round(num(li.quantity))), unit_price: num(li.price),
  }));
  const shipping = (o.shipping_lines ?? []).reduce((a: number, l: J) => a + num(l.price), 0);
  const status = o.cancelled_at ? "cancelled" : o.fulfillment_status === "fulfilled" ? "shipped" : o.financial_status === "paid" ? "confirmed" : "pending";
  return {
    order: {
      external_ref: `shopify-${o.id}`, order_date: day(o.created_at),
      customer_name: str(s.name) ?? str(c.first_name, c.last_name), customer_phone: str(s.phone || o.phone || c.phone),
      customer_address: addr(s), notes: join(o.note, o.name && `Web ${o.name}`), delivery_charge: shipping, discount: num(o.total_discounts), source: "website",
    },
    items, status,
  };
}

/** Any other site: { id, date?, status?, customer: {name, phone, address}, items: [{name, qty, price}], delivery_charge?, discount?, note? } */
export function fromGeneric(o: J): Mapped {
  const c = o.customer ?? {};
  const allowed = ["pending", "confirmed", "shipped", "delivered", "returned", "cancelled"];
  return {
    order: {
      external_ref: o.id != null ? `web-${o.id}` : undefined, order_date: day(o.date),
      customer_name: str(c.name ?? o.customer_name), customer_phone: str(c.phone ?? o.customer_phone), customer_address: str(c.address ?? o.customer_address),
      notes: str(o.note), delivery_charge: num(o.delivery_charge), discount: num(o.discount), campaign_name: str(o.campaign), source: "website",
    },
    items: (o.items ?? []).map((i: J) => ({ product_name: str(i.name) ?? "Item", qty: Math.max(1, Math.round(num(i.qty ?? i.quantity ?? 1))), unit_price: num(i.price) })),
    status: typeof o.status === "string" && allowed.includes(o.status) ? o.status : "pending",
  };
}
