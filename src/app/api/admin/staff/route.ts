import { z } from "zod";
import { route } from "@/lib/api";
import { indianMobile, passwordSchema, staffPermissionsSchema } from "@/lib/validation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createStaffUser } from "@/lib/admin-users";
import { HttpError } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { saveClinicStaff, removeClinicStaff } from "@/lib/firebase/roles";

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

    // Update in Firebase Firestore
    try {
      await saveClinicStaff({
        email: userId,
        fullName: "Staff Member",
        role: "admin",
        permissions,
        isActive: isActive !== false,
      });
    } catch (fbErr) {
      console.warn("Firebase staff update:", fbErr);
    }

    // Update in Supabase if exists
    try {
      const admin = supabaseAdmin();
      const patch: Record<string, unknown> = { permissions };
      if (isActive !== undefined) patch.is_active = isActive;
      const { error } = await admin.from("profiles").update(patch).eq("id", userId);
      if (error) console.warn("Supabase staff update error:", error);
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
