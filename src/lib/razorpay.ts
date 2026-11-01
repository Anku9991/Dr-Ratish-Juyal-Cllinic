import crypto from "node:crypto";
import Razorpay from "razorpay";

/** Constant-time compare of two hex/base64 strings. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function hmacHex(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/** Checkout callback signature: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string, keySecret: string): boolean {
  if (!orderId || !paymentId || !signature) return false;
  return safeEqual(hmacHex(keySecret, `${orderId}|${paymentId}`), signature);
}

/** Webhook signature: HMAC_SHA256(raw request body, webhook_secret). Must use the exact raw body. */
export function verifyWebhookSignature(rawBody: string, signature: string | null, webhookSecret: string): boolean {
  if (!signature) return false;
  return safeEqual(hmacHex(webhookSecret, rawBody), signature);
}

export interface GatewayPayment {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: string;
  method?: string | null;
}

export interface PaymentGateway {
  createOrder(input: { amountPaise: number; receipt: string; notes: Record<string, string> }): Promise<{ id: string; amount: number; currency: string }>;
  fetchPayment(paymentId: string): Promise<GatewayPayment>;
  capturePayment(paymentId: string, amountPaise: number): Promise<void>;
  refund(paymentId: string, amountPaise: number, notes: Record<string, string>): Promise<{ id: string; status: string }>;
}

class RazorpayGateway implements PaymentGateway {
  private readonly rz: Razorpay;
  constructor(keyId: string, keySecret: string) {
    this.rz = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  async createOrder(input: { amountPaise: number; receipt: string; notes: Record<string, string> }) {
    const order = await this.rz.orders.create({
      amount: input.amountPaise,
      currency: "INR",
      receipt: input.receipt.slice(0, 40),
      notes: input.notes,
    });
    return { id: order.id, amount: Number(order.amount), currency: order.currency };
  }

  async fetchPayment(paymentId: string): Promise<GatewayPayment> {
    const p = await this.rz.payments.fetch(paymentId);
    return {
      id: p.id,
      order_id: p.order_id ?? null,
      amount: Number(p.amount),
      currency: p.currency,
      status: String(p.status),
      method: p.method ?? null,
    };
  }

  async capturePayment(paymentId: string, amountPaise: number): Promise<void> {
    await this.rz.payments.capture(paymentId, amountPaise, "INR");
  }

  async refund(paymentId: string, amountPaise: number, notes: Record<string, string>) {
    const r = await this.rz.payments.refund(paymentId, { amount: amountPaise, notes });
    return { id: r.id, status: String(r.status) };
  }
}

let override: PaymentGateway | undefined;

/** Tests inject a fake gateway; production always uses the real Razorpay client. */
export function setGatewayForTests(gateway: PaymentGateway | undefined): void {
  override = gateway;
}

export function getGateway(): PaymentGateway {
  if (override) return override;
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("Razorpay credentials are not configured");
  return new RazorpayGateway(keyId, keySecret);
}

// ---------- webhook payload normalization (pure) ----------

export type WebhookAction =
  | { kind: "authorized"; orderId: string; paymentId: string }
  | { kind: "captured"; orderId: string; paymentId: string; amount: number; method: string | null }
  | { kind: "failed"; orderId: string; paymentId: string | null; reason: string }
  | { kind: "refunded"; paymentId: string; refundId: string; amount: number }
  | { kind: "ignored"; event: string };

interface RawEntity {
  id?: string;
  order_id?: string;
  amount?: number;
  method?: string;
  error_description?: string;
  payment_id?: string;
}

export function parseWebhookEvent(raw: unknown): WebhookAction {
  const body = raw as { event?: string; payload?: Record<string, { entity?: RawEntity } | undefined> } | null;
  const event = body?.event ?? "unknown";
  const payment = body?.payload?.payment?.entity;
  const order = body?.payload?.order?.entity;
  const refund = body?.payload?.refund?.entity;

  switch (event) {
    case "payment.authorized":
      if (payment?.id && payment.order_id) return { kind: "authorized", orderId: payment.order_id, paymentId: payment.id };
      break;
    case "payment.captured":
    case "order.paid":
      if (payment?.id && (payment.order_id ?? order?.id) && typeof payment.amount === "number") {
        return { kind: "captured", orderId: (payment.order_id ?? order?.id) as string, paymentId: payment.id, amount: payment.amount, method: payment.method ?? null };
      }
      break;
    case "payment.failed":
      if (payment?.order_id) {
        return { kind: "failed", orderId: payment.order_id, paymentId: payment.id ?? null, reason: payment.error_description ?? "Payment failed" };
      }
      break;
    case "refund.processed":
      if (refund?.id && refund.payment_id && typeof refund.amount === "number") {
        return { kind: "refunded", paymentId: refund.payment_id, refundId: refund.id, amount: refund.amount };
      }
      break;
    default:
      break;
  }
  return { kind: "ignored", event };
}
