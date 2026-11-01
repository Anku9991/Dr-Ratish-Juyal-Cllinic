import { route } from "@/lib/api";
import { createSupabaseServer } from "@/lib/supabase/server";

export const POST = route({}, async () => {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  return { ok: true };
});
