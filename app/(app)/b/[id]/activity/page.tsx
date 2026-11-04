import { getBusiness, getContext, getT } from "@/lib/session";
import { fmtDate } from "@/lib/i18n";

export const metadata = { title: "Activity" };

type Log = { id: number; user_id: string | null; action: string; module: string; new_value: Record<string, unknown> | null; old_value: Record<string, unknown> | null; created_at: string };

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await getBusiness(id);
  const [{ supabase }, { lang, t }] = await Promise.all([getContext(), getT()]);
  const { data } = await supabase.from("audit_logs").select("id, user_id, action, module, new_value, old_value, created_at")
    .eq("business_id", id).order("created_at", { ascending: false }).limit(200);
  const logs = (data ?? []) as Log[];
  const ids = [...new Set(logs.map((l) => l.user_id).filter(Boolean))] as string[];
  const { data: people } = ids.length ? await supabase.from("profiles").select("id, full_name, email").in("id", ids) : { data: [] };
  const who = (uid: string | null) => { const p = people?.find((x) => x.id === uid); return p?.full_name || p?.email || "—"; };

  const detail = (l: Log) => {
    const v = l.new_value ?? l.old_value ?? {};
    if (l.module === "business_invitations") return String(v.email ?? "") + (v.status && v.status !== "pending" ? ` · ${v.status}` : "");
    if (l.module === "profit_sharing_rules") return `${v.percentage}% · ${fmtDate(String(v.effective_from), lang)}`;
    if (l.module === "business_members") return v.status === "removed" ? `${who(String(v.user_id))} · removed` : who(String(v.user_id));
    if (l.module === "businesses") return l.old_value && l.old_value.status !== v.status ? `${l.old_value.status} → ${v.status}` : String(v.name ?? "");
    return "";
  };

  return (
    <section className="card">
      <div className="border-b border-line px-6 py-4">
        <h2 className="font-semibold">{t.activity}</h2>
        <p className="mt-1 text-sm text-muted">{t.activityHelp}</p>
      </div>
      {logs.length === 0 ? <p className="px-6 py-8 text-sm text-muted">{t.noActivity}</p> : (
        <ul className="divide-y divide-line">
          {logs.map((l) => (
            <li key={l.id} className="grid gap-1 px-6 py-3 text-sm sm:grid-cols-[10rem_10rem_1fr] sm:gap-4">
              <span className="text-muted">{fmtDate(l.created_at, lang, true)}</span>
              <span className="truncate font-medium">{who(l.user_id)}</span>
              <span>{t.modules[l.module] ?? l.module} {t.actions[l.action] ?? l.action} <span className="text-muted">{detail(l)}</span></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
