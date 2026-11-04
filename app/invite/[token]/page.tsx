import Link from "next/link";
import { AuthShell } from "@/components/Brand";
import { AcceptForm, LoginForm, SignupForm } from "@/components/forms";
import { logout } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/session";

export const metadata = { title: "Invitation" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const { t } = await getT();
  const supabase = await createClient();
  const [{ data: rows }, { data: { user } }] = await Promise.all([
    supabase.rpc("invitation_info", { p_token: token }),
    supabase.auth.getUser(),
  ]);
  const inv = rows?.[0] as { business_name: string; email: string; status: string; expired: boolean } | undefined;

  const problem = !inv ? t.inviteInvalid
    : inv.status === "accepted" ? t.inviteUsed
    : inv.status === "revoked" ? t.inviteRevokedMsg
    : inv.status === "expired" || inv.expired ? t.inviteExpiredMsg : null;

  if (!inv || problem) {
    return <AuthShell title={t.invitePartner} footer={<Link className="link" href="/login">{t.backToLogin}</Link>}>
      <p className="text-sm">{problem}</p>
    </AuthShell>;
  }

  const sameUser = user?.email?.toLowerCase() === inv.email;
  return (
    <AuthShell title={`${t.invitedTo} ${inv.business_name}`} subtitle={`${t.invitedAs}: ${inv.email}`}>
      {user ? (
        sameUser ? <AcceptForm t={t} token={token} /> : (
          <div className="space-y-4 text-sm">
            <p>{t.loggedInAs} <strong>{user.email}</strong>. {t.wrongAccount}</p>
            <form action={logout}><button className="btn-ghost w-full">{t.logout}</button></form>
          </div>
        )
      ) : (
        <div className="space-y-6">
          <section>
            <h2 className="mb-3 text-sm font-semibold">{t.noAccount}</h2>
            <SignupForm t={t} token={token} email={inv.email} />
          </section>
          <section className="border-t border-line pt-6">
            <h2 className="mb-3 text-sm font-semibold">{t.haveAccount}</h2>
            <LoginForm t={t} next={`/invite/${token}`} />
          </section>
        </div>
      )}
    </AuthShell>
  );
}
