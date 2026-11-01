import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { requiredRoleForPath, ROLE_HOME } from "../permissions";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../auth-session";

/** Refreshes the auth session cookie and sends signed-out visitors away from protected areas. */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;
  const requiredRole = requiredRoleForPath(pathname);

  // If public route, allow immediately
  if (!requiredRole) return response;

  // 1. Check Google / Firebase session token cookie first
  const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sessionToken) {
    const session = await verifySessionToken(sessionToken);
    if (session) {
      if (session.role === requiredRole) {
        return response;
      }
      // Logged in but accessing different role's area (e.g. Patient trying to access /doctor)
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = ROLE_HOME[session.role];
      return NextResponse.redirect(redirectUrl);
    }
  }

  // 2. Check Supabase session fallback
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anon && !url.includes("placeholder")) {
    try {
      const supabase = createServerClient(url, anon, {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(list) {
            for (const { name, value } of list) request.cookies.set(name, value);
            for (const { name, value, options } of list) response.cookies.set(name, value, options);
          },
        },
      });

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        return response;
      }
    } catch {
      // Ignore supabase error
    }
  }

  // Not authenticated for protected path
  const login = request.nextUrl.clone();
  login.pathname = "/login";
  login.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(login);
}
