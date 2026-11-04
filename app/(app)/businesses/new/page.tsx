import { BusinessForm } from "@/components/forms";
import { getT, requireOwner } from "@/lib/session";

export const metadata = { title: "New business" };

export default async function NewBusinessPage() {
  await requireOwner();
  const { t } = await getT();
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">{t.newBusiness}</h1>
      <div className="card p-6"><BusinessForm t={t} /></div>
    </main>
  );
}
