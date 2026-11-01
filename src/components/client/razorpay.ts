import { api } from "./api";

export interface CheckoutPayload {
  appointmentId: string;
  appointmentNumber: string;
  orderId: string;
  amount: number;
  currency: "INR";
  expiresAt: string | null;
  keyId: string;
  prefill: { name: string; email: string; contact: string };
}

interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}
interface RazorpayFailure {
  error?: { description?: string };
}
interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", cb: (r: RazorpayFailure) => void): void;
}
interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
  theme: { color: string };
  timeout: number;
  handler: (r: RazorpaySuccess) => void;
  modal: { ondismiss: () => void };
}
declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

let scriptPromise: Promise<void> | null = null;

export function loadRazorpay(): Promise<void> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.Razorpay) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error("Could not load the payment window."));
      };
      document.body.appendChild(s);
    });
  }
  return scriptPromise;
}

export type CheckoutOutcome =
  | { kind: "paid"; appointmentId: string; result: string }
  | { kind: "dismissed" }
  | { kind: "failed"; message: string }
  | { kind: "verify_error"; message: string };

/** Opens Razorpay Checkout and resolves once the attempt ends. Verification always happens on the server. */
export async function runCheckout(order: CheckoutPayload, clinicName: string, description: string): Promise<CheckoutOutcome> {
  await loadRazorpay();
  const Razorpay = window.Razorpay;
  if (!Razorpay) return { kind: "failed", message: "The payment window is not available. Please reload and try again." };

  return new Promise<CheckoutOutcome>((resolve) => {
    let settled = false;
    const done = (o: CheckoutOutcome) => {
      if (!settled) {
        settled = true;
        resolve(o);
      }
    };
    const rz = new Razorpay({
      key: order.keyId,
      amount: order.amount,
      currency: order.currency,
      order_id: order.orderId,
      name: clinicName,
      description,
      prefill: order.prefill,
      theme: { color: "#3a44c2" },
      timeout: 600,
      handler: async (r) => {
        const res = await api<{ result: string; appointmentId: string }>("/api/payments/verify", "POST", {
          razorpay_order_id: r.razorpay_order_id,
          razorpay_payment_id: r.razorpay_payment_id,
          razorpay_signature: r.razorpay_signature,
        });
        if (res.ok) done({ kind: "paid", appointmentId: res.data.appointmentId, result: res.data.result });
        else done({ kind: "verify_error", message: res.message });
      },
      modal: { ondismiss: () => done({ kind: "dismissed" }) },
    });
    rz.on("payment.failed", (f) => {
      const reason = f.error?.description ?? "The payment failed.";
      void api("/api/payments/failure", "POST", { razorpay_order_id: order.orderId, reason });
      done({ kind: "failed", message: reason });
    });
    rz.open();
  });
}
