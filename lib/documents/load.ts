import "server-only";
import { getContext } from "@/lib/session";
import { getOrder, type Order } from "@/lib/sales";

export type DocLang = "bn" | "en";
export type DocKind = "invoice" | "voucher" | "statement" | "settlement" | "report";

export type Brand = {
  name: string; address: string | null; phone: string | null; email: string | null;
  logo: string | null; tagline: string | null; website: string | null;
  payment_info: string | null; policy_note: string | null; thank_you: string | null; signatory: string | null;
};

export type Txn = {
  id: string; txn_type: "expense" | "income" | "investment" | "withdrawal" | "transfer" | "profit_share"; status: "posted" | "reversed";
  txn_date: string; amount: number; doc_no: number | null; category_name: string | null; is_advertising: boolean;
  ad_platform: string | null; campaign_name: string | null; target_product: string | null; title: string | null;
  description: string | null; reference: string | null; reversal_of: string | null; reversal_reason: string | null;
  linked_txn_id: string | null; order_id: string | null; created_at: string;
  account: string | null; to_account: string | null; partner: string | null; created_by_name: string | null;
  reversal_of_no: string | null; order_no: string | null; settlement_id: string | null;
};

export type StatementRow = { id: string; date: string; no: string; type: string; note: string; in: number; out: number; balance: number; status: string };

export type DocData =
  | { kind: "invoice"; brand: Brand; order: Order }
  | { kind: "voucher"; brand: Brand; txn: Txn }
  | { kind: "statement"; brand: Brand; partner: { name: string; email: string | null; share: number | null }; rows: StatementRow[];
      totals: { invested: number; profit: number; withdrawn: number; balance: number }; from: string | null; to: string }
  | { kind: "settlement"; brand: Brand; s: SettlementDoc }
  | { kind: "report"; brand: Brand; r: ReportDoc };

type Num = Record<string, number>;
export type ReportDoc = {
  from: string; to: string; prevFrom: string; prevTo: string;
  pnl: Num; prev: Num;
  orders: { placed: number; delivered: number; returned: number; cancelled: number; units: number; uncollected: number; uncollected_count: number; pipeline: number; pipeline_count: number };
  prevOrders: { delivered: number };
  daily: { day: string; revenue: number; gross_profit: number; orders: number }[];
  products: { product: string; units: number; revenue: number; cost: number; profit: number }[];
  campaigns: { campaign: string; spend: number; orders: number; revenue: number; roas: number | null }[];
  categories: { name: string; total: number; ad: boolean }[];
  sources: { source: string; orders: number; revenue: number }[];
  accounts: { name: string; balance: number }[];
  partners: { name: string; percentage: number | null; capital: number; share: number }[];
  settlement: { no: number; distributable: number } | null;
  investments: number; withdrawals: number; inventory: number;
};

export type SettlementDoc = {
  no: number; period_from: string; period_to: string; net_profit: number; carry_in: number; distributable: number; carry_out: number;
  status: string; void_reason: string | null; note: string | null; created_at: string; created_by_name: string | null;
  pnl: Record<string, unknown>;
  rows: { name: string; percentage: number; share: number; paid: number; retained: number }[];
};

const UUID = /^[0-9a-f-]{36}$/i;
import { docNo, invoiceNo } from "./numbers";
export { docNo, invoiceNo };

async function loadBrand(businessId: string): Promise<Brand | null> {
  const { supabase } = await getContext();
  const [{ data: b }, { data: s }] = await Promise.all([
    supabase.from("businesses").select("name, address, phone, email").eq("id", businessId).maybeSingle(),
    supabase.from("business_invoice_settings").select("logo_data, tagline, website, payment_info, policy_note, thank_you, signatory").eq("business_id", businessId).maybeSingle(),
  ]);
  if (!b) return null;
  return { ...b, logo: s?.logo_data ?? null, tagline: s?.tagline ?? null, website: s?.website ?? null, payment_info: s?.payment_info ?? null,
    policy_note: s?.policy_note ?? null, thank_you: s?.thank_you ?? null, signatory: s?.signatory ?? null };
}

async function names(ids: (string | null)[]) {
  const list = [...new Set(ids.filter(Boolean))] as string[];
  if (!list.length) return new Map<string, string>();
  const { supabase } = await getContext();
  const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", list);
  return new Map((data ?? []).map((p) => [p.id as string, (p.full_name || p.email || "—") as string]));
}

