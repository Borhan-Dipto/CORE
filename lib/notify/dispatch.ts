import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { mailConfigured, sendAll, type Outgoing } from "./mail";

/** Emails any pending notifications for a business. Called right after a change, by the person who made it. */
export async function dispatchEmails(supabase: SupabaseClient, businessId: string) {
  if (!mailConfigured() || !businessId) return;
  try {
    const { data, error } = await supabase.rpc("claim_notification_emails", { p_business: businessId });
    if (error || !data?.length) return;
    const failed = await sendAll(data as Outgoing[]);
    if (failed.length) await supabase.rpc("mark_notification_email", { p_ids: failed, p_status: "failed" });
  } catch (e) {
    console.error("[CORE] dispatch", (e as Error).message);
  }
}
