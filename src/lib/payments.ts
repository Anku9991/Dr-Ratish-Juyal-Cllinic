import { createHash } from "node:crypto";
import type { BookingDb, PaymentLookup } from "./booking-db";
import { HttpError } from "./errors";
import { rupeesToPaise } from "./money";
import { parseWebhookEvent, verifyCheckoutSignature, verifyWebhookSignature, type PaymentGateway } from "./razorpay";

export interface OrderInfo {
  appointmentId: string;
  appointmentNumber: string;
  orderId: string;
  amount: number; // paise
  currency: "INR";
  expiresAt: string | null;
}

export interface OrderDeps {
  db: BookingDb;
  gateway: PaymentGateway;
  now?: () => Date;
}

const REUSABLE = ["created", "authorized", "failed"];

/**
 * Returns the Razorpay order to pay for a pending appointment, creating one if needed.
 * The amount ALWAYS comes from doctors.consultation_fee; nothing from the client is trusted.
 * Retrying (after a failed or abandoned attempt) reuses the open order instead of piling up new ones.
 */
export async function ensureOrder(deps: OrderDeps, input: { appointmentId: string; patientId: string }): Promise<OrderInfo> {
  const { db, gateway } = deps;
  const now = (deps.now ?? (() => new Date()))();
  const appt = await db.appointmentForPayment(input.appointmentId);
  if (!appt || appt.patient_id !== input.patientId) throw new HttpError(404, "not_found", "Appointment not found.");
  if (appt.status !== "pending_payment") throw new HttpError(409, "not_payable", "This appointment is not waiting for payment.");
  if (appt.payment_expires_at && new Date(appt.payment_expires_at).getTime() <= now.getTime()) {
    throw new HttpError(410, "hold_expired", "Your slot reservation expired. Please pick a slot again.");
  }

  const amount = rupeesToPaise(appt.fee);
  if (amount < 100) throw new HttpError(422, "fee_not_configured", "This doctor's fee is not configured. Please contact the clinic.");

  const toInfo = (p: PaymentLookup): OrderInfo => ({
    appointmentId: appt.id,
    appointmentNumber: appt.appointment_number,
    orderId: p.razorpay_order_id,
    amount: p.amount,
    currency: "INR",
    expiresAt: appt.payment_expires_at,
  });
  const findReusable = async () =>
    (await db.paymentsForAppointment(appt.id)).find(
      (p) => REUSABLE.includes(p.status) && p.amount === amount && p.failure_reason !== "superseded",
    );

  const existing = await findReusable();
  if (existing) return toInfo(existing);

  await db.supersedeOpenPayments(appt.id);
  const order = await gateway.createOrder({
    amountPaise: amount,
    receipt: appt.appointment_number,
    notes: { appointment_id: appt.id },
  });
  if (order.amount !== amount || order.currency !== "INR") {
    throw new HttpError(502, "gateway_mismatch", "Payment provider returned an unexpected order. Please try again.");
  }
  try {
    return toInfo(await db.insertPayment({ appointmentId: appt.id, orderId: order.id, amount }));
  } catch (err) {
    if (err instanceof HttpError && err.code === "conflict") {
      const raced = await findReusable();
      if (raced) return toInfo(raced);
    }
    throw err;
  }
}

export type ConfirmResult = "confirmed" | "already_confirmed" | "slot_lost" | "appointment_cancelled";

export interface VerifyDeps {
  db: BookingDb;
  gateway: PaymentGateway;
  keySecret: string;
}

/** Client checkout callback: verify signature, cross-check with Razorpay, then confirm atomically in the DB. */
export async function verifyCheckoutPayment(
  deps: VerifyDeps,
  input: { patientId: string; orderId: string; paymentId: string; signature: string },
): Promise<{ result: ConfirmResult; appointmentId: string }> {
  const { db, gateway } = deps;
  if (!verifyCheckoutSignature(input.orderId, input.paymentId, input.signature, deps.keySecret)) {
    throw new HttpError(400, "invalid_signature", "Payment verification failed.");
  }
  const payment = await db.paymentByOrder(input.orderId);
  if (!payment || payment.patient_id !== input.patientId) throw new HttpError(404, "payment_not_found", "Payment not found.");

  const remote = await gateway.fetchPayment(input.paymentId);
  if (remote.order_id !== input.orderId || remote.amount !== payment.amount || remote.currency !== "INR") {
    throw new HttpError(400, "payment_mismatch", "Payment details do not match this booking.");
  }
  if (remote.status === "authorized") {
    await gateway.capturePayment(input.paymentId, payment.amount);
  } else if (remote.status !== "captured") {
    throw new HttpError(409, "payment_not_captured", "The payment has not completed. If money was deducted it will be refunded automatically.");
  }

  const result = await db.rpc<ConfirmResult>("confirm_appointment_payment", {
    p_order_id: input.orderId,
    p_payment_id: input.paymentId,
    p_method: remote.method ?? null,
  });
  return { result, appointmentId: payment.appointment_id };
}

export interface WebhookDeps {
  db: BookingDb;
  webhookSecret: string;
}

export interface WebhookOutcome {
  duplicate: boolean;
  result: string;
}

