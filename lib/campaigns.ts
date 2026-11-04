import "server-only";
import { getContext } from "@/lib/session";

/** Campaign names already used on boosting expenses — offered as suggestions when tagging orders. */
export async function getCampaignNames(businessId: string): Promise<string[]> {
  const { supabase } = await getContext();
  const { data } = await supabase.from("financial_transactions").select("campaign_name").eq("business_id", businessId)
    .eq("is_advertising", true).eq("status", "posted").not("campaign_name", "is", null).order("txn_date", { ascending: false }).limit(300);
  return [...new Set((data ?? []).map((r) => r.campaign_name as string))];
}
