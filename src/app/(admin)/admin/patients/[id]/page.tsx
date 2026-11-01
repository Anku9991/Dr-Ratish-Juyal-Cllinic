import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { z } from "zod";
import { requirePageRole } from "@/lib/auth";
import { getClinicSettings } from "@/lib/clinic";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatInstant } from "@/lib/time";
import { AppointmentBadge, Badge, Card, DefinitionList, PageHeader, TableWrap, td, th } from "@/components/ui";
import { ApiButton } from "@/components/client/ApiButton";

export const metadata: Metadata = { title: "Patient" };

export default async function AdminPatientDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  await requirePageRole("admin");
  const admin = supabaseAdmin();
  const settings = await getClinicSettings();
  const { data: patient } = await admin.from("patients").select("*, profiles!inner(full_name, email, mobile, is_active)").eq("id", id).maybeSingle();
  if (!patient) notFound();
  const profile = Array.isArray(patient.profiles) ? patient.profiles[0] : patient.profiles;
  const { data: appts } = await admin.from("appointments").select("id, appointment_number, starts_at, status, doctors!inner(profiles!inner(full_name))").eq("patient_id", id).order("starts_at", { ascending: false }).limit(20);
  const rows = (appts ?? []) as unknown as Array<{ id: string; appointment_number: string; starts_at: string; status: string; doctors: { profiles: { full_name: string } } }>;

  return (
    <div className="space-y-6">
      <PageHeader
        title={profile?.full_name as string}
        description={patient.patient_code as string}
        actions={
          <ApiButton url={`/api/admin/patients/${id}`} method="PATCH" body={{ isActive: !profile?.is_active }} variant={profile?.is_active ? "danger" : "primary"} confirm={profile?.is_active ? "Deactivate this patient account?" : undefined}>
            {profile?.is_active ? "Deactivate account" : "Activate account"}
          </ApiButton>
        }
      />
      <Card>
        <DefinitionList
          items={[
            ["Email", profile?.email as string | null],
            ["Mobile", profile?.mobile as string | null],
            ["Date of birth", patient.date_of_birth as string | null],
            ["Gender", patient.gender as string | null],
            ["Status", <Badge key="s" tone={profile?.is_active ? "success" : "neutral"}>{profile?.is_active ? "Active" : "Inactive"}</Badge>],
          ]}
        />
      </Card>
      <div>
        <h2 className="mb-3 text-lg font-semibold">Appointments</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-muted">No appointments yet.</p>
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <th className={th}>Appointment</th>
                <th className={th}>Doctor</th>
                <th className={th}>When</th>
                <th className={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td className={td}>{a.appointment_number}</td>
                  <td className={td}>{a.doctors.profiles.full_name}</td>
                  <td className={`${td} whitespace-nowrap`}>{formatInstant(a.starts_at, settings.timezone)}</td>
                  <td className={td}>
                    <AppointmentBadge status={a.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        )}
      </div>
    </div>
  );
}
