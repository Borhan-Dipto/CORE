import Link from "next/link";
import { AuthShell } from "@/components/shell/AuthShell";
import { ForgotForm } from "@/components/forms/core";
import { getT } from "@/lib/session";

export const metadata = { title: "Reset password" };

export default async function ForgotPage() {
  const { t } = await getT();
  return (
    <AuthShell t={t} title={t.forgotPassword} footer={<Link className="font-medium text-foreground hover:underline" href="/login">← {t.backToLogin}</Link>}>
      <ForgotForm t={t} />
    </AuthShell>
  );
}
