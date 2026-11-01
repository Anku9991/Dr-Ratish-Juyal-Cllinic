import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { requirePageRole } from "@/lib/auth";
import { getPublicClinic, clinicDisplayName } from "@/lib/clinic";

const NAV = [
  { href: "/doctor", label: "Today" },
  { href: "/doctor/appointments", label: "Upcoming" },
  { href: "/doctor/pad", label: "✍️ Prescription Pad" },
  { href: "/doctor/prescriptions", label: "Issued prescriptions" },
  { href: "/doctor/schedule", label: "Schedule & leave" },
  { href: "/doctor/profile", label: "My profile" },
];

export default async function DoctorLayout({ children }: { children: ReactNode }) {
  const user = await requirePageRole("doctor");
  const clinic = await getPublicClinic();
  return (
    <AppShell clinicName={clinicDisplayName(clinic)} roleLabel="Doctor" userName={user.fullName} nav={NAV}>
      {children}
    </AppShell>
  );
}
