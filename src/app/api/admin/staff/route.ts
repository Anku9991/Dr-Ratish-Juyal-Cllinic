import { z } from "zod";
import { route } from "@/lib/api";
import { indianMobile, passwordSchema, staffPermissionsSchema } from "@/lib/validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createStaffUser } from "@/lib/admin-users";
import { HttpError, mapDbError } from "@/lib/errors";
import { audit } from "@/lib/audit";

const createSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  mobile: indianMobile.optional().or(z.literal("").transform(() => undefined)),
  temporaryPassword: passwordSchema,
});

/** Create an admin/staff account (no permissions to start with). Requires 'manage_staff'. */
export const POST = route({ roles: ["admin"], permission: "manage_staff", schema: createSchema, limit: { name: "staff", max: 10, windowMs: 60_000, by: "user" } }, async (ctx) => {
  const id = await createStaffUser({ email: ctx.body.email, password: ctx.body.temporaryPassword, fullName: ctx.body.fullName, mobile: ctx.body.mobile, role: "admin", permissions: [] });
  await audit(ctx.user?.id ?? null, "staff.created", "profile", id);
  return { id };
});

/** Change an admin's explicit permissions or active state. */
export const PUT = route({ roles: ["admin"], permission: "manage_staff", schema: staffPermissionsSchema, limit: { name: "staff", max: 30, windowMs: 60_000, by: "user" } }, async (ctx) => {
  const { userId, permissions, isActive } = ctx.body;
  const self = userId === ctx.user?.id;
  if (self && (!permissions.includes("manage_staff") || isActive === false)) {
    throw new HttpError(409, "self_lockout", "You cannot remove your own staff-management access or deactivate yourself.");
  }
  const admin = supabaseAdmin();
  const { data: target } = await admin.from("profiles").select("id, role").eq("id", userId).maybeSingle();
  if (!target || target.role !== "admin") throw new HttpError(404, "not_found", "Staff member not found.");
  const patch: Record<string, unknown> = { permissions };
  if (isActive !== undefined) patch.is_active = isActive;
  const { error } = await admin.from("profiles").update(patch).eq("id", userId);
  if (error) throw mapDbError(error);
  await audit(ctx.user?.id ?? null, "staff.permissions_changed", "profile", userId, { permissions, isActive });
  return { ok: true };
});
