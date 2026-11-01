# Testing report

## What actually ran, in this environment
This sandbox has npm registry access but **no network access to Supabase or Razorpay**. Everything
below was executed here and the output is real; nothing is claimed to pass without having run it.

| Command | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | **Pass**, 0 errors |
| `npm run lint` (ESLint, `@typescript-eslint/no-explicit-any` and `no-unused-vars` as errors) | **Pass**, 0 errors |
| `npm run build` (`next build`, production mode) | **Pass** — compiles and generates all routes with no type or lint errors |
| `npm test` (Vitest) | **Pass — 61/61 tests** |

### Test breakdown (61 tests, 3 files)
- `tests/unit/slots.test.ts` (19 tests) — slot generation (working hours, past-time exclusion,
  leave/holiday exclusion, taken-slot exclusion, horizon limit), schedule overlap detection,
  timezone conversion (IST offset correctness, round-trips, invalid date/time rejection, including
  Feb 30 as an explicit invalid-calendar-date case), age calculation, money conversion (rupees <->
  paise, including a rejected malformed amount), appointment/payment status-transition rules, and
  Razorpay HMAC signature verification (checkout + webhook, including tampered-signature
  rejection) and webhook payload parsing.
- `tests/unit/pdf.test.ts` (6 tests) — prescription PDF generation: produces a valid loadable PDF;
  spills correctly onto additional pages for a long medicine list; does not throw with all optional
  fields (logo, signature, vitals, advice, follow-up) absent; renders the amended/cancelled status
  banner; replaces unencodable characters (tested with Devanagari script) instead of throwing;
  `wrapText` hard-breaks an overlong single word instead of overflowing the column.
- `tests/integration/booking.test.ts` (26 tests) — runs the **real SQL migrations** and the **real
  service layer** (`src/lib/payments.ts`) against an in-process Postgres
  ([PGlite](https://pglite.dev)), with a fake Razorpay gateway that produces real HMAC signatures.
  Covers: slot holds, the double-booking guard (two patients cannot both confirm the same slot,
  verified by having patient 2's hold attempt fail after patient 1 has moved to
  `pending_payment`), doctor-leave/clinic-holiday rejection, fee-from-database order creation
  (never trusting a client amount), order reuse on retry, signature-verified payment confirmation,
  rejection of a tampered signature, idempotent double-confirmation, retrying a failed payment on
  the same order, webhook confirmation, webhook signature rejection, **duplicate webhook delivery
  handled idempotently** (same event ID processed once), payment-failed webhook handling,
  cancellation with automatic full refund outside the cancellation window, no refund inside the
  window, a patient cannot cancel another patient's appointment, admin refund cannot exceed the
  refundable balance, prescription finalization requires a diagnosis and a medicine, finalizing
  completes the appointment, **an issued prescription cannot be edited directly** (the immutability
  trigger fires), amending creates a new editable draft while marking the original `amended`, and a
  doctor cannot finalize another doctor's consultation.
- `tests/integration/rls.test.ts` (10 tests) — runs actual Postgres `SELECT`s as `authenticated`
  role with `auth.uid()` set per test, against RLS policies from `0003_rls.sql`, exactly as
  PostgREST/Supabase would evaluate them. Confirms: a patient cannot read another patient's
  appointment or medical record; a doctor cannot read a still-unpaid (`pending_payment`) hold as if
  it were their patient; a doctor cannot read another doctor's patient's appointment; a doctor
  cannot read the `payments` table at all; a plain admin (no `medical_records` permission) cannot
  read consultations, but an admin *with* that permission can; a patient cannot read a draft
  consultation, only their own finalized one; `audit_logs` is admin-only to read and its
  immutability trigger rejects `UPDATE`; and the public doctor/clinic views expose only the
  intended columns.

## What is written but NOT run here (no network in this sandbox)
- `tests/e2e/booking-flow.spec.ts` (Playwright) — the full spec's required sequence: patient
  login, select doctor, select date, select slot, create a Razorpay test-mode order, pay with
  Razorpay's documented test card, verify the callback, confirm the appointment, doctor login,
  doctor opens the appointment, doctor creates and finalizes a prescription, patient views the
  prescription PDF — plus a second test asserting a slot held by one patient disappears for
  another. It is TypeScript-checked and lint-clean, but **has not been executed**, because it
  needs a real Supabase project, real Razorpay test keys, and a running browser. Run it yourself:
  ```bash
  cp .env.example .env.local   # fill in real Supabase + Razorpay TEST credentials
  npx supabase db push         # apply migrations to that project
  npm run seed                 # creates patient.one@example.com / dr.asha@... / Demo@1234
  npx playwright install chromium
  npm run test:e2e
  ```
- Any check that requires a live Supabase Auth server (real registration/login), Supabase Storage
  (real file upload of a logo/signature), or the Razorpay dashboard (real order creation, real
  webhook delivery, real refund) — these are exercised via unit/integration tests against
  faithful fakes (see above), not against the live services.
- Load/performance testing, accessibility audit beyond semantic HTML/ARIA used throughout,
  cross-browser testing.

## Re-running everything
```bash
npm run typecheck && npm run lint && npm test && npm run build
```