/** Verified, idempotent webhook processing. Throws (=> HTTP 5xx => Razorpay retries) only on transient failures. */
export async function handleWebhook(
  deps: WebhookDeps,
  input: { rawBody: string; signature: string | null; eventId: string | null },
): Promise<WebhookOutcome> {
  const { db } = deps;
  if (!verifyWebhookSignature(input.rawBody, input.signature, deps.webhookSecret)) {
    throw new HttpError(401, "invalid_signature", "Invalid webhook signature.");
  }
  let json: unknown;
  try {
    json = JSON.parse(input.rawBody);
  } catch {
    throw new HttpError(400, "invalid_json", "Invalid JSON.");
  }
  const action = parseWebhookEvent(json);
  const eventId = input.eventId || createHash("sha256").update(input.rawBody).digest("hex");

  const claim = await db.rpc<string>("claim_webhook_event", { p_event_id: eventId, p_event_type: action.kind === "ignored" ? action.event : action.kind });
  if (claim === "duplicate") return { duplicate: true, result: "duplicate" };

  let result: string;
  switch (action.kind) {
    case "authorized":
      await db.rpc("mark_payment_authorized", { p_order_id: action.orderId, p_payment_id: action.paymentId });
      result = "authorized";
      break;
    case "captured": {
      const payment = await db.paymentByOrder(action.orderId);
      if (!payment) result = "unknown_order";
      else if (payment.amount !== action.amount) result = "amount_mismatch";
      else result = await db.rpc<string>("confirm_appointment_payment", { p_order_id: action.orderId, p_payment_id: action.paymentId, p_method: action.method });
      break;
    }
    case "failed":
      await db.rpc("fail_payment", { p_order_id: action.orderId, p_reason: action.reason });
      result = "failed";
      break;
    case "refunded": {
      const payment = await db.paymentByRzpId(action.paymentId);
      if (!payment) result = "unknown_payment";
      else {
        const outcome = await db
          .rpc<string>("record_refund", {
            p_payment: payment.id,
            p_rzp_refund_id: action.refundId,
            p_amount: action.amount,
            p_reason: "Processed by Razorpay",
            p_actor: null,
          })
          .catch((err: unknown) => {
            if (err instanceof HttpError && err.status < 500) return `ignored:${err.code}`;
            throw err;
          });
        result = outcome;
      }
      break;
    }
    default:
      result = "ignored";
  }
  await db.rpc("finish_webhook_event", { p_event_id: eventId, p_result: result });
  return { duplicate: false, result };
}

export interface RefundDeps {
  db: BookingDb;
  gateway: PaymentGateway;
}

/** Issues a refund at Razorpay and records it. Recording is idempotent, so the webhook can safely repeat it. */
export async function refundPayment(
  deps: RefundDeps,
  input: { paymentId: string; amountPaise: number; reason: string; actorId: string | null },
): Promise<void> {
  const { db, gateway } = deps;
  const payment = await db.paymentById(input.paymentId);
  if (!payment || !payment.razorpay_payment_id) throw new HttpError(404, "payment_not_found", "Payment not found.");
  if (!["captured", "partially_refunded"].includes(payment.status)) {
    throw new HttpError(409, "payment_not_refundable", "This payment cannot be refunded.");
  }
  if (input.amountPaise <= 0 || input.amountPaise > payment.amount - payment.refunded_amount) {
    throw new HttpError(422, "refund_amount_invalid", "Refund amount exceeds the refundable balance.");
  }
  const refund = await gateway.refund(payment.razorpay_payment_id, input.amountPaise, { reason: input.reason.slice(0, 200) });
  await db.rpc("record_refund", {
    p_payment: payment.id,
    p_rzp_refund_id: refund.id,
    p_amount: input.amountPaise,
    p_reason: input.reason,
    p_actor: input.actorId,
  });
}

export type CancelRefund = "none" | "refunded" | "not_eligible" | "pending_review";

export interface CancelDeps extends RefundDeps {
  now?: () => Date;
}

/**
 * Cancels an appointment. Patients get an automatic full refund when they cancel outside the clinic's
 * cancellation window; clinic-initiated cancellations (`clinicInitiated`) are always refunded.
 */
export async function cancelAppointment(
  deps: CancelDeps,
  input: { appointmentId: string; actorUserId: string; patientId?: string; reason: string | null; windowHours: number; clinicInitiated?: boolean },
): Promise<{ refund: CancelRefund }> {
  const { db } = deps;
  const now = (deps.now ?? (() => new Date()))();
  const appt = await db.appointmentForPayment(input.appointmentId);
  if (!appt || (input.patientId && appt.patient_id !== input.patientId)) throw new HttpError(404, "not_found", "Appointment not found.");
  if (!["pending_payment", "confirmed"].includes(appt.status) && !input.clinicInitiated) {
    throw new HttpError(409, "cannot_cancel", "This appointment can no longer be cancelled.");
  }

  const hoursLeft = (new Date(appt.starts_at).getTime() - now.getTime()) / 3_600_000;
  const eligible = Boolean(input.clinicInitiated) || hoursLeft >= input.windowHours;
  const captured = (await db.paymentsForAppointment(appt.id)).find((p) => p.status === "captured");

  // Flag first: if anything fails after the cancel, the refund is still visible to admin.
  if (captured && eligible) await db.flagRefundRequired(captured.id);
  await db.rpc("cancel_appointment", { p_appointment: appt.id, p_actor: input.actorUserId, p_reason: input.reason });

  if (!captured) return { refund: "none" };
  if (!eligible) return { refund: "not_eligible" };
  try {
    await refundPayment(deps, { paymentId: captured.id, amountPaise: captured.amount - captured.refunded_amount, reason: input.reason ?? "Appointment cancelled", actorId: input.actorUserId });
    return { refund: "refunded" };
  } catch (err) {
    console.error("Automatic refund failed:", err instanceof Error ? err.message : "unknown");
    return { refund: "pending_review" };
  }
}
