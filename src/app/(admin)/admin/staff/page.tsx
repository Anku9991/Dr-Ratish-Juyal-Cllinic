import type { Metadata } from "next";
import { requirePageRole } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Alert, PageHeader } from "@/components/ui";
import { StaffManager } from "@/components/client/StaffManager";

export const metadata: Metadata = { title: "Staff & roles" };

export default async function StaffPage() {
  const user = await requirePageRole("admin");
  if (!user.permissions.includes("manage_staff")) {
    return (
      <div className="max-w-md">
        <PageHeader title="Staff & roles" />
        <Alert tone="warning">You do not have permission to manage staff. Ask another admin with staff-management access to grant it to you.</Alert>
      </div>
    );
  }
  const { data } = await supabaseAdmin().from("profiles").select("id, full_name, email, is_active, permissions").eq("role", "admin").order("created_at");
  const rows = (data ?? []) as unknown as Array<{ id: string; full_name: string; email: string | null; is_active: boolean; permissions: string[] }>;
  return (
    <div className="max-w-2xl">
      <PageHeader title="Staff & roles" description="Grant clinic administrators explicit access to sensitive areas." />
      <StaffManager currentUserId={user.id} rows={rows} />
    </div>
  );
}
