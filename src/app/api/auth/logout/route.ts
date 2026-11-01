import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { createSupabaseServer } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createSupabaseServer();
    await supabase.auth.signOut();
  } catch {
    // Ignore if supabase is not initialized
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  return response;
}
