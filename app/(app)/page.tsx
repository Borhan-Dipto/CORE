import Link from "next/link";
import { getContext, getT } from "@/lib/session";
import { fmtDate, fmtNum } from "@/lib/i18n";

export default async function OverviewPage() {
  const [{ supabase, isOwner, profile, user }, { lang, t }] = await Promise.all([getContext(), getT()]);
  const [{ data: businesses }, { data: members }] = await Promise.all([
    supabase.from("businesses").select("id, name, category, status, created_at").order("status").order("name"),
    supabase.from("business_members").select("business_id, user_id").eq("status", "active"),
  ]);
  const list = businesses ?? [];
  const countFor = (id: string) => (members ?? []).filter((m) => m.business_id === id).length;
  const active = list.filter((b) => b.status === "active").length;
  const uniquePartners = new Set((members ?? []).map((m) => m.user_id)).size;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted">{t.welcome}</p>
          <h1 className="text-2xl font-semibold">{profile?.full_name || user.email}</h1>
        </div>
        {isOwner && <Link href="/businesses/new" className="btn-primary">+ {t.newBusiness}</Link>}
      </div>

      {isOwner && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {[[t.activeBusinesses, active], [t.archivedBusinesses, list.length - active], [t.totalPartners, uniquePartners]].map(([label, n]) => (
            <div key={String(label)} className="card p-4">
              <p className="text-sm text-muted">{label}</p>
              <p className="mt-1 text-2xl font-semibold">{fmtNum(Number(n), lang)}</p>
            </div>
          ))}
        </div>
      )}

      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-muted">{t.businesses}</h2>
      {list.length === 0 ? (
        <div className="card p-8 text-center text-sm text-muted">{isOwner ? t.noBusinessesOwner : t.noBusinessesPartner}</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((b) => (
            <Link key={b.id} href={`/b/${b.id}`} className="card block p-4 transition hover:border-ink">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{b.name}</h3>
                <span className={`rounded-full px-2 py-0.5 text-xs ${b.status === "active" ? "bg-green-50 text-profit" : "bg-canvas text-muted"}`}>
                  {b.status === "active" ? t.active : t.archived}
                </span>
              </div>
              {b.category && <p className="mt-1 text-sm text-muted">{b.category}</p>}
              <p className="mt-4 text-xs text-muted">{t.partners}: {fmtNum(countFor(b.id), lang)} · {fmtDate(b.created_at, lang)}</p>
            </Link>
          ))}
        </div>
      )}
      <p className="mt-8 text-xs text-muted">{t.financeComing}</p>
    </main>
  );
}
