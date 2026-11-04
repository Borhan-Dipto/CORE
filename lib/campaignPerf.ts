import "server-only";
import { getContext } from "@/lib/session";
import type { OrderSummary } from "@/lib/sales";

export type CampaignRow = { campaign: string; spend: number; orders: number; revenue: number; gross_profit: number; roas: number | null; net: number };

/** Join ad spend per campaign (expenses) with delivered-order results per campaign (orders). */
export async function getCampaignPerformance(businessId: string, from: string, to: string, s: OrderSummary): Promise<CampaignRow[]> {
  const { supabase } = await getContext();
  const { data } = await supabase.from("financial_transactions").select("campaign_name, amount").eq("business_id", businessId)
    .eq("txn_type", "expense").eq("is_advertising", true).eq("status", "posted").not("campaign_name", "is", null).gte("txn_date", from).lte("txn_date", to);
  const spend = new Map<string, number>();
  (data ?? []).forEach((r) => { const k = (r.campaign_name as string).trim().toLowerCase(); spend.set(k, (spend.get(k) ?? 0) + Number(r.amount)); });
  const rows = new Map<string, CampaignRow>();
  const names = new Map<string, string>();
  (data ?? []).forEach((r) => names.set((r.campaign_name as string).trim().toLowerCase(), r.campaign_name as string));
  s.by_campaign.forEach((c) => names.set(c.campaign.trim().toLowerCase(), names.get(c.campaign.trim().toLowerCase()) ?? c.campaign));
  names.forEach((name, k) => {
    const o = s.by_campaign.find((c) => c.campaign.trim().toLowerCase() === k);
    const sp = spend.get(k) ?? 0; const rev = o?.revenue ?? 0; const gp = o?.gross_profit ?? 0;
    rows.set(k, { campaign: name, spend: sp, orders: o?.orders ?? 0, revenue: rev, gross_profit: gp, roas: sp > 0 ? rev / sp : null, net: gp - sp });
  });
  return [...rows.values()].sort((a, b) => b.spend + b.revenue - (a.spend + a.revenue));
}
