# Authentication & roles

## Identity vs. role
Supabase Auth handles *who you are* (email/password, session cookies via `@supabase/ssr`).
*What you can do* — patient, doctor, or admin — is a column in `public.profiles`, set only by
server-side code, never by the client-editable `user_metadata` on the auth user. Every new sign-up
becomes a `patient` via a database trigger (`handle_new_user`); the only way to become a doctor or
admin is for the admin panel to promote an account it creates itself
(`src/lib/admin-users.ts::createStaffUser`).

`src/lib/auth.ts::getSessionUser` is the single source of truth used everywhere: it verifies the
session with Supabase (`auth.getUser()`, which round-trips to the auth server rather than trusting
a client-decoded JWT) and then reads the role from `profiles` with the service-role client.

## Route protection, three layers
1. **Middleware** (`src/middleware.ts` + `src/lib/supabase/middleware.ts`) refreshes the session
   cookie and redirects signed-out visitors away from `/patient`, `/doctor`, `/admin` before any
   page code runs.
2. **Page guards** (`requirePageRole` in `src/lib/auth.ts`) redirect a signed-in user with the
   wrong role to their own dashboard.
3. **API guards** (`route()` in `src/lib/api.ts`) check `roles` and, for admin routes that touch
   sensitive data, an explicit `permission` on every request — this is enforced independent of the
   UI, so a crafted request from the wrong role is rejected server-side even if a page guard were
   somehow bypassed.

## Row Level Security
Every table has RLS enabled (`supabase/migrations/0003_rls.sql`). The application's own API routes
use the Supabase **service role**, which bypasses RLS by design — so RLS is not "instead of"
application checks, it is a second, independent layer: if a bug ever let raw Supabase client
credentials (anon key + user session) query the database directly, RLS still confines a user to
their own data. Key rules:
- **Patients** see only their own appointments, payments, and finalized consultations/prescriptions
  (drafts are the doctor's working notes and are hidden until issued).
- **Doctors** see only appointments assigned to them, and only once payment has moved the
  appointment out of `pending_payment` (an unpaid hold is not "their" patient yet).
- **Admin** sees appointments, payments and doctor/patient records by default, but **not**
  `patient_medical` or `consultations`/`prescriptions` content, unless their profile has the
  explicit `medical_records` permission (`ADMIN_PERMISSIONS` in `src/lib/permissions.ts`, granted
  via Staff & roles by another admin with `manage_staff`).
- `audit_logs` is admin-read-only and has a trigger that rejects `UPDATE`/`DELETE` outright — it is
  truly append-only, even for the service role.

## Explicit admin permissions
`profiles.permissions text[]` holds fine-grained grants beyond the `admin` role itself:
`manage_staff` (create/edit other admins) and `medical_records` (read clinical content). An admin
without `manage_staff` cannot see the Staff & roles page's controls, and the API rejects the
request server-side regardless. An admin can never remove their own `manage_staff` or deactivate
themselves (`self_lockout` check in `/api/admin/staff`), to avoid a clinic locking itself out.

## Passwords and sessions
Doctor and admin accounts are created by an admin with a temporary password (must be changed by
the user — there is no forced-change flow built in; note this in your rollout process). Patient
registration requires email confirmation if your Supabase project has it enabled (the default).
Sessions are Supabase's own (JWT + refresh token in httpOnly cookies via `@supabase/ssr`); this app
does not implement its own session or token logic.
