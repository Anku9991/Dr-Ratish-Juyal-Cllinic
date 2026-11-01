import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import { HttpError, mapDbError } from "./errors";
import type { AppointmentForPayment, BookingDb, PaymentLookup } from "./booking-db";

const PAYMENT_COLS = "id, appointment_id, razorpay_order_id, razorpay_payment_id, amount, status, refunded_amount, failure_reason, appointments!inner(patient_id)";

type PaymentJoin = Omit<PaymentLookup, "patient_id"> & { appointments: { patient_id: string } | { patient_id: string }[] };

function toLookup(row: PaymentJoin): PaymentLookup {
  const appt = Array.isArray(row.appointments) ? row.appointments[0] : row.appointments;
  const { appointments: _drop, ...rest } = row;
  return { ...rest, patient_id: appt?.patient_id ?? "" };
}

export function createSupabaseBookingDb(): BookingDb {
  const admin = supabaseAdmin();

  const one = async (col: string, value: string): Promise<PaymentLookup | null> => {
    const { data, error } = await admin.from("payments").select(PAYMENT_COLS).eq(col, value).maybeSingle();
    if (error) throw mapDbError(error);
    return data ? toLookup(data as PaymentJoin) : null;
  };

  return {
    async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
      const { data, error } = await admin.rpc(fn, args);
      if (error) throw mapDbError(error);
      return data as T;
    },
    paymentByOrder: (orderId) => one("razorpay_order_id", orderId),
    paymentByRzpId: (id) => one("razorpay_payment_id", id),
    paymentById: (id) => one("id", id),

    async appointmentForPayment(appointmentId): Promise<AppointmentForPayment | null> {
      const { data, error } = await admin
        .from("appointments")
        .select("id, appointment_number, patient_id, doctor_id, status, payment_expires_at, starts_at, doctors!inner(consultation_fee)")
        .eq("id", appointmentId)
        .maybeSingle();
      if (error) throw mapDbError(error);
      if (!data) return null;
      const doc = Array.isArray(data.doctors) ? data.doctors[0] : data.doctors;
      const { doctors: _drop, ...rest } = data as Record<string, unknown> & { doctors: unknown };
      return { ...(rest as Omit<AppointmentForPayment, "fee">), fee: (doc as { consultation_fee?: number | string })?.consultation_fee ?? 0 };
    },

    async paymentsForAppointment(appointmentId) {
      const { data, error } = await admin
        .from("payments")
        .select(PAYMENT_COLS)
        .eq("appointment_id", appointmentId)
        .order("created_at", { ascending: false });
      if (error) throw mapDbError(error);
      return ((data ?? []) as PaymentJoin[]).map(toLookup);
    },

    async supersedeOpenPayments(appointmentId) {
      const { error } = await admin
        .from("payments")
        .update({ status: "failed", failure_reason: "superseded" })
        .eq("appointment_id", appointmentId)
        .in("status", ["created", "authorized"]);
      if (error) throw mapDbError(error);
    },

    async insertPayment({ appointmentId, orderId, amount }) {
      const { data, error } = await admin
        .from("payments")
        .insert({ appointment_id: appointmentId, razorpay_order_id: orderId, amount, currency: "INR", status: "created" })
        .select(PAYMENT_COLS)
        .single();
      if (error) {
        if (error.code === "23505") throw new HttpError(409, "conflict", "A payment is already open for this appointment.");
        throw mapDbError(error);
      }
      return toLookup(data as PaymentJoin);
    },

    async flagRefundRequired(paymentId) {
      const { error } = await admin.from("payments").update({ refund_required: true }).eq("id", paymentId);
      if (error) throw mapDbError(error);
    },
  };
}
