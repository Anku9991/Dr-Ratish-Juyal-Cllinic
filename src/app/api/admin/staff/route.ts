import { z } from "zod";
import { route } from "@/lib/api";
import { indianMobile, passwordSchema, staffPermissionsSchema } from "@/lib/validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createStaffUser } from "@/lib/admin-users";
import { HttpError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { saveClinicStaff, removeClinicStaff, listClinicStaff } from "@/lib/firebase/roles";

const createSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  role: z.enum(["admin", "doctor"]).default("admin"),
  mobile: indianMobile.optional().or(z.literal("").transform(() => undefined)),
  temporaryPassword: passwordSchema.optional().or(z.literal("").transform(() => undefined)),
});

/** Create an admin/staff or doctor account in Firebase & DB. Requires 'manage_staff'. */
export const POST = route(
  { roles: ["admin"], permission: "manage_staff", schema: createSchema, limit: { name: "staff", max: 15, windowMs: 60_000, by: "user" } },
  async (ctx) => {
    const { email, fullName, role, temporaryPassword, mobile } = ctx.body;

    // 1. Save to Firebase Firestore staff_members collection
    await saveClinicStaff({
      email,
      fullName,
      role,
      permissions: role === "admin" ? ["manage_staff", "medical_records"] : ["consultation", "medical_records"],
      isActive: true,
    });

    // 2. Also create in Supabase if credentials are provided
    let id = email;
    try {
      const generatedPassword = temporaryPassword || "ClinicPass@2026";
      id = await createStaffUser({
        email,
        password: generatedPassword,
        fullName,
        mobile,
        role,
        permissions: role === "admin" ? ["manage_staff", "medical_records"] : [],
      });
    } catch (dbErr) {
      console.warn("Supabase staff creation skipped or failed (Firebase active):", dbErr);
    }

    await audit(ctx.user?.id ?? null, "staff.created", "profile", id, { email, role, fullName });
    return { id, email, role };
  }
);

/** Change an admin/staff's explicit permissions or active state. */
export const PUT = route(
  { roles: ["admin"], permission: "manage_staff", schema: staffPermissionsSchema, limit: { name: "staff", max: 30, windowMs: 60_000, by: "user" } },
  async (ctx) => {
    const { userId, permissions, isActive } = ctx.body;
    const self = userId === ctx.user?.id || userId === ctx.user?.email;
    if (self && (!permissions.includes("manage_staff") || isActive === false)) {
      throw new HttpError(409, "self_lockout", "You cannot remove your own staff-management access or deactivate yourself.");
    }

    // 1. Update in Firebase Firestore (preserve existing role & full_name)
    try {
      const existingStaff = await listClinicStaff();
      const existing = existingStaff.find(
        (s) => s.id === userId || s.email.toLowerCase() === userId.toLowerCase()
      );
      if (existing) {
        await saveClinicStaff({
          email: existing.email,
          fullName: existing.fullName,
          role: existing.role,
          doctorId: existing.doctorId,
          permissions,
          isActive: isActive !== undefined ? isActive : existing.isActive,
        });
      }
    } catch (fbErr) {
      console.warn("Firebase staff update:", fbErr);
    }

    // 2. Update in Supabase (support matching by UUID or email)
    try {
      const admin = supabaseAdmin();
      const patch: Record<string, unknown> = { permissions };
      if (isActive !== undefined) patch.is_active = isActive;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
      let q = admin.from("profiles").update(patch);
      q = isUuid ? q.eq("id", userId) : q.eq("email", userId.toLowerCase());
      await q;
    } catch {
      // Ignore
    }

    await audit(ctx.user?.id ?? null, "staff.permissions_changed", "profile", userId, { permissions, isActive });
    return { ok: true };
  }
);

/** Delete or deactivate staff member */
export const DELETE = route(
  { roles: ["admin"], permission: "manage_staff", schema: z.object({ email: z.string().email() }) },
  async (ctx) => {
    await removeClinicStaff(ctx.body.email);
    await audit(ctx.user?.id ?? null, "staff.deleted", "profile", ctx.body.email);
    return { ok: true };
  }
);
