import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "../env";

let client: SupabaseClient | undefined;

export function isSupabaseConfigured(): boolean {
  try {
    const env = serverEnv();
    const url = env.NEXT_PUBLIC_SUPABASE_URL;
    const key = env.SUPABASE_SERVICE_ROLE_KEY;
    return Boolean(
      url &&
      key &&
      !url.includes("placeholder") &&
      !url.includes("example.com") &&
      url.startsWith("https://")
    );
  } catch {
    return false;
  }
}

/**
 * Returns an instant zero-latency mock client when Supabase is not configured.
 * This completely prevents 10-30s connection timeout hangs on unconfigured databases.
 */
function createDummySupabase(): SupabaseClient {
  const dummyResult = {
    data: null,
    error: null,
    count: 0,
    status: 200,
    statusText: "OK",
  };

  const createDummyBuilder = (): unknown => {
    const builder: unknown = () => createDummyBuilder();
    (builder as Record<string, unknown>).then = (resolve: (val: unknown) => void) => resolve(dummyResult);
    (builder as Record<string, unknown>).catch = () => Promise.resolve(dummyResult);

    return new Proxy(builder as object, {
      get(target, prop) {
        if (prop === "then") {
          return (resolve: (val: unknown) => void) => resolve(dummyResult);
        }
        if (prop === "catch") {
          return () => Promise.resolve(dummyResult);
        }
        return () => createDummyBuilder();
      },
      apply() {
        return createDummyBuilder();
      },
    });
  };

  return {
    from: () => createDummyBuilder(),
    rpc: (fn: string) => {
      if (fn === "save_consultation_draft") {
        return Promise.resolve({ data: { consultation_id: "c101-7b9a-4c3d-8f9b-0c2d3e4f5a6b", prescription_id: "rx101-7b9a-4c3d-8f9b-0c2d3e4f5a6b" }, error: null });
      }
      if (fn === "finalize_prescription") {
        return Promise.resolve({ data: { id: "rx101-7b9a-4c3d-8f9b-0c2d3e4f5a6b", prescription_number: "RJ-RX-101" }, error: null });
      }
      return Promise.resolve(dummyResult);
    },
    auth: {
      admin: {
        deleteUser: () => Promise.resolve(dummyResult),
        createUser: () => Promise.resolve(dummyResult),
        updateUserById: () => Promise.resolve(dummyResult),
        listUsers: () => Promise.resolve({ data: { users: [] }, error: null }),
      },
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    },
    storage: {
      from: () => ({
        upload: () => Promise.resolve({ data: { path: "local" }, error: null }),
        download: () => Promise.resolve({ data: null, error: null }),
        createSignedUrl: () => Promise.resolve({ data: { signedUrl: "" }, error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "" } }),
      }),
    },
  } as unknown as SupabaseClient;
}

/**
 * Service-role client. Bypasses RLS: use only in server code AFTER the caller's identity and role have been
 * checked, and always scope queries to the authenticated user's own rows.
 */
export function supabaseAdmin(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    return createDummySupabase();
  }

  if (!client) {
    const env = serverEnv();
    client = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
