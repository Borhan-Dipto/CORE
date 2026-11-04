import Link from "next/link";
import { Logo } from "@/components/Brand";
import { LangToggle } from "@/components/LangToggle";
import { logout } from "@/app/actions";
import { getContext, getT } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [{ supabase, user, isOwner, profile }, { lang, t }] = await Promise.all([getContext(), getT()]);
  const { data: businesses } = await supabase.from("businesses").select("id, name, status").order("name");
  const name = profile?.full_name || user.email;
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Logo />
          <details className="relative ml-2">
            <summary className="btn-ghost cursor-pointer list-none px-3 py-1.5">
              {t.switchBusiness} <span aria-hidden>▾</span>
            </summary>
            <div className="absolute left-0 mt-1 w-64 overflow-hidden rounded-lg border border-line bg-white py-1 shadow-lg">
              <Link href="/" className="block px-3 py-2 text-sm font-medium hover:bg-canvas">{t.allBusinesses}</Link>
              <div className="my-1 border-t border-line" />
              {(businesses ?? []).map((b) => (
                <Link key={b.id} href={`/b/${b.id}`} className="flex items-center justify-between px-3 py-2 text-sm hover:bg-canvas">
                  <span className="truncate">{b.name}</span>
                  {b.status === "archived" && <span className="text-xs text-muted">{t.archived}</span>}
                </Link>
              ))}
              {isOwner && <>
                <div className="my-1 border-t border-line" />
                <Link href="/businesses/new" className="block px-3 py-2 text-sm hover:bg-canvas">+ {t.newBusiness}</Link>
              </>}
            </div>
          </details>
          <div className="ml-auto flex items-center gap-2">
            <LangToggle lang={lang} />
            <Link href="/account" className="hidden max-w-40 truncate text-sm text-muted hover:text-ink sm:block">{name}</Link>
            <form action={logout}><button className="btn-ghost px-3 py-1.5">{t.logout}</button></form>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
