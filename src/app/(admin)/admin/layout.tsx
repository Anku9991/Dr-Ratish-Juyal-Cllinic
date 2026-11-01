import type { ReactNode } from "react";
import { AppShell } from "@/components/AppShell";
import { requirePageRole } from "@/lib/auth";
import { getPublicClinic, clinicDisplayName } from "@/lib/clinic";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/doctors", label: "Doctors" },
  { href: "/admin/patients", label: "Patients" },
  { href: "/admin/appointments", label: "Appointments" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/settings", label: "Clinic settings" },
  { href: "/admin/staff", label: "Staff & roles" },
  { href: "/admin/audit-logs", label: "Audit logs" },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await requirePageRole("admin");
  const clinic = await getPublicClinic();
  return (
    <AppShell clinicName={clinicDisplayName(clinic)} roleLabel="Admin" userName={user.fullName} nav={NAV}>
      {children}
    </AppShell>
  );
}
