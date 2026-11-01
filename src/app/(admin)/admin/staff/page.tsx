import type { Metadata } from "next";
import { requirePageRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PageHeader } from "@/components/ui";
import { StaffManager, type StaffRow } from "@/components/client/StaffManager";
import { listClinicStaff } from "@/lib/firebase/roles";

export const metadata: Metadata = { title: "Staff & Doctors Management" };

export default async function StaffPage() {
  const user = await requirePageRole("admin");

  // Load from Firebase Firestore
  const firebaseStaff = await listClinicStaff();
  const rowsMap = new Map<string, StaffRow>();

  for (const m of firebaseStaff) {
    rowsMap.set(m.email.toLowerCase(), {
      id: m.id,
      full_name: m.fullName,
      email: m.email,
      role: m.role,
      is_active: m.isActive,
      permissions: m.permissions,
    });
  }

  // Also query Supabase if available
  try {
    const { data } = await supabaseAdmin()
      .from("profiles")
      .select("id, full_name, email, role, is_active, permissions")
      .in("role", ["admin", "doctor"])
      .order("created_at");

    if (data) {
      for (const item of data) {
        const email = (item.email as string | null)?.toLowerCase();
        if (email && !rowsMap.has(email)) {
          rowsMap.set(email, {
            id: item.id as string,
            full_name: (item.full_name as string) || "Staff Member",
            email,
            role: (item.role as string) || "admin",
            is_active: item.is_active !== false,
            permissions: (item.permissions as string[]) || [],
          });
        }
      }
    }
  } catch {
    // Supabase optional
  }

  const rows = Array.from(rowsMap.values());

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Staff & Doctors Management"
        description="Add staff members (Receptionists/Admins) and Doctors. They can log in instantly with 1-click Google Sign-In."
      />
      <StaffManager currentUserId={user.id} rows={rows} />
    </div>
  );
}
