import { WorkspaceNav } from "@/components/WorkspaceNav";
import { getBusiness, getContext, getT } from "@/lib/session";

export default async function WorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [business, { isOwner }, { t }] = await Promise.all([getBusiness(id), getContext(), getT()]);
  const base = `/b/${id}`;
  const items = [
    { href: base, label: t.dashboard },
    { href: `${base}/partners`, label: t.partners },
    { href: `${base}/activity`, label: t.activity },
    ...(isOwner ? [{ href: `${base}/settings`, label: t.settings }] : []),
  ];
  return (
    <div>
      <div className="border-b border-line bg-white">
        <div className="mx-auto max-w-6xl px-4 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{business.name}</h1>
            {business.status === "archived" && <span className="rounded-full bg-canvas px-2 py-0.5 text-xs text-muted">{t.archived}</span>}
          </div>
          {business.category && <p className="mt-1 text-sm text-muted">{business.category}</p>}
          <div className="mt-4"><WorkspaceNav items={items} /></div>
        </div>
      </div>
      {business.status === "archived" && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-pending">{t.archivedNotice}</div>
      )}
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
