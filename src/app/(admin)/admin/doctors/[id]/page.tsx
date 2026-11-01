import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { z } from "zod";
import { requirePageRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Card, PageHeader } from "@/components/ui";
import { EditDoctorForm } from "@/components/client/AdminDoctorForm";
import { ScheduleEditor } from "@/components/client/ScheduleEditor";
import { LeaveManager } from "@/components/client/LeaveManager";

export const metadata: Metadata = { title: "Edit doctor" };

export default async function AdminDoctorDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  await requirePageRole("admin");
  const admin = supabaseAdmin();
  const [{ data: doc }, { data: rules }, { data: leaves }] = await Promise.all([
    admin.from("doctors").select("*, profiles!inner(full_name)").eq("id", id).maybeSingle(),
    admin.from("doctor_schedules").select("weekday, start_time, end_time, slot_duration_minutes, is_active").eq("doctor_id", id),
    admin.from("doctor_leaves").select("id, leave_date, reason").eq("doctor_id", id).gte("leave_date", new Date().toISOString().slice(0, 10)).order("leave_date"),
  ]);
  if (!doc) notFound();
  const profile = Array.isArray(doc.profiles) ? doc.profiles[0] : doc.profiles;

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title={profile?.full_name as string} description={doc.doctor_code as string} />
      <Card>
        <h2 className="mb-3 font-semibold">Details</h2>
        <EditDoctorForm
          doctorId={id}
          initial={{
            fullName: profile?.full_name as string,
            speciality: doc.speciality as string,
            qualification: (doc.qualification as string | null) ?? "",
            registrationNumber: (doc.registration_number as string | null) ?? "",
            consultationFee: Number(doc.consultation_fee),
            bio: (doc.bio as string | null) ?? "",
            isActive: doc.is_active as boolean,
          }}
        />
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Weekly availability</h2>
        <ScheduleEditor
          doctorId={id}
          initial={(rules ?? []).map((r) => ({ weekday: r.weekday as number, startTime: (r.start_time as string).slice(0, 5), endTime: (r.end_time as string).slice(0, 5), slotMinutes: r.slot_duration_minutes as number, isActive: r.is_active as boolean }))}
        />
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Upcoming leave</h2>
        <LeaveManager url={`/api/admin/doctors/${id}/leaves`} rows={(leaves ?? []) as never} />
      </Card>
    </div>
  );
}
