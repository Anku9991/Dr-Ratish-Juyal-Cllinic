import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { requirePageRole } from "@/lib/auth";
import { getPublicClinic, clinicDisplayName } from "@/lib/clinic";

const NAV = [
  { href: "/patient", label: "Dashboard" },
  { href: "/patient/book", label: "Book Appointment" },
  { href: "/patient/reports", label: "Medical Reports" },
  { href: "/patient/appointments", label: "My appointments" },
  { href: "/patient/history", label: "Medical history" },
  { href: "/patient/prescriptions", label: "Prescriptions" },
  { href: "/patient/profile", label: "My profile" },
];

export default async function PatientLayout({ children }: { children: ReactNode }) {
  const user = await requirePageRole("patient");
  const clinic = await getPublicClinic();
  return (
    <AppShell clinicName={clinicDisplayName(clinic)} roleLabel="Patient" userName={user.fullName} nav={NAV}>
      {children}
    </AppShell>
  );
}
