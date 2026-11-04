import { Page } from "@/components/shell/Page";
import { ArchiveButton, BusinessEditForm, DeleteBusinessButton } from "@/components/forms/core";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getBusiness, getContext, getT, requireOwner } from "@/lib/session";
import { InvoiceSettingsForm } from "@/components/documents";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireOwner();
  const { supabase } = await getContext();
  const [business, { t }, { data: inv }] = await Promise.all([getBusiness(id), getT(),
    supabase.from("business_invoice_settings").select("logo_data, tagline, website, payment_info, policy_note, thank_you, signatory").eq("business_id", id).maybeSingle()]);
  const archived = business.status === "archived";
  return (
    <Page title={t.settings} className="max-w-3xl">
      <Card><CardHeader><CardTitle>{t.businessDetails}</CardTitle></CardHeader><CardContent><BusinessEditForm t={t} business={business} disabled={archived} /></CardContent></Card>
      <Card id="invoice"><CardHeader><CardTitle>{t.invoiceSettings}</CardTitle><CardDescription>{t.invoiceSettingsHelp}</CardDescription></CardHeader>
        <CardContent><InvoiceSettingsForm t={t} businessId={id} settings={inv} disabled={archived} /></CardContent></Card>
      <Card className={archived ? "" : "border-destructive/25"}>
        <CardHeader><CardTitle>{archived ? t.restoreBusiness : t.archiveBusiness}</CardTitle><CardDescription>{t.archiveHelp}</CardDescription></CardHeader>
        <CardContent><ArchiveButton t={t} id={id} archived={archived} /></CardContent>
      </Card>
      <Card className="border-destructive/40">
        <CardHeader><CardTitle className="text-destructive">{t.deleteZone}</CardTitle><CardDescription>{t.deleteZoneHelp}</CardDescription></CardHeader>
        <CardContent><DeleteBusinessButton t={t} id={id} name={business.name} /></CardContent>
      </Card>
    </Page>
  );
}
