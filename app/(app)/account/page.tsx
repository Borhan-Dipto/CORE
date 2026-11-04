import { PasswordForm, ProfileForm } from "@/components/forms";
import { LangToggle } from "@/components/LangToggle";
import { getContext, getT } from "@/lib/session";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const [{ user, profile }, { lang, t }] = await Promise.all([getContext(), getT()]);
  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{t.account}</h1>
      <section className="card p-6">
        <h2 className="mb-4 font-semibold">{t.profile}</h2>
        <ProfileForm t={t} fullName={profile?.full_name ?? ""} email={user.email ?? ""} />
      </section>
      <section className="card flex items-center justify-between p-6">
        <h2 className="font-semibold">{t.language}</h2>
        <LangToggle lang={lang} />
      </section>
      <section className="card p-6">
        <h2 className="mb-4 font-semibold">{t.changePassword}</h2>
        <PasswordForm t={t} submitLabel={t.savePassword} />
      </section>
    </main>
  );
}
