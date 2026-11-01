import crypto from "node:crypto";
import type { PaymentGateway, GatewayPayment } from "@/lib/razorpay";

/** In-memory fake Razorpay for tests. Produces real, verifiable HMAC signatures with a fixed test secret. */
export const TEST_KEY_SECRET = "test_key_secret";
export const TEST_WEBHOOK_SECRET = "test_webhook_secret";

interface FakeOrder {
  id: string;
  amount: number;
  currency: string;
}
interface FakePayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  method: string | null;
}

export class FakeGateway implements PaymentGateway {
  orders = new Map<string, FakeOrder>();
  payments = new Map<string, FakePayment>();
  private seq = 0;

  async createOrder(input: { amountPaise: number; receipt: string; notes: Record<string, string> }) {
    const id = `order_${++this.seq}`;
    const order = { id, amount: input.amountPaise, currency: "INR" };
    this.orders.set(id, order);
    return order;
  }

  /** Simulates the customer completing checkout: creates a captured payment and the matching signature. */
  simulatePay(orderId: string, opts: { status?: "authorized" | "captured"; method?: string } = {}) {
    const order = this.orders.get(orderId);
    if (!order) throw new Error("unknown order");
    const paymentId = `pay_${++this.seq}`;
    this.payments.set(paymentId, { id: paymentId, order_id: orderId, amount: order.amount, currency: "INR", status: opts.status ?? "captured", method: opts.method ?? "upi" });
    const signature = crypto.createHmac("sha256", TEST_KEY_SECRET).update(`${orderId}|${paymentId}`).digest("hex");
    return { paymentId, signature };
  }

  async fetchPayment(paymentId: string): Promise<GatewayPayment> {
    const p = this.payments.get(paymentId);
    if (!p) throw new Error("unknown payment");
    return { ...p };
  }

  async capturePayment(paymentId: string): Promise<void> {
    const p = this.payments.get(paymentId);
    if (p) p.status = "captured";
  }

  async refund(paymentId: string, amountPaise: number) {
    const id = `rfnd_${++this.seq}`;
    void paymentId;
    void amountPaise;
    return { id, status: "processed" };
  }

  /** Builds a signed webhook body + header the way Razorpay would send it. */
  webhookFor(event: string, payload: Record<string, unknown>): { rawBody: string; signature: string } {
    const rawBody = JSON.stringify({ event, payload });
    const signature = crypto.createHmac("sha256", TEST_WEBHOOK_SECRET).update(rawBody).digest("hex");
    return { rawBody, signature };
  }
}
