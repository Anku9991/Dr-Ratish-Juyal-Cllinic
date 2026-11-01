import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "./supabase/server";
import { supabaseAdmin } from "./supabase/admin";
import { ROLE_HOME } from "./permissions";
import type { Role } from "./status";

export interface SessionUser {
  id: string;
  email: string | null;
  role: Role;
  fullName: string;
  mobile: string | null;
  permissions: string[];
}

/**
 * Identity comes from the verified Supabase session (auth.getUser validates the JWT with the auth server);
 * the ROLE comes from the profiles table, never from client-editable metadata.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
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
});

/** For layouts/pages: redirects instead of throwing. */
export async function requirePageRole(role: Role): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect(ROLE_HOME[user.role]);
  return user;
}

export async function getPatientId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from("patients").select("id").eq("profile_id", userId).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

export async function getDoctorId(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin().from("doctors").select("id").eq("profile_id", userId).eq("is_active", true).maybeSingle();
  return (data?.id as string | undefined) ?? null;
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
