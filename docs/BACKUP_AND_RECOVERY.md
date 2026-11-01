# Database backup & recovery

## Automatic backups (Supabase-managed)
Supabase takes automatic daily backups on paid plans (Point-in-Time Recovery, PITR, is available
on Pro+ and lets you restore to any point within the retention window, not just daily snapshots).
Enable PITR for a clinic system — payment and medical records should not depend on a once-daily
snapshot alone. Dashboard -> Database -> Backups.

## Manual backups
```bash
# Full logical dump (schema + data)
npx supabase db dump --db-url "<connection string>" -f backup-$(date +%F).sql

# Schema only (useful before applying a new migration, to diff against)
npx supabase db dump --db-url "<connection string>" --schema-only -f schema-$(date +%F).sql
```
Store dumps encrypted and off-platform (a separate cloud storage bucket/account from Supabase
itself), on a schedule matching the clinic's data-retention and compliance requirements.

## Storage (prescriptions, logos, signatures)
Supabase Storage buckets are not included in `supabase db dump`. Back them up separately:
```bash
# Example: sync a bucket to local disk with the Supabase CLI or rclone against the S3-compatible endpoint
npx supabase storage cp --recursive supabase://prescriptions ./backup/prescriptions
```
Since prescription PDFs are regenerated on demand if missing (see
`src/lib/prescriptions.ts::getPrescriptionPdf`), losing this bucket does not lose data as long as
the `prescriptions`/`consultations` tables are intact — but back it up anyway to avoid regenerating
thousands of PDFs under load after an incident.

## Recovery drill (do this before go-live, not after an incident)
1. Restore a dump into a fresh, disposable Supabase project (or local Postgres).
2. Run `npm run build && npm run start` against it with test env vars.
3. Confirm: patient login works, an appointment is visible, a prescription PDF renders.
4. Time the drill. That duration is your realistic recovery time — document it for the clinic.

## What is NOT backed up by database dumps
- Auth users (`auth.users`) — included in a full `supabase db dump` of the `auth` schema, but
  confirm this explicitly for your Supabase plan; some export tooling defaults to `public` schema
  only.
- Storage bucket contents (see above — back up separately).
- Environment variables / secrets (Razorpay keys, service role key) — keep these in your own
  password manager or secrets vault, not only in Vercel's dashboard.
