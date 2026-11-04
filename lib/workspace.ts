import "server-only";
import { cache } from "react";
import { getContext } from "@/lib/session";

export type Member = { id: string; user_id: string; joined_at: string; name: string; email: string; isOwner: boolean; percentage: number | null };

/** Active partners of a business with profile + current profit share. */
export const getMembers = cache(async (businessId: string): Promise<Member[]> => {
  const { supabase } = await getContext();
  const [{ data: rows }, { data: shares }, { data: owners }] = await Promise.all([
    supabase.from("business_members").select("id, user_id, joined_at").eq("business_id", businessId).eq("status", "active").order("joined_at"),
    supabase.rpc("profit_shares_on", { p_business: businessId }),
    supabase.from("platform_owners").select("user_id"),
  ]);
  const ids = (rows ?? []).map((r) => r.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, full_name, email").in("id", ids)
    : { data: [] as { id: string; full_name: string | null; email: string | null }[] };
  const ownerIds = new Set((owners ?? []).map((o) => o.user_id));
  return (rows ?? []).map((r) => {
    const p = profiles?.find((x) => x.id === r.user_id);
    const s = (shares as { user_id: string; percentage: number }[] | null)?.find((x) => x.user_id === r.user_id);
    return {
      id: r.id, user_id: r.user_id, joined_at: r.joined_at,
      name: p?.full_name || p?.email || "—", email: p?.email ?? "",
      isOwner: ownerIds.has(r.user_id), percentage: s ? Number(s.percentage) : null,
    };
  });
});
