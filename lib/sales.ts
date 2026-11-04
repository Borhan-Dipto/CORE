import "server-only";
import { cache } from "react";
import { getContext } from "@/lib/session";
import type { DateRange } from "@/lib/range";

const num = (v: unknown) => Number(v ?? 0);

export type Product = { id: string; name: string; sku: string | null; category: string | null; cost_price: number; sell_price: number; is_active: boolean };
export type OrderItem = { id: string; product_id: string | null; product_name: string; qty: number; unit_price: number; unit_cost: number };
export type Order = {
  id: string; order_no: string; order_date: string; status: string; source: string; customer_name: string | null; customer_phone: string | null;
  customer_address: string | null; notes: string | null; campaign_name: string | null; courier: string | null; tracking_no: string | null;
  discount: number; delivery_charge: number; courier_cost: number; packaging_cost: number; cod_fee: number; other_cost: number;
  delivered_on: string | null; closed_on: string | null; collected: boolean; collected_on: string | null; collected_amount: number | null;
  items: OrderItem[]; net_sales: number; cogs: number; direct_costs: number; profit: number; units: number;
};
export type OrderSummary = {
  orders_placed: number; by_status: Record<string, number>; delivered_count: number; returned_count: number; revenue: number; cogs: number;
  direct_costs: number; return_costs: number; units_sold: number; pipeline_value: number; pipeline_count: number; uncollected: number; uncollected_count: number;
  by_product: { key: string; product: string; units: number; revenue: number; cost: number; profit: number }[];
  by_campaign: { campaign: string; orders: number; revenue: number; gross_profit: number }[];
  by_source: { source: string; orders: number; revenue: number | null }[];
  daily: { day: string; revenue: number; gross_profit: number; orders: number }[];
};
export type Pnl = {
  revenue: number; cogs: number; direct_costs: number; gross_profit: number; operating_expenses: number; ad_spend: number; other_income: number;
  net_profit: number; inventory_purchases: number; roas: number | null; opex_by_category: { name: string; total: number }[];
  allocations: { user_id: string; percentage: number; amount: number }[];
};

export const getProducts = cache(async (businessId: string): Promise<Product[]> => {
  const { supabase } = await getContext();
  const { data } = await supabase.from("products").select("id, name, sku, category, cost_price, sell_price, is_active").eq("business_id", businessId).order("is_active", { ascending: false }).order("name");
  return (data ?? []).map((p) => ({ ...p, cost_price: num(p.cost_price), sell_price: num(p.sell_price) })) as Product[];
});

function withTotals(o: Record<string, unknown> & { order_items?: OrderItem[] }): Order {
  const items = (o.order_items ?? []).map((i) => ({ ...i, qty: num(i.qty), unit_price: num(i.unit_price), unit_cost: num(i.unit_cost) }));
  const rev = items.reduce((s, i) => s + i.qty * i.unit_price, 0);
  const cogs = items.reduce((s, i) => s + i.qty * i.unit_cost, 0);
  const n = (k: string) => num(o[k]);
  const net = rev - n("discount") + n("delivery_charge");
  const direct = n("courier_cost") + n("packaging_cost") + n("cod_fee") + n("other_cost");
  const { order_items: _omit, ...rest } = o; void _omit;
  return {
    ...(rest as unknown as Order), items, discount: n("discount"), delivery_charge: n("delivery_charge"), courier_cost: n("courier_cost"),
    packaging_cost: n("packaging_cost"), cod_fee: n("cod_fee"), other_cost: n("other_cost"),
    collected_amount: o.collected_amount == null ? null : n("collected_amount"),
    net_sales: net, cogs, direct_costs: direct, profit: net - cogs - direct, units: items.reduce((s, i) => s + i.qty, 0),
  };
}

const ORDER_COLS = "id, order_no, order_date, status, source, customer_name, customer_phone, customer_address, notes, campaign_name, courier, tracking_no, discount, delivery_charge, courier_cost, packaging_cost, cod_fee, other_cost, delivered_on, closed_on, collected, collected_on, collected_amount, order_items(id, product_id, product_name, qty, unit_price, unit_cost)";

