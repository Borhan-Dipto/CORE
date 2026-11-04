import { InviteForm, SplitForm } from "@/components/forms";
import { ActionButton } from "@/components/ui";
import { rejoinAsPartner, removeMember, revokeInvite } from "@/app/actions";
import { getBusiness, getContext, getT } from "@/lib/session";
import { getMembers } from "@/lib/workspace";
import { fmtDate, fmtNum } from "@/lib/i18n";

export const metadata = { title: "Partners" };

export default async function PartnersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [business, members, { supabase, isOwner, user }, { lang, t }] = await Promise.all([
    getBusiness(id), getMembers(id), getContext(), getT(),
  ]);
  const canEdit = isOwner && business.status === "active";
  const { data: invites } = isOwner
    ? await supabase.from("business_invitations").select("id, email, expires_at, created_at")
        .eq("business_id", id).eq("status", "pending").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false })
    : { data: [] };
  const ownerIsMember = members.some((m) => m.user_id === user.id);
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section className="card">
          <h2 className="border-b border-line px-6 py-4 font-semibold">{t.partnerList} ({fmtNum(members.length, lang)})</h2>
          <ul className="divide-y divide-line">
            {members.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 px-6 py-4">
                <div className="grid size-9 shrink-0 place-items-center rounded-full bg-canvas text-sm font-semibold">
                  {m.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {m.name}
                    {(m.isOwner || (isOwner && m.user_id === user.id)) && <span className="ml-2 rounded bg-ink px-1.5 py-0.5 text-[10px] font-semibold text-white">{t.owner}</span>}
                  </p>
                  <p className="truncate text-xs text-muted">{m.email} · {t.joined} {fmtDate(m.joined_at, lang)}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="text-xs text-muted">{t.profitShare}</p>
                  <p className="font-semibold">{m.percentage === null ? "—" : `${fmtNum(m.percentage, lang)}%`}</p>
                </div>
                {canEdit && m.user_id !== user.id && (
                  <ActionButton action={removeMember} fields={{ member_id: m.id, business_id: id }} className="btn-danger px-3 py-1.5" confirm={t.confirmRemove}>
                    {t.remove}
                  </ActionButton>
                )}
              </li>
            ))}
          </ul>
          {canEdit && !ownerIsMember && (
            <div className="border-t border-line px-6 py-4">
              <ActionButton action={rejoinAsPartner} fields={{ business_id: id }}>{t.rejoinAsPartner}</ActionButton>
            </div>
          )}
        </section>

        {canEdit && (
          <section className="card p-6">
            <h2 className="font-semibold">{t.invitePartner}</h2>
            <p className="mt-1 mb-4 text-sm text-muted">{t.inviteHelp}</p>
            <InviteForm t={t} businessId={id} />
            <h3 className="mt-6 mb-2 text-sm font-semibold">{t.pendingInvites}</h3>
            {!invites?.length ? <p className="text-sm text-muted">{t.noPending}</p> : (
              <ul className="divide-y divide-line rounded-lg border border-line">
                {invites.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <span className="min-w-0 flex-1 truncate">{i.email}</span>
                    <span className="hidden text-xs text-muted sm:inline">{t.expires} {fmtDate(i.expires_at, lang)}</span>
                    <ActionButton action={revokeInvite} fields={{ invitation_id: i.id, business_id: id }} className="btn-ghost px-3 py-1.5">{t.revoke}</ActionButton>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>

      <section className="card h-fit p-6">
        <h2 className="font-semibold">{t.profitSplit}</h2>
        <p className="mt-1 mb-4 text-sm text-muted">{t.profitSplitHelp}</p>
        {canEdit && members.length > 0 ? (
          <SplitForm t={t} businessId={id} today={today}
            partners={members.map((m) => ({ user_id: m.user_id, name: m.name, percentage: m.percentage ?? 0 }))} />
        ) : (
          <ul className="space-y-2">
            {members.map((m) => (
              <li key={m.id} className="flex justify-between text-sm"><span>{m.name}</span><span className="font-medium">{m.percentage === null ? "—" : `${fmtNum(m.percentage, lang)}%`}</span></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
