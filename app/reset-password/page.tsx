import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/Brand";
import { PasswordForm } from "@/components/forms";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/session";

export const metadata = { title: "New password" };

export default async function ResetPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/forgot");
  const { t } = await getT();
  return (
    <AuthShell title={t.setNewPassword} footer={<Link className="link" href="/">{t.overview} →</Link>}>
      <PasswordForm t={t} submitLabel={t.savePassword} />
    </AuthShell>
  );
}
