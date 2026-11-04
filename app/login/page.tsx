import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/Brand";
import { LoginForm } from "@/components/forms";
import { LangToggle } from "@/components/LangToggle";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/session";

export const metadata = { title: "Login" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; link?: string }> }) {
  const { next = "/", link } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/");
  const { lang, t } = await getT();
  return (
    <AuthShell
      title={t.login}
      subtitle={t.appTagline}
      footer={<div className="flex items-center gap-4"><Link className="link" href="/forgot">{t.forgotPassword}</Link><LangToggle lang={lang} /></div>}
    >
      {link === "expired" && <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-pending">{t.err_invalid_invitation}</p>}
      <LoginForm t={t} next={next} />
    </AuthShell>
  );
}
