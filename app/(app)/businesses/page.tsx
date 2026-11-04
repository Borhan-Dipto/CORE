import Link from "next/link";
import { Building2 } from "lucide-react";
import { Page, EmptyState } from "@/components/shell/Page";
import { NewBusinessDialog } from "@/components/forms/core";
import { Badge, Card } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { getBusinesses, getContext, getT } from "@/lib/session";
import { fmtDate } from "@/lib/i18n";

export const metadata = { title: "Businesses" };

export default async function BusinessesPage() {
  const [{ isOwner }, { lang, t }, list] = await Promise.all([getContext(), getT(), getBusinesses()]);
  return (
    <Page title={t.businesses} actions={isOwner ? <NewBusinessDialog t={t} /> : undefined}>
      {list.length === 0 ? (
        <EmptyState icon={Building2} title={isOwner ? t.newBusiness : t.noBusinessesPartner} description={isOwner ? t.noBusinessesOwner : undefined} />
      ) : (
        <Card className="divide-y divide-border overflow-hidden">
          {list.map((b) => (
            <Link key={b.id} href={`/b/${b.id}`} className="flex items-center gap-3 px-5 py-4 transition hover:bg-muted/40">
              <Avatar name={b.name} seed={b.id} size="lg" square />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{b.name}</p>
                <p className="truncate text-xs text-muted-foreground">{[b.category, fmtDate(b.created_at, lang)].filter(Boolean).join(" · ")}</p>
              </div>
              <Badge variant={b.status === "active" ? "success" : "neutral"}>{b.status === "active" ? t.active : t.archived}</Badge>
            </Link>
          ))}
        </Card>
      )}
    </Page>
  );
}
