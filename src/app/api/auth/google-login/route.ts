import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { resolveUserRole } from "@/lib/firebase/roles";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth-session";
import { ROLE_HOME, canAccessPath, safeNextPath } from "@/lib/permissions";
import { db } from "@/lib/firebase/config";
import { doc, setDoc } from "firebase/firestore";

const googleLoginSchema = z.object({
  uid: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().nullable().optional(),
  photoURL: z.string().nullable().optional(),
  next: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const parsed = googleLoginSchema.safeParse(rawBody);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: "Invalid user details provided" },
        { status: 400 }
      );
    }

    const { uid, email, displayName, photoURL, next } = parsed.data;

    // 1. Resolve role from Firestore staff list or default
    const { role, permissions } = await resolveUserRole(email);

    const fullName = displayName || (role === "doctor" ? "Doctor" : "Patient");

    // 2. Sync user profile into Firestore collection
    try {
      await setDoc(
        doc(db, "users", uid),
        {
          uid,
          email: email.toLowerCase(),
          fullName,
          role,
          photoURL: photoURL ?? null,
          lastLoginAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // If patient, also ensure a record in patients collection
      if (role === "patient") {
        await setDoc(
          doc(db, "patients", uid),
          {
            id: uid,
            email: email.toLowerCase(),
            full_name: fullName,
            created_at: new Date().toISOString(),
          },
          { merge: true }
        );
      }
    } catch (dbErr) {
      console.warn("Could not write user profile to Firestore (proceeding with session):", dbErr);
    }

    // 3. Create cryptographically signed session token
    const token = await createSessionToken({
      id: uid,
      email: email.toLowerCase(),
      role,
      fullName,
      permissions,
    });

    // 4. Calculate redirect
    const cleanNext = safeNextPath(next);
    const redirectUrl = cleanNext && canAccessPath(role, cleanNext) ? cleanNext : ROLE_HOME[role];

    // 5. Build response and set HTTP-only cookie
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
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Authentication failed";
    console.error("Google sign in error:", err);
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
