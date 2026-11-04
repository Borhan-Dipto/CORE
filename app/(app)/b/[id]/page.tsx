import Link from "next/link";
import { getBusiness, getT } from "@/lib/session";
import { getMembers } from "@/lib/workspace";
import { fmtDate, fmtNum } from "@/lib/i18n";

export default async function WorkspaceDashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [business, members, { lang, t }] = await Promise.all([getBusiness(id), getMembers(id), getT()]);
  const hasSplit = members.some((m) => m.percentage !== null);
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section className="card p-6 lg:col-span-2">
        <h2 className="mb-4 font-semibold">{t.businessDetails}</h2>
        {business.description && <p className="mb-4 text-sm text-graphite">{business.description}</p>}
        <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          {[
            [t.status, business.status === "active" ? t.active : t.archived],
            [t.startDate, fmtDate(business.start_date, lang)],
            [t.fiscalStart, t.months[business.fiscal_year_start_month - 1]],
            [t.email, business.email || "—"],
            [t.phone, business.phone || "—"],
            [t.address, business.address || "—"],
          ].map(([k, v]) => (
            <div key={k}><dt className="text-muted">{k}</dt><dd className="font-medium">{v}</dd></div>
          ))}
        </dl>
        <p className="mt-6 border-t border-line pt-4 text-xs text-muted">{t.financeComing}</p>
      </section>
      <section className="card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">{t.profitSplit}</h2>
          <Link href={`/b/${id}/partners`} className="text-sm text-muted hover:text-ink">{t.partners} →</Link>
        </div>
        {!hasSplit && <p className="text-sm text-muted">{t.noSplit}</p>}
        <ul className="space-y-2">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-2 text-sm">
              <span className="truncate">{m.name}</span>
              <span className="font-medium">{m.percentage === null ? "—" : `${fmtNum(m.percentage, lang)}%`}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
