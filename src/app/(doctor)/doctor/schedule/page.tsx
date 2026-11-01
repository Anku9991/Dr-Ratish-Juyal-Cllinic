import type { Metadata } from "next";
import { requirePageRole, requireDoctorId } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Card, PageHeader } from "@/components/ui";
import { ScheduleEditor } from "@/components/client/ScheduleEditor";
import { LeaveManager } from "@/components/client/LeaveManager";

export const metadata: Metadata = { title: "Schedule & leave" };

export default async function DoctorSchedulePage() {
  const user = await requirePageRole("doctor");
  const doctorId = await requireDoctorId(user);
  const admin = supabaseAdmin();
  const [{ data: rules }, { data: leaves }] = await Promise.all([
    admin.from("doctor_schedules").select("weekday, start_time, end_time, slot_duration_minutes, is_active").eq("doctor_id", doctorId),
    admin.from("doctor_leaves").select("id, leave_date, reason").eq("doctor_id", doctorId).gte("leave_date", new Date().toISOString().slice(0, 10)).order("leave_date"),
  ]);
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Schedule & leave" description="Set your weekly availability and mark upcoming leave days. Changes apply to new bookings; existing appointments are not affected." />
      <Card>
        <h2 className="mb-3 font-semibold">Weekly availability</h2>
        <ScheduleEditor
          doctorId={doctorId}
          initial={(rules ?? []).map((r) => ({ weekday: r.weekday as number, startTime: (r.start_time as string).slice(0, 5), endTime: (r.end_time as string).slice(0, 5), slotMinutes: r.slot_duration_minutes as number, isActive: r.is_active as boolean }))}
        />
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Upcoming leave</h2>
        <LeaveManager url="/api/doctor/leaves" rows={(leaves ?? []) as never} />
      </Card>
    </div>
  );
}
