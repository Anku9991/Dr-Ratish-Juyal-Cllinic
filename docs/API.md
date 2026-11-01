# API reference

All routes are Next.js Route Handlers under `src/app/api/`. Responses are JSON. Errors are
`{ "error": { "code": "...", "message": "...", "details"?: {...} } }` with an HTTP status code
matching the error (see `src/lib/errors.ts` for the full code list). Validation errors (422)
include `details` as a field-path -> message map.

Every mutating route requires the Supabase session cookie (set by `/api/auth/login`) except the
Razorpay webhook, which is authenticated by HMAC signature, and the cron endpoint, which is
authenticated by a bearer secret. Role-gated routes 401 if signed out and 403 if signed in as the
wrong role.

## Auth
| Route | Method | Role | Body |
|---|---|---|---|
| `/api/auth/register` | POST | public | `{ fullName, email, mobile, password, acceptTerms }` |
| `/api/auth/login` | POST | public | `{ email, password, next? }` -> `{ redirect }` |
| `/api/auth/logout` | POST | any | - |

## Public
| Route | Method | Notes |
|---|---|---|
| `/api/doctors/:id/slots?date=YYYY-MM-DD` | GET | Bookable slots for a doctor on a date |

## Booking & payments (patient)
| Route | Method | Body / notes |
|---|---|---|
| `/api/booking/hold` | POST | `{ doctorId, date, startTime }` -> holds a slot for `slot_hold_minutes` |
| `/api/booking/checkout` | POST | `{ holdToken, reason? }` -> creates the pending appointment + Razorpay order |
| `/api/appointments/:id/pay` | POST | Retry: reuses or recreates the order for a still-pending appointment |
| `/api/appointments/:id/cancel` | POST | `{ reason? }` -> cancels; auto-refunds if outside the cancellation window |
| `/api/payments/verify` | POST | `{ razorpay_order_id, razorpay_payment_id, razorpay_signature }`, called by the Checkout success handler |
| `/api/payments/failure` | POST | `{ razorpay_order_id, reason? }`, called by the Checkout failure handler |
| `/api/payments/webhook` | POST | Razorpay webhook (public URL, HMAC-verified, idempotent) |
| `/api/patient/profile` | PUT | Patient demographics + allergies/history |

## Doctor
| Route | Method | Notes |
|---|---|---|
| `/api/doctor/appointments/:id/status` | POST | `{ status, reason? }` — check-in / no-show only (completion happens via finalize) |
| `/api/doctor/consultations/:appointmentId` | PUT | Saves a consultation + prescription draft |
| `/api/doctor/consultations/:appointmentId/finalize` | POST | Saves + issues the prescription, completes the appointment |
| `/api/doctor/prescriptions/:id/amend` | POST | `{ reason }` -> new editable draft, original marked amended |
| `/api/doctor/prescriptions/:id/cancel` | POST | `{ reason }` |
| `/api/doctor/leaves` | POST / DELETE | Own leave days |
| `/api/doctor/signature` | POST | multipart `file` (PNG/JPEG, <1MB) |
| `/api/doctor/profile` | PUT | Qualification + bio only |

## Prescriptions
| Route | Method | Notes |
|---|---|---|
| `/api/prescriptions/:id/pdf` | GET | Streams the PDF; access-checked per role; `?download=1` forces attachment |

## Admin
| Route | Method | Notes |
|---|---|---|
| `/api/admin/doctors` | POST | Creates a doctor login + profile |
| `/api/admin/doctors/:id` | PATCH | Edit doctor fields / activate-deactivate |
| `/api/admin/doctors/:id/schedules` | PUT | `{ rules: [...] }` replaces the weekly schedule atomically |
| `/api/admin/doctors/:id/leaves` | POST / DELETE | Any doctor's leave days |
| `/api/admin/holidays` | POST / DELETE | Clinic-wide holidays |
| `/api/admin/settings` | PUT | Clinic name/address/timezone/policy settings |
| `/api/admin/logo` | POST | multipart `file` |
| `/api/admin/staff` | POST / PUT | Create staff; change permissions/active state (requires `manage_staff`) |
| `/api/admin/appointments/:id/status` | POST | Staff-driven status changes, including cancel-with-refund |
| `/api/admin/payments/:id/refund` | POST | `{ amountRupees, reason }` |
| `/api/admin/patients/:id` | PATCH | `{ isActive }` |
| `/api/cron/expire` | GET | Bearer `CRON_SECRET`; releases expired holds/appointments |

See `src/lib/validation.ts` for the exact Zod schema (and therefore exact validation rules) behind
every request body.
