import { BusinessForm } from "@/components/forms";
import { ActionButton } from "@/components/ui";
import { setBusinessStatus } from "@/app/actions";
import { getBusiness, getT, requireOwner } from "@/lib/session";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireOwner();
  const [business, { t }] = await Promise.all([getBusiness(id), getT()]);
  const archived = business.status === "archived";
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section className="card p-6">
        <h2 className="mb-4 font-semibold">{t.businessDetails}</h2>
        <BusinessForm t={t} business={business} disabled={archived} />
      </section>
      <section className="card p-6">
        <h2 className="font-semibold">{archived ? t.restoreBusiness : t.archiveBusiness}</h2>
        <p className="mt-1 mb-4 text-sm text-muted">{t.archiveHelp}</p>
        <ActionButton
          action={setBusinessStatus}
          fields={{ id, status: archived ? "active" : "archived" }}
          className={archived ? "btn-primary" : "btn-danger"}
          confirm={archived ? undefined : t.confirmArchive}
        >
          {archived ? t.restoreBusiness : t.archiveBusiness}
        </ActionButton>
      </section>
    </div>
  );
}
