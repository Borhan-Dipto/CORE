import { cookies } from "next/headers";
import { AppShell } from "@/components/shell/AppShell";
import { getBusinesses, getContext, getT, getTheme } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ user, isOwner, name, supabase }, { lang, t }, theme, businesses, jar] = await Promise.all([
    getContext(), getT(), getTheme(), getBusinesses(), cookies(),
  ]);
  const { count: unread } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  return (
    <AppShell t={t} lang={lang} theme={theme} isOwner={isOwner} user={{ name, email: user.email ?? "" }}
      businesses={businesses.map((b) => ({ id: b.id, name: b.name, status: b.status }))}
      initialCollapsed={jar.get("sidebar")?.value === "closed"} unread={unread ?? 0}>
      {children}
    </AppShell>
  );
}