/** Everything is read with the viewer's own session, so Row Level Security decides who may download what. */
export async function loadDocument(kind: string, id: string, params: URLSearchParams): Promise<DocData | null> {
  if (!UUID.test(id)) return null;
  const { supabase } = await getContext();

  if (kind === "invoice") {
    const { data: row } = await supabase.from("orders").select("business_id").eq("id", id).maybeSingle();
    if (!row) return null;
    const [brand, res] = await Promise.all([loadBrand(row.business_id), getOrder(row.business_id, id)]);
    return brand && res ? { kind, brand, order: res.order } : null;
  }

  if (kind === "voucher") {
    const { data: t } = await supabase.from("financial_transactions")
      .select("*, account:business_accounts!financial_transactions_account_id_fkey(name), to_account:business_accounts!financial_transactions_to_account_id_fkey(name), order:orders!fin_txn_order_fk(order_no)")
      .eq("id", id).maybeSingle();
    if (!t) return null;
    const brand = await loadBrand(t.business_id);
    if (!brand) return null;
    const people = await names([t.partner_id, t.created_by]);
    let reversalOfNo: string | null = null;
    if (t.reversal_of) {
      const { data: o } = await supabase.from("financial_transactions").select("txn_type, doc_no").eq("id", t.reversal_of).maybeSingle();
      if (o) reversalOfNo = docNo(o.txn_type, o.doc_no);
    }
    const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
    return {
      kind, brand,
      txn: {
        ...t, amount: Number(t.amount),
        account: one(t.account as { name: string } | null)?.name ?? null,
        to_account: one(t.to_account as { name: string } | null)?.name ?? null,
        order_no: one(t.order as { order_no: string } | null)?.order_no ?? null,
        partner: t.partner_id ? people.get(t.partner_id) ?? null : null,
        created_by_name: t.created_by ? people.get(t.created_by) ?? null : null,
        reversal_of_no: reversalOfNo,
      } as Txn,
    };
  }

  if (kind === "statement") {
    const partnerId = params.get("partner") ?? "";
    if (!UUID.test(partnerId)) return null;
    const brand = await loadBrand(id);
    if (!brand) return null;
    const from = params.get("from") && /^\d{4}-\d{2}-\d{2}$/.test(params.get("from")!) ? params.get("from") : null;
    const to = params.get("to") && /^\d{4}-\d{2}-\d{2}$/.test(params.get("to")!) ? params.get("to")! : new Date(Date.now() + 6 * 3600e3).toISOString().slice(0, 10);
    const [{ data: txns }, { data: profile }, { data: shares }] = await Promise.all([
      supabase.from("financial_transactions").select("id, txn_type, txn_date, amount, doc_no, status, title, description, category_name, linked_txn_id, reversal_of, created_at")
        .eq("business_id", id).eq("partner_id", partnerId).in("txn_type", ["investment", "withdrawal", "profit_share"]).lte("txn_date", to)
        .order("txn_date").order("created_at"),
      supabase.from("profiles").select("full_name, email").eq("id", partnerId).maybeSingle(),
      supabase.rpc("profit_shares_on", { p_business: id, p_date: to }),
    ]);
    const { data: member } = await supabase.from("business_members").select("id").eq("business_id", id).eq("user_id", partnerId).limit(1);
    if (!member?.length) return null;
    let bal = 0;
    const rows: StatementRow[] = [];
    let opening = 0;
    for (const t of txns ?? []) {
      // Reversed pairs net to zero; show only effective (posted, non-reversal) entries.
      if (t.status !== "posted" || t.reversal_of) continue;
      const amt = Number(t.amount);
      const signed = t.txn_type === "withdrawal" ? -amt : amt;
      if (from && t.txn_date < from) { opening += signed; continue; }
      bal = (rows.length ? bal : opening) + signed;
      rows.push({ id: t.id, date: t.txn_date, no: docNo(t.txn_type, t.doc_no), type: t.txn_type,
        note: t.title || (t.linked_txn_id ? t.category_name ?? "" : "") || t.description || "", in: signed > 0 ? amt : 0, out: signed < 0 ? amt : 0, balance: bal, status: t.status });
    }
    if (!rows.length) bal = opening;
    const invested = rows.filter((r) => r.type === "investment").reduce((s, r) => s + r.in, 0);
    const profit = rows.filter((r) => r.type === "profit_share").reduce((s, r) => s + r.in, 0);
    const withdrawn = rows.reduce((s, r) => s + r.out, 0);
    const share = (shares as { user_id: string; percentage: number }[] | null)?.find((s) => s.user_id === partnerId)?.percentage ?? null;
    if (from && opening) rows.unshift({ id: "opening", date: from, no: "", type: "opening", note: "", in: 0, out: 0, balance: opening, status: "posted" });
    return { kind, brand, partner: { name: profile?.full_name || profile?.email || "—", email: profile?.email ?? null, share: share === null ? null : Number(share) },
      rows, totals: { invested, profit, withdrawn, balance: bal }, from, to };
  }

  if (kind === "settlement") {
    const { data: st } = await supabase.from("profit_settlements").select("*").eq("id", id).maybeSingle();
    if (!st) return null;
    const brand = await loadBrand(st.business_id);
    if (!brand) return null;
    const [{ data: allocs }, { data: pays }] = await Promise.all([
      supabase.from("profit_allocations").select("partner_id, percentage, share_amount").eq("settlement_id", id),
      supabase.from("financial_transactions").select("partner_id, amount").eq("settlement_id", id).eq("txn_type", "withdrawal").eq("status", "posted"),
    ]);
    const people = await names([...(allocs ?? []).map((a) => a.partner_id), st.created_by]);
    const rows = (allocs ?? []).map((a) => {
      const paid = (pays ?? []).filter((p) => p.partner_id === a.partner_id).reduce((s, p) => s + Number(p.amount), 0);
      const share = Number(a.share_amount);
      return { name: people.get(a.partner_id) ?? "—", percentage: Number(a.percentage), share, paid, retained: Math.max(share - paid, 0) };
    }).sort((x, y) => y.percentage - x.percentage);
    return { kind, brand, s: {
      no: st.settlement_no, period_from: st.period_from, period_to: st.period_to, net_profit: Number(st.net_profit), carry_in: Number(st.carry_in),
      distributable: Number(st.distributable), carry_out: Number(st.carry_out), status: st.status, void_reason: st.void_reason, note: st.note,
      created_at: st.created_at, created_by_name: st.created_by ? people.get(st.created_by) ?? null : null, pnl: (st.pnl ?? {}) as Record<string, unknown>, rows } };
  }
  if (kind === "report") {
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    const from = params.get("from") ?? "", to = params.get("to") ?? "";
    if (!iso.test(from) || !iso.test(to) || to < from) return null;
    const brand = await loadBrand(id);
    if (!brand) return null;
    const days = Math.round((Date.parse(to) - Date.parse(from)) / 864e5) + 1;
    const shift = (d: string, n: number) => new Date(Date.parse(d) + n * 864e5).toISOString().slice(0, 10);
    const prevTo = shift(from, -1), prevFrom = shift(from, -days);
    const rpc = (fn: string, args: Record<string, unknown>) => supabase.rpc(fn, args).then((r) => r.data);
    const [pl, prev, os, prevOs, fs, accounts, capital, shares, ads, settled] = await Promise.all([
      rpc("profit_and_loss", { p_business: id, p_from: from, p_to: to }),
      rpc("profit_and_loss", { p_business: id, p_from: prevFrom, p_to: prevTo }),
      rpc("order_summary", { p_business: id, p_from: from, p_to: to }),
      rpc("order_summary", { p_business: id, p_from: prevFrom, p_to: prevTo }),
      rpc("finance_summary", { p_business: id, p_from: from, p_to: to }),
      rpc("account_balances", { p_business: id, p_as_of: to }),
      rpc("partner_capital", { p_business: id }),
      rpc("profit_shares_on", { p_business: id, p_date: to }),
      supabase.from("financial_transactions").select("campaign_name, amount").eq("business_id", id).eq("txn_type", "expense")
        .eq("is_advertising", true).eq("status", "posted").gte("txn_date", from).lte("txn_date", to).then((r) => r.data),
      supabase.from("profit_settlements").select("settlement_no, distributable").eq("business_id", id).eq("status", "final")
        .eq("period_from", from).eq("period_to", to).maybeSingle().then((r) => r.data),
    ]);
    if (!pl) return null;
    const n = (v: unknown) => Number(v ?? 0);
    const numify = (o: unknown): Num => Object.fromEntries(Object.entries((o ?? {}) as Record<string, unknown>).filter(([, v]) => typeof v === "number" || (typeof v === "string" && v !== "" && !isNaN(Number(v)))).map(([k, v]) => [k, Number(v)]));
    const O = (os ?? {}) as Record<string, unknown>;
    const F = (fs ?? {}) as Record<string, unknown>;
    const arr = <T,>(v: unknown) => ((v as T[]) ?? []);
    // campaigns: ad spend (ledger) joined with delivered results (orders)
    const spend = new Map<string, { name: string; spend: number }>();
    (ads ?? []).forEach((r) => { const nm = (r.campaign_name as string | null)?.trim() || "—"; const k = nm.toLowerCase(); const x = spend.get(k) ?? { name: nm, spend: 0 }; x.spend += n(r.amount); spend.set(k, x); });
    const camp = new Map<string, { campaign: string; spend: number; orders: number; revenue: number }>();
    spend.forEach((v, k) => camp.set(k, { campaign: v.name, spend: v.spend, orders: 0, revenue: 0 }));
    arr<Record<string, unknown>>(O.by_campaign).forEach((c) => { const nm = String(c.campaign); const k = nm.trim().toLowerCase(); const x = camp.get(k) ?? { campaign: nm, spend: 0, orders: 0, revenue: 0 }; x.orders += n(c.orders); x.revenue += n(c.revenue); camp.set(k, x); });
    const memberIds = arr<Record<string, unknown>>(capital).map((c) => String(c.partner_id));
    const people = await names(memberIds);
    const shareRows = arr<Record<string, unknown>>(shares);
    const net = n((pl as Record<string, unknown>).net_profit);
    const status = (O.by_status ?? {}) as Record<string, number>;
    return { kind, brand, r: {
      from, to, prevFrom, prevTo, pnl: numify(pl), prev: numify(prev),
      orders: { placed: n(O.orders_placed), delivered: n(O.delivered_count), returned: n(O.returned_count), cancelled: n(status.cancelled),
        units: n(O.units_sold), uncollected: n(O.uncollected), uncollected_count: n(O.uncollected_count), pipeline: n(O.pipeline_value), pipeline_count: n(O.pipeline_count) },
      prevOrders: { delivered: n((prevOs as Record<string, unknown> | null)?.delivered_count) },
      daily: days > 92 ? [] : arr<Record<string, unknown>>(O.daily).map((d) => ({ day: String(d.day), revenue: n(d.revenue), gross_profit: n(d.gross_profit), orders: n(d.orders) })),
      products: arr<Record<string, unknown>>(O.by_product).map((p) => ({ product: String(p.product), units: n(p.units), revenue: n(p.revenue), cost: n(p.cost), profit: n(p.profit) }))
        .sort((a, b) => b.revenue - a.revenue).slice(0, 12),
      campaigns: [...camp.values()].map((c) => ({ ...c, roas: c.spend > 0 ? c.revenue / c.spend : null })).sort((a, b) => b.spend - a.spend || b.revenue - a.revenue).slice(0, 10),
      categories: arr<Record<string, unknown>>((pl as Record<string, unknown>).opex_by_category).map((c) => ({ name: String(c.name ?? "—"), total: n(c.total), ad: false })),
      sources: arr<Record<string, unknown>>(O.by_source).map((x) => ({ source: String(x.source), orders: n(x.orders), revenue: n(x.revenue) })),
      accounts: arr<Record<string, unknown>>(accounts).filter((a) => a.is_active !== false || n(a.balance) !== 0).map((a) => ({ name: String(a.name), balance: n(a.balance) })),
      partners: arr<Record<string, unknown>>(capital).map((c) => {
        const pct = shareRows.find((s) => s.user_id === c.partner_id);
        const p = pct ? n(pct.percentage) : null;
        return { name: people.get(String(c.partner_id)) ?? "—", percentage: p, capital: n(c.balance), share: p !== null && net > 0 ? Math.round(net * p) / 100 : 0 };
      }).sort((a, b) => (b.percentage ?? 0) - (a.percentage ?? 0)),
      settlement: settled ? { no: settled.settlement_no, distributable: n(settled.distributable) } : null,
      investments: n(F.investments), withdrawals: n(F.withdrawals), inventory: n((pl as Record<string, unknown>).inventory_purchases),
    } };
  }
  return null;
}
