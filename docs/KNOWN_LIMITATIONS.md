# Known limitations

Read before real clinic deployment.

## Legal / compliance
- **Terms of use and Privacy policy are template text**, clearly marked as such in the pages
  themselves. They must be reviewed by a lawyer against the Digital Personal Data Protection Act,
  2023, and any applicable state medical-council or clinical-establishment rules, before go-live.
- No explicit patient consent flow for storing health data beyond the terms checkbox at
  registration. If your jurisdiction requires a separate, itemized consent record, add one.
- Record retention (`record_retention_years` in Clinic settings) is a number the admin sets, but
  nothing in the app currently **enforces** deletion or archival at that boundary — it is
  informational text on the Privacy page only.

## Payments
- Automatic refund on patient cancellation assumes the clinic wants a simple binary policy (full
  refund outside the window, no refund inside it). Partial-refund-on-late-cancellation policies
  would need a small change to `cancelAppointment` in `src/lib/payments.ts`.
- The rate limiter (`src/lib/rate-limit.ts`) is in-memory per server instance — adequate to slow
  casual abuse, but not real enforcement on Vercel's multi-instance, short-lived serverless
  functions. For real enforcement, swap it for a shared store (e.g. Upstash Redis) behind the same
  function signature; the call sites do not need to change.
- No reconciliation job that cross-checks Razorpay's own records against the local `payments`
  table for payments that never generated a webhook (rare, but possible on Razorpay's side). Add a
  periodic job calling Razorpay's payments-list API if this matters for your volume.

## Scheduling
- One working session per weekday per doctor in the schedule editor UI (e.g. "9am-1pm Mon-Fri").
  The database (`doctor_schedules`) supports multiple sessions per day (e.g. a morning and evening
  block) — the admin/doctor UI just doesn't expose adding a second row per day yet. The API
  (`PUT /api/admin/doctors/:id/schedules`) already accepts an arbitrary list of rules.
- No buffer time between appointments beyond the slot duration itself.
- No SMS/email/WhatsApp appointment reminders — the spec did not require them, and none of the
  necessary third-party integration (an SMS gateway) is wired up.

## Accounts
- No forced password change on first login for doctor/admin accounts created with a temporary
  password by the admin. Communicate the temporary password securely and ask the user to change it
  (Supabase Auth supports self-service password change; a "change password" UI is not built —
  add one under `/doctor/profile` and `/admin` if needed, or point users at Supabase's hosted flow).
- No 2FA. Supabase Auth supports it; wiring it up was out of scope here.
- Email is the only login identifier; OTP-based mobile login (mentioned as an option in the spec)
  is not implemented — email/password is.

## Prescriptions
- PDF text uses the standard PDF Helvetica fonts, which only support the WinAnsi character set.
  Non-Latin scripts (e.g. Hindi in Devanagari) are replaced with `?` rather than rendered (verified
  in `tests/unit/pdf.test.ts`) rather than corrupting the file. For real Devanagari support, embed a
  Unicode-covering TTF font (e.g. Noto Sans Devanagari) via `pdf-lib` + `@pdf-lib/fontkit`.
- No e-signature/digital-signature standard (e.g. DSC) applied to the PDF — the doctor's uploaded
  signature image is visually embedded, which is not the same as a legally binding digital
  signature. Confirm what your jurisdiction requires for e-prescriptions.

## Operational
- The cron endpoint (`/api/cron/expire`) must be scheduled externally (Vercel Cron config in
  `docs/DEPLOYMENT.md`); without it, expired holds/appointments are only cleaned up lazily, the
  next time `create_hold` happens to run (it calls `expire_stale_holds()` itself), which is
  functionally fine but means the admin dashboard's "today's appointments" count could briefly
  include a just-expired appointment until the next hold attempt or cron tick.
- No structured application logging/monitoring integration (e.g. Sentry). Errors are `console.error`
  only, deliberately without request bodies or medical content (see `src/lib/api.ts`).

## Testing
- See `docs/TESTING.md` for exactly what ran here vs. what requires a real Supabase/Razorpay
  environment (Playwright E2E, real Auth/Storage, live payments) and has not been executed in this
  sandbox.
