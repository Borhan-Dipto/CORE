import "server-only";
import { cache } from "react";
import { getContext } from "@/lib/session";
import { todayDhaka } from "@/lib/range";

const num = (v: unknown) => Number(v ?? 0);

export type Allocation = { partner_id: string; percentage: number; share: number; paid: number; remaining: number };
export type Settlement = {
  id: string; settlement_no: number; period_from: string; period_to: string; net_profit: number; carry_in: number;
  distributable: number; carry_out: number; note: string | null; status: "final" | "void"; void_reason: string | null;
  created_at: string; allocations: Allocation[]; paid: number; live_net_profit: number | null;
};
export type Preview = {
  period_from: string; period_to: string; next_from: string | null; net_profit: number; carry_in: number; distributable: number;
  carry_out: number; shares_total: number; allocations: { partner_id: string; name: string | null; percentage: number; share: number; active: boolean }[];
};

export const getSettlements = cache(async (businessId: string): Promise<Settlement[]> => {
  const { supabase } = await getContext();
  const [{ data: rows }, { data: allocs }, { data: payouts }] = await Promise.all([
    supabase.from("profit_settlements").select("id, settlement_no, period_from, period_to, net_profit, carry_in, distributable, carry_out, note, status, void_reason, created_at")
      .eq("business_id", businessId).order("period_to", { ascending: false }).order("settlement_no", { ascending: false }),
    supabase.from("profit_allocations").select("settlement_id, partner_id, percentage, share_amount").eq("business_id", businessId),
    supabase.from("financial_transactions").select("settlement_id, partner_id, amount").eq("business_id", businessId)
      .eq("txn_type", "withdrawal").eq("status", "posted").not("settlement_id", "is", null),
  ]);
  const finals = (rows ?? []).filter((r) => r.status === "final");
  const live = await Promise.all(finals.map((r) => supabase.rpc("profit_and_loss", { p_business: businessId, p_from: r.period_from, p_to: r.period_to })));
  const liveMap = new Map(finals.map((r, i) => [r.id, num((live[i].data as Record<string, unknown> | null)?.net_profit)]));
  return (rows ?? []).map((r) => {
    const allocations = (allocs ?? []).filter((a) => a.settlement_id === r.id).map((a) => {
      const paid = (payouts ?? []).filter((p) => p.settlement_id === r.id && p.partner_id === a.partner_id).reduce((s, p) => s + num(p.amount), 0);
      const share = num(a.share_amount);
      return { partner_id: a.partner_id, percentage: num(a.percentage), share, paid, remaining: Math.max(share - paid, 0) };
    }).sort((x, y) => y.percentage - x.percentage);
    return {
      ...r, net_profit: num(r.net_profit), carry_in: num(r.carry_in), distributable: num(r.distributable), carry_out: num(r.carry_out),
      allocations, paid: allocations.reduce((s, a) => s + a.paid, 0), live_net_profit: liveMap.get(r.id) ?? null,
    } as Settlement;
  });
});

/** Suggested next period: day after the last close (or the first activity), to the end of the last full month (or today). */
export async function suggestPeriod(businessId: string, settlements: Settlement[], startDate: string | null) {
  const last = settlements.find((s) => s.status === "final");
  let from = last ? addDays(last.period_to, 1) : null;
  if (!from) {
    const { supabase } = await getContext();
    const [{ data: t }, { data: o }] = await Promise.all([
      supabase.from("financial_transactions").select("txn_date").eq("business_id", businessId).order("txn_date").limit(1),
      supabase.from("orders").select("order_date").eq("business_id", businessId).order("order_date").limit(1),
    ]);
    const dates = [t?.[0]?.txn_date, o?.[0]?.order_date, startDate].filter(Boolean) as string[];
    from = dates.sort()[0] ?? todayDhaka().slice(0, 8) + "01";
  }
  const today = todayDhaka();
  const monthEnd = endOfMonth(from);
  const to = monthEnd < today ? monthEnd : today;
  return { from, to: to < from ? from : to, locked: !!last };
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
function endOfMonth(iso: string) {
  const d = new Date(iso + "T00:00:00Z"); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}
