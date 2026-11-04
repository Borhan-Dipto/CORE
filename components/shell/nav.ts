import { LayoutDashboard, Building2, Receipt, Megaphone, Landmark, Wallet, ListOrdered, Users, History, Settings } from "lucide-react";
import type { Dict } from "@/lib/i18n";

export type NavItem = { href: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
export type NavSection = { label?: string; items: NavItem[] };

export function navSections(t: Dict, businessId: string | null, isOwner: boolean): NavSection[] {
  const global: NavSection = {
    items: [
      { href: "/", label: t.overview, icon: LayoutDashboard, exact: true },
      { href: "/businesses", label: t.businesses, icon: Building2 },
    ],
  };
  if (!businessId) return [global];
  const b = `/b/${businessId}`;
  return [
    global,
    {
      label: t.finance,
      items: [
        { href: b, label: t.dashboard, icon: LayoutDashboard, exact: true },
        { href: `${b}/expenses`, label: t.expenses, icon: Receipt },
        { href: `${b}/advertising`, label: t.advertising, icon: Megaphone },
        { href: `${b}/capital`, label: t.capital, icon: Landmark },
        { href: `${b}/accounts`, label: t.accounts, icon: Wallet },
        { href: `${b}/transactions`, label: t.transactions, icon: ListOrdered },
      ],
    },
    {
      label: t.manage,
      items: [
        { href: `${b}/partners`, label: t.partners, icon: Users },
        { href: `${b}/activity`, label: t.activity, icon: History },
        ...(isOwner ? [{ href: `${b}/settings`, label: t.settings, icon: Settings }] : []),
      ],
    },
  ];
}
