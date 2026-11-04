import { Archive } from "lucide-react";
import { getBusiness, getT } from "@/lib/session";

export default async function WorkspaceLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [business, { t }] = await Promise.all([getBusiness(id), getT()]);
  return (
    <>
      {business.status === "archived" && (
        <div className="flex items-center justify-center gap-2 border-b border-warning/25 bg-warning-soft px-4 py-2 text-[13px] text-warning">
          <Archive className="size-4" /> {t.archivedNotice}
        </div>
      )}
      {children}
    </>
  );
}
