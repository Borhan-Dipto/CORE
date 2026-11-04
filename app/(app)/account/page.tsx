import { Page } from "@/components/shell/Page";
import { PasswordForm, ProfileForm } from "@/components/forms/core";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getContext, getT } from "@/lib/session";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const [{ user, profile }, { t }] = await Promise.all([getContext(), getT()]);
  return (
    <Page title={t.account} className="max-w-3xl">
      <Card><CardHeader><CardTitle>{t.profile}</CardTitle></CardHeader><CardContent><ProfileForm t={t} fullName={profile?.full_name ?? ""} email={user.email ?? ""} /></CardContent></Card>
      <Card><CardHeader><CardTitle>{t.security}</CardTitle><CardDescription>{t.changePassword}</CardDescription></CardHeader><CardContent><PasswordForm t={t} /></CardContent></Card>
    </Page>
  );
}
