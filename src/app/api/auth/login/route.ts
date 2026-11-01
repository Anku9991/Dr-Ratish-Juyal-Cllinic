import { route } from "@/lib/api";
import { HttpError } from "@/lib/errors";
import { loginSchema } from "@/lib/validation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { ROLE_HOME, safeNextPath, canAccessPath } from "@/lib/permissions";
import { rateLimit } from "@/lib/rate-limit";
import type { Role } from "@/lib/status";

export const POST = route({ schema: loginSchema, limit: { name: "login", max: 10, windowMs: 15 * 60_000 } }, async ({ body }) => {
  // Second limiter per account so a botnet cannot hammer one email from many IPs on one instance.
  const perEmail = rateLimit(`login-email:${body.email}`, 8, 15 * 60_000);
  if (!perEmail.ok) throw new HttpError(429, "rate_limited", "Too many attempts. Please wait a few minutes and try again.");

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword({ email: body.email, password: body.password });
  if (error || !data.user) throw new HttpError(401, "invalid_credentials", "Incorrect email or password.");

  const { data: profile } = await supabaseAdmin().from("profiles").select("role, is_active").eq("id", data.user.id).maybeSingle();
  if (!profile || !profile.is_active) {
    await supabase.auth.signOut();
    throw new HttpError(403, "account_disabled", "This account is not active. Please contact the clinic.");
  }
  const role = profile.role as Role;
  const next = safeNextPath(body.next);
  return { redirect: next && canAccessPath(role, next) ? next : ROLE_HOME[role] };
});
