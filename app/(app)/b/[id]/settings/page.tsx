import { Page } from "@/components/shell/Page";
import { ArchiveButton, BusinessEditForm } from "@/components/forms/core";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBusiness, getT, requireOwner } from "@/lib/session";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireOwner();
  const [business, { t }] = await Promise.all([getBusiness(id), getT()]);
  const archived = business.status === "archived";
  return (
    <Page title={t.settings} className="max-w-3xl">
      <Card><CardHeader><CardTitle>{t.businessDetails}</CardTitle></CardHeader><CardContent><BusinessEditForm t={t} business={business} disabled={archived} /></CardContent></Card>
      <Card className={archived ? "" : "border-destructive/25"}>
        <CardHeader><CardTitle>{archived ? t.restoreBusiness : t.archiveBusiness}</CardTitle><CardDescription>{t.archiveHelp}</CardDescription></CardHeader>
        <CardContent><ArchiveButton t={t} id={id} archived={archived} /></CardContent>
      </Card>
    </Page>
  );
}
