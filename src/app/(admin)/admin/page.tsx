import type { Metadata } from "next";
import { requirePageRole } from "@/lib/auth";
import { getClinicSettings, isClinicConfigured } from "@/lib/clinic";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { dateInTz, addDays } from "@/lib/time";
import { formatINR } from "@/lib/money";
import { Alert, Card, LinkButton, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Admin dashboard" };
export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  await requirePageRole("admin");
  const settings = await getClinicSettings();
  const admin = supabaseAdmin();
  const today = dateInTz(new Date(), settings.timezone);
  const weekAgo = addDays(today, -6);

  const [todayCount, weekApptsRes, doctorCount, patientCount, refundsDue] = await Promise.all([
    admin.from("appointments").select("id", { count: "exact", head: true }).eq("appointment_date", today).in("status", ["confirmed", "checked_in", "in_consultation", "completed"]),
    admin.from("payments").select("amount, status, created_at").gte("created_at", `${weekAgo}T00:00:00Z`).in("status", ["captured", "refunded", "partially_refunded"]),
    admin.from("doctors").select("id", { count: "exact", head: true }).eq("is_active", true),
    admin.from("patients").select("id", { count: "exact", head: true }),
    admin.from("payments").select("id", { count: "exact", head: true }).eq("refund_required", true),
  ]);
  const weekRevenue = (weekApptsRes.data ?? []).reduce((sum, p) => sum + (p.amount as number), 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" actions={<LinkButton href="/admin/doctors/new">Add doctor</LinkButton>} />
      {!isClinicConfigured(settings) ? (
        <Alert tone="warning" title="Finish setting up the clinic">
          Add the clinic name, address and phone in{" "}
          <LinkButton href="/admin/settings" variant="ghost" className="!p-0 !text-inherit underline">
            Clinic settings
          </LinkButton>{" "}
          so patients see it and prescriptions can be issued.
        </Alert>
      ) : null}
      {(refundsDue.count ?? 0) > 0 ? (
        <Alert tone="danger" title="Refunds awaiting action">
          {refundsDue.count} payment{refundsDue.count === 1 ? "" : "s"} need a refund to be processed.{" "}
          <LinkButton href="/admin/payments?filter=refund_due" variant="ghost" className="!p-0 !text-inherit underline">
            Review
          </LinkButton>
        </Alert>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <p className="text-xs text-muted">Today&apos;s appointments</p>
          <p className="mt-1 text-2xl font-semibold">{todayCount.count ?? 0}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Revenue, last 7 days</p>
          <p className="mt-1 text-2xl font-semibold">{formatINR(weekRevenue)}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Active doctors</p>
          <p className="mt-1 text-2xl font-semibold">{doctorCount.count ?? 0}</p>
        </Card>
        <Card>
          <p className="text-xs text-muted">Registered patients</p>
          <p className="mt-1 text-2xl font-semibold">{patientCount.count ?? 0}</p>
        </Card>
      </div>
    </div>
  );
}
