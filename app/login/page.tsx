import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/shell/AuthShell";
import { AuthLang } from "@/components/shell/AuthLang";
import { LoginForm } from "@/components/forms/core";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/session";

export const metadata = { title: "Login" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; notice?: string }> }) {
  const { next = "/", notice } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (user) redirect(safe);
  const { lang, t } = await getT();
  return (
    <AuthShell t={t} title={t.welcomeBack} subtitle={t.loginSubtitle}
      footer={<div className="flex items-center justify-between"><Link className="font-medium text-foreground hover:underline" href="/forgot">{t.forgotPassword}</Link><AuthLang lang={lang} /></div>}>
      {notice === "confirmed" && <p className="mb-5 rounded-md border border-brand/25 bg-brand-soft px-3 py-2.5 text-[13px] text-brand">{t.confirmedNotice}</p>}
      <LoginForm t={t} next={safe} />
    </AuthShell>
  );
}
