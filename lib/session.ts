import "server-only";
import { cookies, headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { dict, type Lang } from "@/lib/i18n";

export async function getLang(): Promise<Lang> {
  const v = (await cookies()).get("lang")?.value;
  return v === "en" ? "en" : "bn";
}

export async function getT() {
  const lang = await getLang();
  return { lang, t: dict[lang] };
}

export type Business = {
  id: string; name: string; description: string | null; category: string | null;
  email: string | null; phone: string | null; address: string | null; start_date: string | null;
  fiscal_year_start_month: number; status: "active" | "archived"; created_at: string;
};

/** Current user + owner flag. Redirects to /login when signed out. Cached per request. */
export const getContext = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const [{ data: isOwner }, { data: profile }] = await Promise.all([
    supabase.rpc("is_platform_owner"),
    supabase.from("profiles").select("full_name, email, language").eq("id", user.id).maybeSingle(),
  ]);
  return { supabase, user, isOwner: !!isOwner, profile };
});

export async function requireOwner() {
  const ctx = await getContext();
  if (!ctx.isOwner) notFound();
  return ctx;
}

/** Business visible to the current user (RLS decides). 404 when not visible. */
export const getBusiness = cache(async (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await getContext();
  const { data } = await supabase.from("businesses").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return data as Business;
});

export async function siteUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}
