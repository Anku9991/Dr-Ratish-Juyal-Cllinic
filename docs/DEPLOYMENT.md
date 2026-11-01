# Deployment: Vercel + Supabase

## 1. Create the Supabase project
1. [supabase.com](https://supabase.com) -> New project. Note the project URL and, from
   Settings -> API, the `anon` and `service_role` keys.
2. Settings -> Database -> Connection string (or use the Supabase CLI) to apply migrations:
   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push   # applies supabase/migrations/*.sql in order
   ```
   Or paste each file in `supabase/migrations/` (0001, 0002, 0003 — in that order) into the SQL
   Editor and run it.
3. Authentication -> Providers -> Email: enable, and decide whether to require email confirmation
   (recommended for production).
4. Authentication -> URL Configuration: set the Site URL to your production domain once you have
   one, so confirmation/reset emails link correctly.
5. Storage: the migration already creates the `prescriptions` and `clinic-assets` buckets as
   private; no manual step needed.

## 2. Configure Razorpay
See [RAZORPAY_TEST_GUIDE.md](RAZORPAY_TEST_GUIDE.md). Do this in test mode first.

## 3. Deploy to Vercel
1. Push this repository to GitHub/GitLab/Bitbucket.
2. [vercel.com](https://vercel.com) -> New Project -> import the repo. Framework preset:
   Next.js (auto-detected).
3. Environment Variables (Project Settings -> Environment Variables), for Production (and
   Preview, with test keys):
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY        (mark as sensitive — never exposed to the browser)
   RAZORPAY_KEY_ID
   RAZORPAY_KEY_SECRET              (sensitive)
   RAZORPAY_WEBHOOK_SECRET          (sensitive)
   NEXT_PUBLIC_APP_URL              (your Vercel URL, e.g. https://clinic.example.com)
   CRON_SECRET                      (sensitive — `openssl rand -hex 32`)
   ```
4. Deploy. Vercel runs `npm run build`.
5. Update the Razorpay webhook URL to `https://<your-vercel-domain>/api/payments/webhook`.
6. Update Supabase Auth's Site URL and Redirect URLs to your Vercel domain.

## 4. Schedule the expiry cron
Slot holds and unpaid appointments need `expire_stale_holds()` run periodically. Add to
`vercel.json` (or the Vercel dashboard -> Cron Jobs):
```json
{
  "crons": [{ "path": "/api/cron/expire", "schedule": "*/5 * * * *" }]
}
```
Vercel Cron sends `Authorization: Bearer $CRON_SECRET` automatically when `CRON_SECRET` is set as
an env var — no extra config needed for the header.

## 5. Seed initial data (optional but recommended)
```bash
# locally, with .env.local pointed at the production Supabase project
npm run seed
```
Change the demo password immediately, or edit `scripts/seed.ts` to use your own doctors/admin
before running it against a real clinic's data.

## 6. Go-live checklist
- [ ] All items in `RAZORPAY_TEST_GUIDE.md`'s manual checklist pass in test mode
- [ ] Switch Razorpay keys to live mode; re-verify one real low-value transaction
- [ ] Admin has set Clinic settings (name, address, phone) — prescriptions cannot be issued until
      this is done (checked server-side)
- [ ] At least one doctor has a signature image uploaded
- [ ] Terms and Privacy Policy pages have been reviewed by a lawyer and updated (they currently
      contain clearly-marked template text — see `src/app/(public)/terms` and `.../privacy`)
- [ ] Confirm the cancellation window, slot hold duration and booking horizon in Clinic settings
      match the clinic's actual policy
- [ ] `npm run build`, `npm run lint`, `npm test` all pass (see `docs/TESTING.md`)
