import "server-only";
import { cookies, headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { dict, type Lang } from "@/lib/i18n";

export type Theme = "light" | "dark" | "system";

export async function getLang(): Promise<Lang> {
  return (await cookies()).get("lang")?.value === "en" ? "en" : "bn";
}
export async function getTheme(): Promise<Theme> {
  const v = (await cookies()).get("theme")?.value;
  return v === "dark" || v === "system" ? v : "light";
}
export async function getT() {
  const lang = await getLang();
  return { lang, t: dict[lang] };
}

export type Business = {
  id: string; name: string; description: string | null; category: string | null; email: string | null;
  phone: string | null; address: string | null; start_date: string | null; fiscal_year_start_month: number;
  status: "active" | "archived"; created_at: string;
};

/** Current user + owner flag. Redirects to /login when signed out. Cached per request. */
export const getContext = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: isOwner }, { data: profile }] = await Promise.all([
    supabase.rpc("is_platform_owner"),
    supabase.from("profiles").select("full_name, email, language, theme").eq("id", user.id).maybeSingle(),
  ]);
  return { supabase, user, isOwner: !!isOwner, profile, name: profile?.full_name || user.email || "" };
});

export async function requireOwner() {
  const ctx = await getContext();
  if (!ctx.isOwner) notFound();
  return ctx;
}

export const getBusinesses = cache(async () => {
  const { supabase } = await getContext();
  const { data } = await supabase.from("businesses").select("id, name, category, status, created_at").order("status").order("name");
  return (data ?? []) as Pick<Business, "id" | "name" | "category" | "status" | "created_at">[];
});

/** Business visible to the current user (RLS decides). 404 when not visible. */
export const getBusiness = cache(async (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await getContext();
  const { data } = await supabase.from("businesses").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return data as Business;
});

/** Owner may write only while the business is active. */
export async function canWrite(b: Business) {
  const { isOwner } = await getContext();
  return isOwner && b.status === "active";
}

export async function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
}
