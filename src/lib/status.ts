export type Role = "patient" | "doctor" | "admin";

export const APPOINTMENT_STATUSES = [
  "pending_payment",
  "confirmed",
  "checked_in",
  "in_consultation",
  "completed",
  "cancelled",
  "no_show",
  "expired",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const PAYMENT_STATUSES = ["created", "authorized", "captured", "failed", "refunded", "partially_refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Manual transitions by staff. pending_payment -> confirmed/expired is system-only (payment + hold expiry). */
const STAFF_TRANSITIONS: Record<Role, Partial<Record<AppointmentStatus, AppointmentStatus[]>>> = {
  patient: {},
  doctor: {
    confirmed: ["checked_in", "in_consultation", "no_show"],
    checked_in: ["in_consultation", "no_show"],
    in_consultation: ["completed"],
  },
  admin: {
    confirmed: ["checked_in", "in_consultation", "no_show", "cancelled"],
    checked_in: ["in_consultation", "no_show", "cancelled"],
    in_consultation: ["completed"],
  },
};

export function canTransitionAppointment(from: AppointmentStatus, to: AppointmentStatus, role: Role): boolean {
  return STAFF_TRANSITIONS[role][from]?.includes(to) ?? false;
}

const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  created: ["authorized", "captured", "failed"],
  authorized: ["captured", "failed"],
  // Razorpay lets a customer retry on the same order after a failed attempt, so failed can still succeed.
  failed: ["authorized", "captured"],
  captured: ["refunded", "partially_refunded"],
  partially_refunded: ["refunded", "partially_refunded"],
  refunded: [],
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}

/** Appointment states that occupy a slot. */
export const LIVE_APPOINTMENT_STATUSES: AppointmentStatus[] = [
  "pending_payment",
  "confirmed",
  "checked_in",
  "in_consultation",
  "completed",
];

export function isTerminalAppointment(status: AppointmentStatus): boolean {
  return ["completed", "cancelled", "no_show", "expired"].includes(status);
}
