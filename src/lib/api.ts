import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { HttpError } from "./errors";
import { getSessionUser, getDoctorId, getPatientId, type SessionUser } from "./auth";
import { clientIp, rateLimit } from "./rate-limit";
import { fieldErrors } from "./validation";
import { hasPermission, type AdminPermission } from "./permissions";
import type { Role } from "./status";

const MAX_BODY_BYTES = 256 * 1024;

export interface RouteOptions<S extends z.ZodTypeAny | undefined> {
  /** Allowed roles. Omit for public endpoints. */
  roles?: Role[];
  /** Extra explicit permission (admin only). */
  permission?: AdminPermission;
  schema?: S;
  limit?: { name: string; max: number; windowMs: number; by?: "ip" | "user" };
  /** Webhooks/cron authenticate by signature/secret instead of cookies. */
  skipOriginCheck?: boolean;
}

export interface HandlerCtx<S extends z.ZodTypeAny | undefined> {
  req: NextRequest;
  user: SessionUser | null;
  body: S extends z.ZodTypeAny ? z.infer<S> : undefined;
  params: Record<string, string>;
  ip: string;
  /** Resolves the caller's patient id (patients only) */
  patientId: () => Promise<string>;
  /** Resolves the caller's doctor id (doctors only) */
  doctorId: () => Promise<string>;
}

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Cross-site request check for cookie-authenticated mutations (defense in depth on top of SameSite cookies). */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser clients / same-origin GET navigations
  try {
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function errorResponse(err: unknown): NextResponse {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: { code: err.code, message: err.message, details: err.details } }, { status: err.status });
  }
  if (err instanceof z.ZodError) {
    return NextResponse.json(
      { error: { code: "validation_failed", message: "Please check the highlighted fields.", details: fieldErrors(err) } },
      { status: 422 },
    );
  }
  // Never log request bodies, tokens or medical data.
  console.error("Unhandled API error:", err instanceof Error ? `${err.name}: ${err.message}` : "unknown");
  return NextResponse.json({ error: { code: "internal_error", message: "Something went wrong. Please try again." } }, { status: 500 });
}

export function route<S extends z.ZodTypeAny | undefined = undefined>(
  opts: RouteOptions<S>,
  handler: (ctx: HandlerCtx<S>) => Promise<unknown>,
) {
  return async (req: NextRequest, routeCtx: { params: Promise<Record<string, string>> }): Promise<Response> => {
    try {
      const ip = clientIp(req.headers);

      if (!opts.skipOriginCheck && MUTATING.has(req.method) && !isSameOrigin(req)) {
        throw new HttpError(403, "bad_origin", "Cross-site request blocked.");
      }

      let user: SessionUser | null = null;
      if (opts.roles) {
        user = await getSessionUser();
        if (!user) throw new HttpError(401, "unauthenticated", "Please sign in to continue.");
        if (!opts.roles.includes(user.role)) throw new HttpError(403, "forbidden", "You do not have access to this.");
        if (opts.permission && !hasPermission(user.role, user.permissions, opts.permission)) {
          throw new HttpError(403, "forbidden", "You do not have permission for this action.");
        }
      }

      if (opts.limit) {
        const who = opts.limit.by === "user" && user ? `u:${user.id}` : `ip:${ip}`;
        const rl = rateLimit(`${opts.limit.name}:${who}`, opts.limit.max, opts.limit.windowMs);
        if (!rl.ok) {
          const res = NextResponse.json(
            { error: { code: "rate_limited", message: "Too many attempts. Please wait a moment and try again." } },
            { status: 429 },
          );
          res.headers.set("Retry-After", String(rl.retryAfterSeconds));
          return res;
        }
      }

      let body: unknown = undefined;
      if (opts.schema) {
        const text = await req.text();
        if (text.length > MAX_BODY_BYTES) throw new HttpError(413, "payload_too_large", "Request is too large.");
        let json: unknown;
        try {
          json = text ? JSON.parse(text) : {};
        } catch {
          throw new HttpError(400, "invalid_json", "Request body must be valid JSON.");
        }
        body = opts.schema.parse(json);
      }

      const params = await routeCtx.params;
      const ctx = {
        req,
        user,
        body,
        params,
        ip,
        patientId: async () => {
          if (!user) throw new HttpError(401, "unauthenticated", "Please sign in to continue.");
          const id = await getPatientId(user.id);
          if (!id) throw new HttpError(403, "forbidden", "No patient record for this account.");
          return id;
        },
        doctorId: async () => {
          if (!user) throw new HttpError(401, "unauthenticated", "Please sign in to continue.");
          const id = await getDoctorId(user.id);
          if (!id) throw new HttpError(403, "forbidden", "No active doctor record for this account.");
          return id;
        },
      } as HandlerCtx<S>;

      const result = await handler(ctx);
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

/** Uuid path params are validated before use to avoid confusing DB errors and IDOR probing noise. */
export function uuidParam(params: Record<string, string>, key: string): string {
  const parsed = z.string().uuid().safeParse(params[key]);
  if (!parsed.success) throw new HttpError(404, "not_found", "Not found.");
  return parsed.data;
}
