import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { ROLE_HOME, canAccessPath, safeNextPath } from "@/lib/permissions";
import { DR_RATISH_JUYAL_ID, PHYSIOTHERAPIST_ID } from "@/lib/firebase/data";

const pinLoginSchema = z.object({
  pin: z.string().trim().min(4, "PIN must be at least 4 digits"),
  selectedRole: z.enum(["doctor", "admin", "patient"]).optional(),
  patientName: z.string().optional(),
  patientMobile: z.string().optional(),
  next: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parsed = pinLoginSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: parsed.error.issues[0]?.message || "Invalid PIN" },
        { status: 400 }
      );
    }

    const { pin, selectedRole: _selectedRole, patientName, patientMobile, next } = parsed.data;

    let role: "doctor" | "admin" | "patient" = "patient";
    let id = "patient-guest-id";
    let fullName = patientName?.trim() || "Clinic Patient";
    let email: string | null = patientMobile ? `patient_${patientMobile}@clinic.local` : "patient@clinic.local";
    let permissions: string[] = [];

    // Check PIN mappings
    if (pin === "1234") {
      // Dr. Ratish Juyal (Doctor Portal)
      role = "doctor";
      id = DR_RATISH_JUYAL_ID;
      fullName = "Dr. Ratish Juyal";
      email = "dr.ratishjuyal@gmail.com";
      permissions = ["consultation", "medical_records"];
    } else if (pin === "1235") {
      // Dr. Amit K. Sharma (Neuro-Physiotherapist)
      role = "doctor";
      id = PHYSIOTHERAPIST_ID;
      fullName = "Dr. Amit K. Sharma (PT)";
      email = "physio.sharma@gmail.com";
      permissions = ["consultation", "medical_records"];
    } else if (pin === "2345" || pin === "9999") {
      // Staff / Receptionist / Admin Portal
      role = "admin";
      id = "staff-receptionist-id";
      fullName = "Clinic Reception & Staff";
      email = "reception@drratishjuyal.com";
      permissions = ["manage_staff", "medical_records"];
    } else if (pin === "3456" || pin === "1111") {
      // Patient Portal
      role = "patient";
      id = patientMobile ? `pat_${patientMobile}` : "patient-user-id";
      fullName = patientName?.trim() || "Patient User";
      email = patientMobile ? `patient_${patientMobile}@clinic.local` : "patient@clinic.local";
      permissions = [];
    } else {
      return NextResponse.json(
        { ok: false, message: "Invalid PIN. Use Doctor PIN (1234/1235), Staff PIN (2345), or Patient PIN (3456)." },
        { status: 401 }
      );
    }

    // Create session token
    const token = await createSessionToken({
      id,
      email,
      role,
      fullName,
      permissions,
    });

    const cleanNext = safeNextPath(next);
    const redirectUrl = cleanNext && canAccessPath(role, cleanNext) ? cleanNext : ROLE_HOME[role];

    const response = NextResponse.json({
      ok: true,
      role,
      redirect: redirectUrl,
      fullName,
      email,
    });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days (matches token exp)
    });

    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "PIN Authentication failed";
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
