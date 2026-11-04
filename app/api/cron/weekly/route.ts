import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendAll, type Outgoing } from "@/lib/notify/mail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel Cron (Saturdays 09:00 Dhaka). Vercel sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new NextResponse("Unauthorized", { status: 401 });
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("weekly_digest", { p_token: secret });
  if (error) { console.error("[CORE] weekly", error.message); return NextResponse.json({ ok: false }, { status: 500 }); }
  const list = (data ?? []) as Outgoing[];
  const failed = await sendAll(list);
  return NextResponse.json({ ok: true, sent: list.length - failed.length, failed: failed.length });
}
