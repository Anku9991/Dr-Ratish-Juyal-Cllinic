export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; code: string; message: string; fieldErrors?: Record<string, string> };

export async function api<T = Record<string, unknown>>(url: string, method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
    const json = (await res.json().catch(() => ({}))) as { error?: { code?: string; message?: string; details?: unknown } } & T;
    if (!res.ok) {
      const details = json.error?.details;
      return {
        ok: false,
        status: res.status,
        code: json.error?.code ?? "error",
        message: json.error?.message ?? "Something went wrong. Please try again.",
        fieldErrors: details && typeof details === "object" ? (details as Record<string, string>) : undefined,
      };
    }
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, status: 0, code: "network", message: "Could not reach the server. Check your connection and try again." };
  }
}
