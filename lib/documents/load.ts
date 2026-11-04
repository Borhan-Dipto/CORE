import "server-only";
import { getContext } from "@/lib/session";
import { getOrder, type Order } from "@/lib/sales";

export type DocLang = "bn" | "en";
export type DocKind = "invoice" | "voucher" | "statement" | "settlement";

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
  | { kind: "settlement"; brand: Brand; s: SettlementDoc };

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
  return null;
}
