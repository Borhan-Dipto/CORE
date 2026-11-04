import { History } from "lucide-react";
import { Page, EmptyState } from "@/components/shell/Page";
import { Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { getBusiness, getContext, getT } from "@/lib/session";
import { fmtDate, fmtMoney } from "@/lib/i18n";

export const metadata = { title: "Activity" };
type Log = { id: number; user_id: string | null; action: string; module: string; new_value: Record<string, unknown> | null; old_value: Record<string, unknown> | null; created_at: string };

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await getBusiness(id);
  const [{ supabase }, { lang, t }] = await Promise.all([getContext(), getT()]);
  const { data } = await supabase.from("audit_logs").select("id, user_id, action, module, new_value, old_value, created_at")
    .eq("business_id", id).order("created_at", { ascending: false }).limit(300);
  const logs = ((data ?? []) as Log[]).filter((l) => !(l.module === "financial_transactions" && l.action === "update" && l.old_value?.status === l.new_value?.status));
  const ids = [...new Set(logs.flatMap((l) => [l.user_id, (l.new_value?.user_id as string) ?? null]).filter(Boolean))] as string[];
  const { data: people } = ids.length ? await supabase.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
  const who = (uid: string | null) => { const p = people?.find((x) => x.id === uid); return p?.full_name || p?.email || "System"; };

  const detail = (l: Log) => {
    const v = l.new_value ?? l.old_value ?? {};
    switch (l.module) {
      case "financial_transactions": {
        if (l.action === "update" && v.status === "reversed") return `${t.reversed} · ${fmtMoney(Number(v.amount), lang)} · ${v.reversal_reason ?? ""}`;
        const kind = v.status === "reversal" ? t.reversal : t.txnTypes[String(v.txn_type)];
        return `${kind} · ${fmtMoney(Number(v.amount), lang)}${v.title ? ` · ${v.title}` : v.category_name ? ` · ${v.category_name}` : ""}`;
      }
      case "business_invitations": return `${v.email ?? ""}${v.status && v.status !== "pending" ? ` · ${v.status}` : ""}`;
      case "profit_sharing_rules": return `${who(String(v.user_id))} · ${v.percentage}% · ${fmtDate(String(v.effective_from), lang)}`;
      case "business_members": return v.status === "removed" ? `${who(String(v.user_id))} · ${t.remove}` : who(String(v.user_id));
      case "businesses": return l.old_value && l.old_value.status !== v.status ? `${l.old_value.status} → ${v.status}` : String(v.name ?? "");
      default: return String(v.name ?? "");
    }
  };

  return (
    <Page title={t.activity} description={t.activityHelp}>
      {logs.length === 0 ? <EmptyState icon={History} title={t.noActivity} /> : (
        <Card className="overflow-hidden">
          <ol className="divide-y divide-border">
            {logs.map((l) => (
              <li key={l.id} className="flex gap-3 px-5 py-3.5">
                <Avatar name={who(l.user_id)} seed={who(l.user_id)} size="sm" className="mt-0.5" />
                <div className="min-w-0 flex-1 text-sm">
                  <p><span className="font-medium">{who(l.user_id)}</span> <span className="text-muted-foreground">· {t.modules[l.module] ?? l.module} {t.auditActions[l.action] ?? l.action}</span></p>
                  <p className="truncate text-[13px] text-muted-foreground">{detail(l)}</p>
                </div>
                <time className="shrink-0 text-xs text-muted-foreground tabular">{fmtDate(l.created_at, lang, true)}</time>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </Page>
  );
}
