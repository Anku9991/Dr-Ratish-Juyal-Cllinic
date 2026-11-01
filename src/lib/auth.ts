import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "./supabase/server";
import { supabaseAdmin } from "./supabase/admin";
import { ROLE_HOME } from "./permissions";
import type { Role } from "./status";
import { SESSION_COOKIE_NAME, verifySessionToken } from "./auth-session";
import { DR_RATISH_JUYAL_ID, PHYSIOTHERAPIST_ID } from "./firebase/data";

export interface SessionUser {
  id: string;
  email: string | null;
  role: Role;
  fullName: string;
  mobile: string | null;
  permissions: string[];
}

/**
 * Identity comes from the verified Google/Firebase session token or fallback Supabase session.
 * The ROLE comes from cryptographically verified token claims or profiles table.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // 1. Check Google / Firebase session token cookie first
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (sessionCookie) {
      const verified = await verifySessionToken(sessionCookie);
      if (verified) {
        return {
          id: verified.id,
          email: verified.email,
          role: verified.role,
          fullName: verified.fullName,
          mobile: null,
          permissions: verified.permissions || [],
        };
      }
    }
  } catch {
    // Continue to Supabase fallback
  }

  // 2. Supabase fallback
  try {
    const supabase = await createSupabaseServer();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;

    const { data: profile } = await supabaseAdmin()
      .from("profiles")
      .select("id, role, full_name, mobile, email, is_active, permissions")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!profile || !profile.is_active) return null;
    return {
      id: profile.id as string,
      email: (profile.email as string | null) ?? data.user.email ?? null,
      role: profile.role as Role,
      fullName: profile.full_name as string,
      mobile: (profile.mobile as string | null) ?? null,
      permissions: (profile.permissions as string[] | null) ?? [],
    };
  } catch {
    return null;
  }
});

/** For layouts/pages: redirects instead of throwing. */
export async function requirePageRole(role: Role): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect(ROLE_HOME[user.role]);
  return user;
}

export async function getPatientId(userId: string): Promise<string | null> {
  try {
    const { data } = await supabaseAdmin().from("patients").select("id").eq("profile_id", userId).maybeSingle();
    if (data?.id) return data.id as string;
  } catch {
    // Supabase optional
  }
  return userId;
}

export async function getDoctorId(userId: string): Promise<string | null> {
  if (userId === PHYSIOTHERAPIST_ID) return PHYSIOTHERAPIST_ID;
  if (userId === DR_RATISH_JUYAL_ID) return DR_RATISH_JUYAL_ID;

  try {
    const { data } = await supabaseAdmin()
      .from("doctors")
      .select("id")
      .eq("profile_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (data?.id) return data.id as string;
  } catch {
    // Supabase optional
  }

  // Default to Dr. Ratish Juyal for doctors
  return DR_RATISH_JUYAL_ID;
}

export async function requirePatientId(user: SessionUser): Promise<string> {
  const id = await getPatientId(user.id);
  if (!id) redirect("/login");
  return id;
}

export async function requireDoctorId(user: SessionUser): Promise<string> {
  const id = await getDoctorId(user.id);
  if (!id) redirect("/login");
  return id;
}