export async function getOrders(businessId: string, range: DateRange): Promise<Order[]> {
  const { supabase } = await getContext();
  const { data } = await supabase.from("orders").select(ORDER_COLS).eq("business_id", businessId)
    .gte("order_date", range.from).lte("order_date", range.to).order("order_date", { ascending: false }).order("created_at", { ascending: false }).limit(3000);
  return (data ?? []).map((o) => withTotals(o as unknown as Record<string, unknown>));
}

export async function getOrder(businessId: string, orderId: string) {
  const { supabase } = await getContext();
  const [{ data }, { data: history }] = await Promise.all([
    supabase.from("orders").select(ORDER_COLS).eq("business_id", businessId).eq("id", orderId).maybeSingle(),
    supabase.from("order_status_history").select("id, from_status, to_status, note, changed_by, changed_at").eq("order_id", orderId).order("changed_at"),
  ]);
  if (!data) return null;
  return { order: withTotals(data as unknown as Record<string, unknown>), history: history ?? [] };
}

export const getOrderSummary = cache(async (businessId: string, from: string, to: string): Promise<OrderSummary> => {
  const { supabase } = await getContext();
  const { data } = await supabase.rpc("order_summary", { p_business: businessId, p_from: from, p_to: to });
  const s = (data ?? {}) as Record<string, unknown>;
  const arr = <T,>(k: string) => ((s[k] as T[]) ?? []);
  return {
    orders_placed: num(s.orders_placed), by_status: (s.by_status as Record<string, number>) ?? {}, delivered_count: num(s.delivered_count),
    returned_count: num(s.returned_count), revenue: num(s.revenue), cogs: num(s.cogs), direct_costs: num(s.direct_costs), return_costs: num(s.return_costs),
    units_sold: num(s.units_sold), pipeline_value: num(s.pipeline_value), pipeline_count: num(s.pipeline_count), uncollected: num(s.uncollected),
    uncollected_count: num(s.uncollected_count),
    by_product: arr<OrderSummary["by_product"][number]>("by_product").map((x) => ({ ...x, units: num(x.units), revenue: num(x.revenue), cost: num(x.cost), profit: num(x.profit) })),
    by_campaign: arr<OrderSummary["by_campaign"][number]>("by_campaign").map((x) => ({ ...x, orders: num(x.orders), revenue: num(x.revenue), gross_profit: num(x.gross_profit) })),
    by_source: arr<OrderSummary["by_source"][number]>("by_source"),
    daily: arr<OrderSummary["daily"][number]>("daily").map((x) => ({ day: x.day, revenue: num(x.revenue), gross_profit: num(x.gross_profit), orders: num(x.orders) })),
  };
});

export const getPnl = cache(async (businessId: string, from: string, to: string): Promise<Pnl> => {
  const { supabase } = await getContext();
  const { data } = await supabase.rpc("profit_and_loss", { p_business: businessId, p_from: from, p_to: to });
  const s = (data ?? {}) as Record<string, unknown>;
  return {
    revenue: num(s.revenue), cogs: num(s.cogs), direct_costs: num(s.direct_costs), gross_profit: num(s.gross_profit),
    operating_expenses: num(s.operating_expenses), ad_spend: num(s.ad_spend), other_income: num(s.other_income), net_profit: num(s.net_profit),
    inventory_purchases: num(s.inventory_purchases), roas: s.roas == null ? null : num(s.roas),
    opex_by_category: ((s.opex_by_category as { name: string; total: number }[]) ?? []).map((x) => ({ ...x, total: num(x.total) })),
    allocations: ((s.allocations as { user_id: string; percentage: number; amount: number }[]) ?? []).map((x) => ({ ...x, percentage: num(x.percentage), amount: num(x.amount) })),
  };
});
