import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/forgot", "/auth", "/invite", "/reset-password", "/api/cron", "/api/hooks", "/manifest.webmanifest"];
const INVITE_COOKIE = "core_invite";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));
  const url = request.nextUrl.clone();

  // Visiting an invite link: remember it, so it is accepted whichever way the person signs in.
  const inviteMatch = path.match(/^\/invite\/([0-9a-f]{64})$/);
  if (inviteMatch) {
    response.cookies.set(INVITE_COOKIE, inviteMatch[1], { path: "/", httpOnly: true, sameSite: "lax", secure: true, maxAge: 60 * 60 * 24 * 7 });
  }

  // Signed in with a remembered invite: accept it once, then land in that business.
  const pending = request.cookies.get(INVITE_COOKIE)?.value;
  if (user && pending && !inviteMatch && request.method === "GET" && !path.startsWith("/auth")) {
    const { data: businessId } = await supabase.rpc("accept_invitation", { p_token: pending });
    url.pathname = businessId ? `/b/${businessId}` : path;
    url.search = "";
    const res = businessId ? NextResponse.redirect(url) : response;
    response.cookies.getAll().forEach((c) => res.cookies.set(c));
    res.cookies.delete(INVITE_COOKIE);
    return res;
  }

  if (!user && !isPublic) {
    url.pathname = "/login";
    url.search = path === "/" ? "" : `?next=${encodeURIComponent(path)}`;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
