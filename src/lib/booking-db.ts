import type { PaymentStatus } from "./status";

export interface PaymentLookup {
  id: string;
  appointment_id: string;
  patient_id: string;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  amount: number;
  status: PaymentStatus;
  refunded_amount: number;
  failure_reason: string | null;
}

export interface AppointmentForPayment {
  id: string;
  appointment_number: string;
  patient_id: string;
  doctor_id: string;
  status: string;
  payment_expires_at: string | null;
  starts_at: string;
  /** Current consultation fee in rupees, read from the doctors table at call time. */
  fee: number | string;
}

/**
 * The data-access surface used by the payment/booking services. There are two implementations:
 * Supabase (production, db-supabase.ts) and an in-process Postgres used by the integration tests, so the
 * real SQL functions are exercised by the same service code.
 */
export interface BookingDb {
  rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T>;
  paymentByOrder(orderId: string): Promise<PaymentLookup | null>;
  paymentByRzpId(rzpPaymentId: string): Promise<PaymentLookup | null>;
  paymentById(id: string): Promise<PaymentLookup | null>;
  appointmentForPayment(appointmentId: string): Promise<AppointmentForPayment | null>;
  paymentsForAppointment(appointmentId: string): Promise<PaymentLookup[]>;
  supersedeOpenPayments(appointmentId: string): Promise<void>;
  insertPayment(input: { appointmentId: string; orderId: string; amount: number }): Promise<PaymentLookup>;
  flagRefundRequired(paymentId: string): Promise<void>;
}
