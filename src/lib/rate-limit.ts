/**
 * Fixed-window in-memory rate limiter.
 *
 * Limitation: state is per server instance. On Vercel (many short-lived instances) this only slows
 * casual abuse. For real enforcement swap `store` for a shared store (e.g. Upstash Redis) behind the same
 * `rateLimit()` signature. See docs/SECURITY.md.
 */
interface Bucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, Bucket>();
const MAX_KEYS = 10_000;

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(key: string, limit: number, windowMs: number, now: number = Date.now()): RateLimitResult {
  if (store.size > MAX_KEYS) {
    for (const [k, b] of store) if (b.resetAt <= now) store.delete(k);
    if (store.size > MAX_KEYS) store.clear();
  }
  const bucket = store.get(key);
  if (!bucket || bucket.resetAt <= now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
  }
  return { ok: true, remaining: limit - bucket.count, retryAfterSeconds: 0 };
}

export function resetRateLimits(): void {
  store.clear();
}

export function clientIp(headers: Headers): string {
  const fwd = headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]?.trim() || "unknown";
  return headers.get("x-real-ip") ?? "unknown";
}
