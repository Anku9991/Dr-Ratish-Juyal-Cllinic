import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import { HttpError } from "./errors";

/**
 * Creates a Supabase Auth user, then promotes the auto-created patient profile to `role`.
 * The signup trigger always starts everyone as a patient; only this server-side path can promote.
 */
export async function createStaffUser(input: {
  email: string;
  password: string;
  fullName: string;
  mobile?: string;
  role: "doctor" | "admin";
  permissions?: string[];
}): Promise<string> {
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName, mobile: input.mobile ?? "" },
  });
  if (error || !data.user) {
    throw new HttpError(409, "user_exists", "A user with that email or mobile number already exists.");
  }
  const id = data.user.id;
  const rollback = async () => {
    await admin.auth.admin.deleteUser(id);
  };
  const up = await admin.from("profiles").update({ role: input.role, permissions: input.permissions ?? [] }).eq("id", id);
  if (up.error) {
    await rollback();
    throw new HttpError(500, "database_error", "Could not set up the account.");
  }
  await admin.from("patients").delete().eq("profile_id", id);
  return id;
}

export async function deleteAuthUser(id: string): Promise<void> {
  await supabaseAdmin().auth.admin.deleteUser(id);
}
