import "server-only";
import { cache } from "react";
import { getContext } from "@/lib/session";
import type { DateRange } from "@/lib/range";

export type Member = {
  id: string; user_id: string; joined_at: string; name: string; email: string; isOwner: boolean;
  percentage: number | null; invested: number; withdrawn: number; capital: number; paidPersonally: number;
};
export type Account = { id: string; name: string; type: string; is_active: boolean; opening_balance: number; money_in: number; money_out: number; balance: number };
export type Category = { id: string; name: string; is_advertising: boolean; is_active: boolean };
export type Txn = {
  id: string; txn_type: string; status: string; txn_date: string; amount: number; account_id: string | null; to_account_id: string | null;
  category_name: string | null; is_advertising: boolean; partner_id: string | null; ad_platform: string | null; campaign_name: string | null;
  target_product: string | null; title: string | null; description: string | null; reference: string | null; linked_txn_id: string | null;
  reversal_of: string | null; reversal_reason: string | null; created_at: string; doc_no: number | null;
};
export type Summary = {
  expenses: number; ad_spend: number; income: number; investments: number; withdrawals: number; expense_count: number;
  cash_balance: number; total_capital: number;
  by_category: { name: string; is_advertising: boolean; total: number }[];
  by_platform: { platform: string; total: number }[];
  by_product: { product: string; total: number }[];
  daily: { day: string; expenses: number; ad_spend: number; income: number }[];
};

const num = (v: unknown) => Number(v ?? 0);

/** People in the business (active + removed ones that still have money history). */
export const getMembers = cache(async (businessId: string): Promise<Member[]> => {
  const { supabase, user, isOwner } = await getContext();
  const [{ data: rows }, { data: shares }, { data: capital }] = await Promise.all([
    supabase.from("business_members").select("id, user_id, joined_at, status").eq("business_id", businessId).eq("status", "active").order("joined_at"),
    supabase.rpc("profit_shares_on", { p_business: businessId }),
    supabase.rpc("partner_capital", { p_business: businessId }),
  ]);
  const ids = [...new Set((rows ?? []).map((r) => r.user_id))];
  const { data: profiles } = ids.length ? await supabase.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
  // The owner created the business; the earliest member is the creator.
  const { data: biz } = await supabase.from("businesses").select("created_by").eq("id", businessId).maybeSingle();
  return (rows ?? []).map((r) => {
    const p = profiles?.find((x) => x.id === r.user_id);
    const s = (shares as { user_id: string; percentage: number }[] | null)?.find((x) => x.user_id === r.user_id);
    const c = (capital as { partner_id: string; invested: number; withdrawn: number; balance: number; paid_expenses: number }[] | null)?.find((x) => x.partner_id === r.user_id);
    return {
      id: r.id, user_id: r.user_id, joined_at: r.joined_at,
      name: p?.full_name || p?.email || "—", email: p?.email ?? "",
      isOwner: r.user_id === biz?.created_by || (isOwner && r.user_id === user.id),
      percentage: s ? num(s.percentage) : null,
      invested: num(c?.invested), withdrawn: num(c?.withdrawn), capital: num(c?.balance), paidPersonally: num(c?.paid_expenses),
    };
  });
});

export const getAccounts = cache(async (businessId: string, asOf?: string): Promise<Account[]> => {
  const { supabase } = await getContext();
  const { data } = await supabase.rpc("account_balances", { p_business: businessId, p_as_of: asOf ?? null });
  return ((data ?? []) as Account[]).map((a) => ({ ...a, opening_balance: num(a.opening_balance), money_in: num(a.money_in), money_out: num(a.money_out), balance: num(a.balance) }));
});

export const getCategories = cache(async (businessId: string): Promise<Category[]> => {
  const { supabase } = await getContext();
  const { data } = await supabase.from("expense_categories").select("id, name, is_advertising, is_active").eq("business_id", businessId).order("is_advertising", { ascending: false }).order("name");
  return (data ?? []) as Category[];
});

export const getSummary = cache(async (businessId: string, from: string, to: string): Promise<Summary> => {
  const { supabase } = await getContext();
  const { data } = await supabase.rpc("finance_summary", { p_business: businessId, p_from: from, p_to: to });
  const s = (data ?? {}) as Record<string, unknown>;
  const arr = <T,>(k: string) => ((s[k] as T[]) ?? []);
  return {
    expenses: num(s.expenses), ad_spend: num(s.ad_spend), income: num(s.income), investments: num(s.investments),
    withdrawals: num(s.withdrawals), expense_count: num(s.expense_count), cash_balance: num(s.cash_balance), total_capital: num(s.total_capital),
    by_category: arr<{ name: string; is_advertising: boolean; total: number }>("by_category").map((x) => ({ ...x, total: num(x.total) })),
    by_platform: arr<{ platform: string; total: number }>("by_platform").map((x) => ({ ...x, total: num(x.total) })),
    by_product: arr<{ product: string; total: number }>("by_product").map((x) => ({ ...x, total: num(x.total) })),
    daily: arr<{ day: string; expenses: number; ad_spend: number; income: number }>("daily").map((x) => ({ day: x.day, expenses: num(x.expenses), ad_spend: num(x.ad_spend), income: num(x.income) })),
  };
});

export async function getTransactions(businessId: string, range: DateRange, opts: { types?: string[]; adsOnly?: boolean; limit?: number; includeReversals?: boolean } = {}): Promise<Txn[]> {
  const { supabase } = await getContext();
  let q = supabase.from("financial_transactions")
    .select("id, txn_type, status, txn_date, amount, account_id, to_account_id, category_name, is_advertising, partner_id, ad_platform, campaign_name, target_product, title, description, reference, linked_txn_id, reversal_of, reversal_reason, created_at, doc_no")
    .eq("business_id", businessId).gte("txn_date", range.from).lte("txn_date", range.to)
    .order("txn_date", { ascending: false }).order("created_at", { ascending: false }).limit(opts.limit ?? 2000);
  if (opts.types?.length) q = q.in("txn_type", opts.types);
  if (opts.adsOnly) q = q.eq("is_advertising", true);
  if (!opts.includeReversals) q = q.neq("status", "reversal");
  const { data } = await q;
  return ((data ?? []) as Txn[]).map((t) => ({ ...t, amount: num(t.amount) }));
}

export async function getPendingInvites(businessId: string) {
  const { supabase, isOwner } = await getContext();
  if (!isOwner) return [];
  const { data } = await supabase.from("business_invitations").select("id, email, expires_at, created_at")
    .eq("business_id", businessId).eq("status", "pending").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false });
  return data ?? [];
}
