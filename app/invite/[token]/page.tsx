import Link from "next/link";
import { AuthShell } from "@/components/shell/AuthShell";
import { AcceptForm, InviteAuth } from "@/components/forms/core";
import { Button } from "@/components/ui/button";
import { logout } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/session";

export const metadata = { title: "Invitation" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { t } = await getT();
  const supabase = await createClient();
  const [{ data: rows }, { data: { user } }] = await Promise.all([supabase.rpc("invitation_info", { p_token: token }), supabase.auth.getUser()]);
  const inv = rows?.[0] as { business_name: string; email: string; status: string; expired: boolean } | undefined;
  const problem = !inv ? t.inviteInvalid : inv.status === "accepted" ? t.inviteUsed : inv.status === "revoked" ? t.inviteRevokedMsg
    : inv.status === "expired" || inv.expired ? t.inviteExpiredMsg : null;

  if (!inv || problem) {
    return (
      <AuthShell t={t} title={t.invitePartner} footer={<Link className="font-medium text-foreground hover:underline" href="/login">← {t.backToLogin}</Link>}>
        <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-3 text-[13px] text-warning">{problem}</p>
      </AuthShell>
    );
  }
  const sameUser = user?.email?.toLowerCase() === inv.email;
  return (
    <AuthShell t={t} title={`${t.invitedTo} ${inv.business_name}`} subtitle={`${t.invitedAs}: ${inv.email}`}>
      {user ? (sameUser ? <AcceptForm t={t} token={token} /> : (
        <div className="grid gap-4 text-sm">
          <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-3 text-[13px] text-warning">{t.loggedInAs} <strong>{user.email}</strong>. {t.wrongAccount}</p>
          <form action={logout}><Button variant="outline" className="w-full">{t.logout}</Button></form>
        </div>
      )) : <InviteAuth t={t} token={token} email={inv.email} />}
    </AuthShell>
  );
}
