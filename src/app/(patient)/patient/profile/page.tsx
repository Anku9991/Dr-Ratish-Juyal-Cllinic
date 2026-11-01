import type { Metadata } from "next";
import { requirePageRole, requirePatientId } from "@/lib/auth";
import { supabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin";
import { Alert, Card, PageHeader } from "@/components/ui";
import { PatientProfileForm } from "@/components/client/PatientProfileForm";

export const metadata: Metadata = { title: "My profile" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const { welcome } = await searchParams;
  const user = await requirePageRole("patient");
  const patientId = await requirePatientId(user);
  let p: { patient_code?: string; date_of_birth?: string | null; gender?: string | null; address?: string | null; emergency_contact?: string | null } | null = null;
  let m: { allergies?: string | null; medical_history?: string | null } | null = null;
  if (isSupabaseConfigured()) {
    try {
      const admin = supabaseAdmin();
      const [resP, resM] = await Promise.all([
        admin.from("patients").select("patient_code, date_of_birth, gender, address, emergency_contact").eq("id", patientId).maybeSingle(),
        admin.from("patient_medical").select("allergies, medical_history").eq("patient_id", patientId).maybeSingle(),
      ]);
      p = resP.data;
      m = resM.data;
    } catch {
      // Supabase fallback
    }
  }
  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader title="My profile" description={p ? `Patient ID ${p.patient_code}` : undefined} />
      {welcome ? <Alert tone="success" title="Welcome!">Your account is ready. Add a few details so your doctor has what they need.</Alert> : null}
      <Card>
        <PatientProfileForm
          initial={{
            fullName: user.fullName,
            mobile: user.mobile ?? "",
            dateOfBirth: (p?.date_of_birth as string | null) ?? "",
            gender: (p?.gender as string | null) ?? "",
            address: (p?.address as string | null) ?? "",
            emergencyContact: (p?.emergency_contact as string | null) ?? "",
            allergies: (m?.allergies as string | null) ?? "",
            medicalHistory: (m?.medical_history as string | null) ?? "",
          }}
        />
      </Card>
    </div>
  );
}
