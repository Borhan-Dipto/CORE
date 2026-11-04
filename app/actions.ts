"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getT, siteUrl } from "@/lib/session";
import { errorKey, type Dict } from "@/lib/i18n";

export type FormState = { error?: string; ok?: string; link?: string; email?: string; checkEmail?: boolean };

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const opt = (fd: FormData, k: string) => str(fd, k) || null;
const safeNext = (n: string) => (n.startsWith("/") && !n.startsWith("//") ? n : "/");

async function fail(e: { message?: string; code?: string } | null): Promise<FormState> {
  const { t } = await getT();
  console.error("[CORE]", e?.code, e?.message);
  return { error: t[errorKey(e)] };
}
async function msg(key: keyof Dict) {
  const { t } = await getT();
  return t[key] as string;
}

// ---------- Auth ----------
export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: str(fd, "email").toLowerCase(), password: str(fd, "password") });
  if (error) return { error: await msg("invalidLogin") };
  redirect(safeNext(str(fd, "next")));
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function forgotPassword(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(str(fd, "email").toLowerCase(), {
    redirectTo: `${await siteUrl()}/auth/callback?next=/reset-password`,
  });
  return { ok: await msg("resetSent") }; // same reply whether or not the account exists
}

function checkPasswords(fd: FormData): keyof Dict | null {
  const p = str(fd, "password");
  if (p.length < 8) return "passwordTooShort";
  if (fd.has("confirm") && p !== str(fd, "confirm")) return "passwordsDontMatch";
  return null;
}

export async function setNewPassword(_: FormState, fd: FormData): Promise<FormState> {
  const bad = checkPasswords(fd);
  if (bad) return { error: await msg(bad) };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: str(fd, "password") });
  if (error) return fail(error);
  return { ok: await msg("passwordSaved") };
}

// ---------- Preferences ----------
export async function setLang(fd: FormData) {
  const lang = str(fd, "lang") === "en" ? "en" : "bn";
  (await cookies()).set("lang", lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) await supabase.from("profiles").update({ language: lang }).eq("id", user.id);
  revalidatePath("/", "layout");
}

export async function updateProfile(_: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { error } = await supabase.from("profiles").update({ full_name: opt(fd, "full_name") }).eq("id", user.id);
  if (error) return fail(error);
  revalidatePath("/", "layout");
  return { ok: await msg("saved") };
}

// ---------- Businesses ----------
function businessFields(fd: FormData) {
  const month = Number(str(fd, "fiscal_year_start_month")) || 7;
  return {
    name: str(fd, "name"),
    description: opt(fd, "description"),
    category: opt(fd, "category"),
    email: opt(fd, "email"),
    phone: opt(fd, "phone"),
    address: opt(fd, "address"),
    start_date: opt(fd, "start_date"),
    fiscal_year_start_month: Math.min(12, Math.max(1, month)),
  };
}

export async function createBusiness(_: FormState, fd: FormData): Promise<FormState> {
  const fields = businessFields(fd);
  if (!fields.name) return { error: await msg("err_name_required") };
  const supabase = await createClient();
  const { data, error } = await supabase.from("businesses").insert(fields).select("id").single();
  if (error) return fail(error);
  revalidatePath("/", "layout");
  redirect(`/b/${data.id}`);
}

export async function updateBusiness(_: FormState, fd: FormData): Promise<FormState> {
  const fields = businessFields(fd);
  if (!fields.name) return { error: await msg("err_name_required") };
  const supabase = await createClient();
  const { data, error } = await supabase.from("businesses").update(fields).eq("id", str(fd, "id")).eq("status", "active").select("id");
  if (error) return fail(error);
  if (!data?.length) return fail({ message: "not_authorized" });
  revalidatePath("/", "layout");
  return { ok: await msg("saved") };
}

export async function setBusinessStatus(fd: FormData) {
  const id = str(fd, "id");
  const status = str(fd, "status") === "archived" ? "archived" : "active";
  const supabase = await createClient();
  await supabase.from("businesses").update({ status }).eq("id", id);
  revalidatePath("/", "layout");
  redirect(`/b/${id}/settings`);
}

// ---------- Partners & invites ----------
export async function createInvite(_: FormState, fd: FormData): Promise<FormState> {
  const businessId = str(fd, "business_id");
  const email = str(fd, "email").toLowerCase();
  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("create_invitation", { p_business: businessId, p_email: email });
  if (error) return fail(error);
  revalidatePath(`/b/${businessId}/partners`);
  return { link: `${await siteUrl()}/invite/${token}`, email };
}

export async function revokeInvite(fd: FormData) {
  const supabase = await createClient();
  await supabase.rpc("revoke_invitation", { p_invitation: str(fd, "invitation_id") });
  revalidatePath(`/b/${str(fd, "business_id")}/partners`);
}

export async function removeMember(fd: FormData) {
  const supabase = await createClient();
  await supabase.rpc("remove_member", { p_member: str(fd, "member_id") });
  revalidatePath(`/b/${str(fd, "business_id")}`, "layout");
}

export async function rejoinAsPartner(fd: FormData) {
  const supabase = await createClient();
  await supabase.rpc("add_owner_membership", { p_business: str(fd, "business_id") });
  revalidatePath(`/b/${str(fd, "business_id")}`, "layout");
}

export async function saveProfitSplit(_: FormState, fd: FormData): Promise<FormState> {
  const businessId = str(fd, "business_id");
  const shares = fd.getAll("user_id").map((u, i) => ({
    user_id: String(u),
    percentage: Number(String(fd.getAll("percentage")[i] ?? "0").replace(/[^\d.]/g, "")) || 0,
  }));
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_profit_shares", {
    p_business: businessId, p_effective: str(fd, "effective_from"), p_shares: shares,
  });
  if (error) return fail(error);
  revalidatePath(`/b/${businessId}`, "layout");
  return { ok: await msg("splitSaved") };
}

// ---------- Invitation acceptance ----------
async function acceptAndGo(token: string): Promise<FormState> {
  const supabase = await createClient();
  const { data: businessId, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) return fail(error);
  revalidatePath("/", "layout");
  redirect(`/b/${businessId}`);
}

export async function acceptInvite(_: FormState, fd: FormData): Promise<FormState> {
  return acceptAndGo(str(fd, "token"));
}

export async function signupForInvite(_: FormState, fd: FormData): Promise<FormState> {
  const bad = checkPasswords(fd);
  if (bad) return { error: await msg(bad) };
  const token = str(fd, "token");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: str(fd, "email").toLowerCase(),
    password: str(fd, "password"),
    options: {
      data: { full_name: str(fd, "full_name") },
      emailRedirectTo: `${await siteUrl()}/auth/callback?next=/invite/${token}`,
    },
  });
  if (error) return fail(error);
  if (!data.session) return { checkEmail: true };
  return acceptAndGo(token);
}
