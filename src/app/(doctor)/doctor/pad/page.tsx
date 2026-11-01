import type { Metadata } from "next";
import { requirePageRole, requireDoctorId } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { DigitalPrescriptionPad } from "@/components/client/DigitalPrescriptionPad";

export const metadata: Metadata = { title: "Digital Prescription Pad" };

export default async function DoctorPadWorkspacePage() {
  const user = await requirePageRole("doctor");
  await requireDoctorId(user);
  const demoAppointmentId = "live-pad-workspace";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Doctor Digital Prescription Pad"
        actions={
          <span className="text-xs text-muted">
            Auto-saves to Firebase in real time • Stylus / Touch / External Device
          </span>
        }
      />

      <div className="space-y-4">
        <p className="text-sm text-muted">
          Use this digital writing pad with your mouse, stylus pen, Apple Pencil, or connect an external tablet
          (iPad, Samsung Galaxy Tab, XP-Pen/Wacom). Strokes and prescriptions are auto-saved to Firebase.
        </p>

        <DigitalPrescriptionPad
          appointmentId={demoAppointmentId}
          doctorName={user.fullName}
          compact={false}
        />
      </div>
    </div>
  );
}
