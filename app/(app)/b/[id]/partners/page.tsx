import { Clock, Mail } from "lucide-react";
import { Page, Notice } from "@/components/shell/Page";
import { InviteDialog, PendingInviteActions, RejoinButton, RemoveMemberButton, SplitForm } from "@/components/forms/core";
import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { loadBizPage } from "@/lib/bizpage";
import { getContext } from "@/lib/session";
import { getPendingInvites } from "@/lib/workspace";
import { todayDhaka } from "@/lib/range";
import { fmtDate, fmtMoney, fmtNum } from "@/lib/i18n";

export const metadata = { title: "Partners" };

export default async function PartnersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [p, { user }, invites] = await Promise.all([loadBizPage(id), getContext(), getPendingInvites(id)]);
  const { t, lang, members, business } = p;
  const ownerIsMember = members.some((m) => m.user_id === user.id);
  return (
    <Page wide title={t.partners} actions={p.writable && <InviteDialog t={t} businessId={id} businessName={business.name} />}>
      {!p.writable && <Notice tone="info">{t.readOnlyNote}</Notice>}
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="grid h-fit gap-6">
          <Card className="overflow-hidden">
            <CardHeader><CardTitle>{t.partnerList} <span className="ml-1 text-muted-foreground">{fmtNum(members.length + invites.length, lang)}</span></CardTitle></CardHeader>
            <ul className="mt-4 divide-y divide-border border-t border-border">
              {members.map((m) => (
                <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <Avatar name={m.name} seed={m.email} size="lg" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-medium">{m.name}{m.isOwner && <Badge variant="solid">{t.owner}</Badge>}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.email} · {t.joined} {fmtDate(m.joined_at, lang)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-6 text-right">
                    <div><p className="text-[11px] text-muted-foreground">{t.profitShare}</p><p className="tabular text-sm font-semibold">{m.percentage === null ? "—" : `${fmtNum(m.percentage, lang)}%`}</p></div>
                    <div><p className="text-[11px] text-muted-foreground">{t.capitalBalance}</p><p className="tabular text-sm font-semibold">{fmtMoney(m.capital, lang, { compact: true })}</p></div>
                  </div>
                  {p.writable && m.user_id !== user.id && <RemoveMemberButton t={t} memberId={m.id} businessId={id} name={m.name} />}
                </li>
              ))}
              {invites.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center gap-3 bg-muted/30 px-5 py-4">
                  <div className="flex size-10 items-center justify-center rounded-full border border-dashed border-border bg-card"><Mail className="size-4 text-muted-foreground" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate font-medium">{i.email}<Badge variant="warning"><Clock /> {t.awaiting}</Badge></p>
                    <p className="text-xs text-muted-foreground">{t.invited} {fmtDate(i.created_at, lang)} · {t.expires} {fmtDate(i.expires_at, lang)}</p>
                  </div>
                  {p.writable && <PendingInviteActions t={t} id={i.id} businessId={id} email={i.email} businessName={business.name} />}
                </li>
              ))}
            </ul>
            {p.writable && !ownerIsMember && <div className="border-t border-border px-5 py-4"><RejoinButton t={t} businessId={id} /></div>}
          </Card>
        </div>
        <Card className="h-fit">
          <CardHeader><CardTitle>{t.profitSplit}</CardTitle><CardDescription>{t.profitSplitHelp}</CardDescription></CardHeader>
          <CardContent>
            {p.writable && members.length > 0 ? (
              <SplitForm t={t} lang={lang} businessId={id} today={todayDhaka()}
                partners={members.map((m) => ({ user_id: m.user_id, name: m.name, percentage: m.percentage ?? 0 }))} />
            ) : (
              <ul className="grid gap-3">{members.map((m) => (
                <li key={m.id} className="flex items-center gap-3 text-sm"><Avatar name={m.name} seed={m.email} size="sm" /><span className="flex-1 truncate">{m.name}</span>
                  <span className="tabular font-semibold">{m.percentage === null ? "—" : `${fmtNum(m.percentage, lang)}%`}</span></li>
              ))}</ul>
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
