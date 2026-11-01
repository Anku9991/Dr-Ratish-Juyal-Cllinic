import { route } from "@/lib/api";
import { HttpError } from "@/lib/errors";
import { registerSchema } from "@/lib/validation";
import { createSupabaseServer } from "@/lib/supabase/server";

export const POST = route({ schema: registerSchema, limit: { name: "register", max: 5, windowMs: 10 * 60_000 } }, async ({ body }) => {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email: body.email,
    password: body.password,
    options: { data: { full_name: body.fullName, mobile: body.mobile } },
  });
  if (error) {
    // Deliberately vague: do not reveal which of email/mobile is already registered.
    throw new HttpError(400, "signup_failed", "We could not create your account. The email or mobile number may already be in use.");
  }
  return { needsEmailConfirmation: !data.session };
});
