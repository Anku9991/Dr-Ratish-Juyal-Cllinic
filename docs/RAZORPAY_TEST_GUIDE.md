# Razorpay test setup

## 1. Get test keys
In the [Razorpay Dashboard](https://dashboard.razorpay.com), switch to **Test Mode** (toggle,
top-left), then Settings -> API Keys -> Generate Test Key. You get a `rzp_test_...` Key ID and a
Key Secret.

## 2. Configure a webhook
Settings -> Webhooks -> Add New Webhook.
- URL: `https://<your-deployment>/api/payments/webhook` (must be publicly reachable — for local
  dev, use `ngrok http 3000` or similar and point the webhook at the tunnel URL)
- Secret: generate one and save it as `RAZORPAY_WEBHOOK_SECRET`
- Active events: `payment.authorized`, `payment.captured`, `payment.failed`, `refund.processed`

## 3. Environment variables
```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=<key secret>
RAZORPAY_WEBHOOK_SECRET=<webhook secret>
```
`RAZORPAY_KEY_ID` only (never the secret) is also sent to the browser to open Checkout — see
`src/lib/checkout-payload.ts`.

## 4. Test cards and flows
Razorpay's documented test instruments (test mode only, see their docs for the current list):
- **Card:** `4111 1111 1111 1111`, any future expiry, any CVV. OTP `111111` (or the code from the
  test popup).
- **Card that always fails:** `4000 0000 0000 0002` (or similar; check the Razorpay test-card list
  in the dashboard for the current failure card, as these values occasionally change).
- **UPI (test mode):** `success@razorpay` to succeed, `failure@razorpay` to fail.

## 5. What to verify manually before go-live
- [ ] A successful test payment confirms the appointment and shows the receipt.
- [ ] A failed test payment leaves the appointment `pending_payment` and retryable until the hold
      expires (`slot_hold_minutes` in Clinic settings).
- [ ] Dismissing the Checkout modal (closing it without paying) does the same.
- [ ] The webhook fires and `/api/payments/webhook` returns 200 (check Razorpay's webhook log for
      delivery status — a non-200 response there means it will retry).
- [ ] Sending the same webhook event twice (Razorpay's dashboard has a "resend" button) does not
      double-confirm or double-process the appointment.
- [ ] A refund issued from Admin -> Payments shows up correctly and, in Test Mode, in the Razorpay
      dashboard's refund log.
- [ ] Switch `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET`/`RAZORPAY_WEBHOOK_SECRET` to **live** keys only
      after all of the above pass, and re-point the webhook URL at the live keys' webhook config
      (test and live webhooks are configured separately in the Razorpay dashboard).

This sandbox has no network access to Razorpay, so none of the above has been exercised here — the
integration tests (`tests/integration/booking.test.ts`) exercise the same code paths (signature
verification, order creation, webhook idempotency, refunds) against a fake gateway instead. Run
this checklist yourself against real Razorpay test mode before go-live.
