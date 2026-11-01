import { z } from "zod";
import { isValidDate, isValidTime } from "./time";
import { ADMIN_PERMISSIONS } from "./permissions";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const uuid = z.string().uuid("Invalid id");
export const dateString = z.string().refine(isValidDate, "Use a valid date (YYYY-MM-DD)");
export const timeString = z.string().refine(isValidTime, "Use a valid time (HH:MM)");

/** Indian mobile: optional +91 / 91 / 0 prefix, then 10 digits starting 6-9. Normalized to +91XXXXXXXXXX. */
export const indianMobile = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, ""))
  .refine((v) => /^(\+?91|0)?[6-9][0-9]{9}$/.test(v), "Enter a valid 10-digit Indian mobile number")
  .transform((v) => `+91${v.slice(-10)}`);

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use at most 72 characters")
  .regex(/[A-Za-z]/, "Include at least one letter")
  .regex(/[0-9]/, "Include at least one number");

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
  mobile: indianMobile,
  password: passwordSchema,
  acceptTerms: z.literal(true, { errorMap: () => ({ message: "Please accept the terms and privacy policy" }) }),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(254),
  password: z.string().min(1, "Enter your password").max(72),
  next: z.string().max(300).optional(),
});

export const patientProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  mobile: indianMobile,
  dateOfBirth: dateString
    .refine((d) => d <= new Date().toISOString().slice(0, 10), "Date of birth cannot be in the future")
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  gender: z.enum(["male", "female", "other"]).optional().nullable().or(z.literal("").transform(() => null)),
  address: optionalText(500),
  emergencyContact: optionalText(200),
  allergies: optionalText(2000),
  medicalHistory: optionalText(4000),
});

export const slotsQuerySchema = z.object({ date: dateString });

export const holdSchema = z.object({ doctorId: uuid, date: dateString, startTime: timeString });
export const checkoutSchema = z.object({ holdToken: uuid, reason: optionalText(500) });

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(5).max(64),
  razorpay_payment_id: z.string().min(5).max(64),
  razorpay_signature: z.string().min(10).max(256),
});

export const paymentFailureSchema = z.object({
  razorpay_order_id: z.string().min(5).max(64),
  reason: z.string().max(300).optional(),
});

export const cancelSchema = z.object({ reason: optionalText(300) });

const optionalNumber = (min: number, max: number, integer = false) =>
  z
    .union([z.number(), z.string().trim()])
    .optional()
    .nullable()
    .transform((v, ctx) => {
      if (v === undefined || v === null || v === "") return null;
      const n = typeof v === "number" ? v : Number(v);
      if (!Number.isFinite(n) || n < min || n > max || (integer && !Number.isInteger(n))) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Enter a value between ${min} and ${max}` });
        return z.NEVER;
      }
      return n;
    });

export const medicineSchema = z.object({
  medicineName: z.string().trim().min(1, "Medicine name is required").max(200),
  strength: optionalText(60),
  dosage: z.string().trim().min(1, "Dosage is required").max(100),
  frequency: z.string().trim().min(1, "Frequency is required").max(100),
  duration: z.string().trim().min(1, "Duration is required").max(100),
  instructions: optionalText(300),
});

export const consultationSchema = z.object({
  symptoms: optionalText(4000),
  examinationNotes: optionalText(4000),
  diagnosis: optionalText(2000),
  bloodPressure: z
    .string()
    .trim()
    .optional()
    .nullable()
    .refine((v) => !v || /^[0-9]{2,3}\/[0-9]{2,3}$/.test(v), "Use the format 120/80")
    .transform((v) => (v ? v : null)),
  pulse: optionalNumber(20, 300, true),
  temperature: optionalNumber(90, 110),
  spo2: optionalNumber(50, 100, true),
  weight: optionalNumber(1, 500),
  advice: optionalText(4000),
  followUpDate: dateString.optional().nullable().or(z.literal("").transform(() => null)),
  medicines: z.array(medicineSchema).max(30, "At most 30 medicines per prescription").default([]),
  padDrawing: z.string().optional().nullable(),
});
export type ConsultationInput = z.infer<typeof consultationSchema>;

export const reasonSchema = z.object({ reason: z.string().trim().min(5, "Give a reason (at least 5 characters)").max(300) });

export const staffAppointmentStatusSchema = z.object({
  status: z.enum(["checked_in", "in_consultation", "completed", "no_show", "cancelled"]),
  reason: optionalText(300),
});

// ---------- admin ----------
export const createDoctorSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  mobile: indianMobile.optional().or(z.literal("").transform(() => undefined)),
  temporaryPassword: passwordSchema,
  speciality: z.string().trim().min(2).max(100),
  qualification: optionalText(200),
  registrationNumber: optionalText(60),
  consultationFee: z.coerce.number().min(1, "Fee must be at least ₹1").max(100000).multipleOf(0.01),
  bio: optionalText(2000),
});

export const updateDoctorSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    speciality: z.string().trim().min(2).max(100),
    qualification: optionalText(200),
    registrationNumber: optionalText(60),
    consultationFee: z.coerce.number().min(1).max(100000).multipleOf(0.01),
    bio: optionalText(2000),
    isActive: z.boolean(),
  })
  .partial();

export const scheduleRuleSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startTime: timeString,
    endTime: timeString,
    slotMinutes: z.number().int().min(5).max(120),
    isActive: z.boolean().default(true),
  })
  .refine((r) => r.startTime < r.endTime, { message: "End time must be after start time", path: ["endTime"] });
export const scheduleSchema = z.object({ rules: z.array(scheduleRuleSchema).max(42) });

export const leaveSchema = z.object({ date: dateString, reason: optionalText(200) });
export const holidaySchema = z.object({ date: dateString, name: z.string().trim().min(1).max(120) });

export const clinicSettingsSchema = z.object({
  clinicName: z.string().trim().min(2).max(160),
  address: z.string().trim().min(5).max(500),
  phone: z.string().trim().min(5).max(30),
  email: z.string().trim().email().max(254).optional().nullable().or(z.literal("").transform(() => null)),
  prescriptionFooter: optionalText(500),
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Unknown timezone"),
  cancellationWindowHours: z.coerce.number().int().min(0).max(720),
  slotHoldMinutes: z.coerce.number().int().min(5).max(60),
  bookingHorizonDays: z.coerce.number().int().min(1).max(180),
  recordRetentionYears: z.coerce.number().int().min(1).max(30),
});

export const staffPermissionsSchema = z.object({
  userId: uuid,
  permissions: z.array(z.enum(ADMIN_PERMISSIONS)).max(ADMIN_PERMISSIONS.length),
  isActive: z.boolean().optional(),
});

export const refundSchema = z.object({
  amountRupees: z.coerce.number().positive().multipleOf(0.01),
  reason: z.string().trim().min(3).max(300),
});

export const activeSchema = z.object({ isActive: z.boolean() });

/** Flattens zod issues to { "medicines.0.dosage": "Dosage is required" } */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}
