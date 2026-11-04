import Link from "next/link";
import { AuthShell } from "@/components/Brand";
import { ForgotForm } from "@/components/forms";
import { getT } from "@/lib/session";

export const metadata = { title: "Reset password" };

export default async function ForgotPage() {
  const { t } = await getT();
  return (
    <AuthShell title={t.forgotPassword} footer={<Link className="link" href="/login">{t.backToLogin}</Link>}>
      <ForgotForm t={t} />
    </AuthShell>
  );
}
