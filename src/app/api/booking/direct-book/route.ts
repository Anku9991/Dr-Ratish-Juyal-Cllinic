import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser, getPatientId } from "@/lib/auth";
import { clinicStore, type PaymentMethod } from "@/lib/appointments-store";
import { DR_RATISH_JUYAL_ID } from "@/lib/firebase/data";

const bookSchema = z.object({
  doctorId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Invalid time format"),
  reason: z.string().max(500).optional(),
  paymentMethod: z.enum(["cash", "card", "razorpay"]).default("cash"),
});

export async function POST(req: NextRequest) {
  try {
    const raw = await req.json();
    const parsed = bookSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: parsed.error.issues[0]?.message || "Invalid booking details" },
        { status: 400 }
      );
    }

    const { doctorId, date, startTime, reason, paymentMethod } = parsed.data;
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: "Please sign in to book an appointment." }, { status: 401 });
    }

    const isNeuro = doctorId === DR_RATISH_JUYAL_ID;
    const doctorName = isNeuro ? "Dr. Ratish Juyal" : "Dr. Amit K. Sharma (PT)";
    const speciality = isNeuro ? "Senior Consultant Neurologist" : "Consultant Neuro-Physiotherapist";

    const patientId = (await getPatientId(user.id)) || user.id;
    const patientName = user.fullName || "Clinic Patient";
    const patientPhone = user.mobile || "+91 94530 25888";

    let appt;
    try {
      appt = clinicStore.createAppointment({
        doctorId,
        doctorName,
        speciality,
        patientId,
        patientName,
        patientPhone,
        date,
        startTime,
        reason,
        paymentMethod: paymentMethod as PaymentMethod,
      });
    } catch (conflictErr: unknown) {
      const msg = conflictErr instanceof Error ? conflictErr.message : "This slot is already booked";
      return NextResponse.json({ ok: false, message: msg }, { status: 409 });
    }

    return NextResponse.json({
      ok: true,
      data: {
        appointmentId: appt.id,
        appointmentNumber: appt.appointment_number,
        token: appt.token_number,
        status: appt.status,
        paymentMethod: appt.payment_method,
        paymentStatus: appt.payment_status,
        cabin: appt.cabin,
        startsAt: appt.starts_at,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to book appointment";
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
