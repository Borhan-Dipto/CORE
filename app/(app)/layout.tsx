import { cookies } from "next/headers";
import { AppShell } from "@/components/shell/AppShell";
import { getBusinesses, getContext, getT, getTheme } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ user, isOwner, name }, { lang, t }, theme, businesses, jar] = await Promise.all([
    getContext(), getT(), getTheme(), getBusinesses(), cookies(),
  ]);
  return (
    <AppShell t={t} lang={lang} theme={theme} isOwner={isOwner} user={{ name, email: user.email ?? "" }}
      businesses={businesses.map((b) => ({ id: b.id, name: b.name, status: b.status }))}
      initialCollapsed={jar.get("sidebar")?.value === "closed"}>
      {children}
    </AppShell>
  );
}
