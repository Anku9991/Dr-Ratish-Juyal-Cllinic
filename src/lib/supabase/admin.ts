import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "../env";

let client: SupabaseClient | undefined;

/**
 * Service-role client. Bypasses RLS: use only in server code AFTER the caller's identity and role have been
 * checked, and always scope queries to the authenticated user's own rows.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!client) {
    const env = serverEnv();
    const url = env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
    const key = env.SUPABASE_SERVICE_ROLE_KEY || "dummy-service-role-key-for-development";
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
