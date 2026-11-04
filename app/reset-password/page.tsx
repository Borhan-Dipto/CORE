import { redirect } from "next/navigation";
import { AuthShell } from "@/components/shell/AuthShell";
import { PasswordForm } from "@/components/forms/core";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/session";

export const metadata = { title: "New password" };

export default async function ResetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/forgot");
  const { t } = await getT();
  return <AuthShell t={t} title={t.setNewPassword}><PasswordForm t={t} redirectTo="/" /></AuthShell>;
}
