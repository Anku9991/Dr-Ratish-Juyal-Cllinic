import type { Metadata } from "next";
import { requirePageRole, requireDoctorId } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { formatRupees } from "@/lib/money";
import { Card, DefinitionList, PageHeader } from "@/components/ui";
import { DoctorProfileForm } from "@/components/client/DoctorProfileForm";
import { SignatureUpload } from "@/components/client/SignatureUpload";

export const metadata: Metadata = { title: "My profile" };

export default async function DoctorProfilePage() {
  const user = await requirePageRole("doctor");
  const doctorId = await requireDoctorId(user);
  const { data } = await supabaseAdmin().from("doctors").select("doctor_code, speciality, registration_number, consultation_fee, qualification, bio, signature_storage_path").eq("id", doctorId).single();
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="My profile" />
      <Card>
        <h2 className="mb-3 font-semibold">Set by the clinic</h2>
        <DefinitionList
          items={[
            ["Doctor code", data?.doctor_code as string],
            ["Speciality", data?.speciality as string],
            ["Registration number", data?.registration_number as string | null],
            ["Consultation fee", data ? formatRupees(data.consultation_fee as number) : null],
          ]}
        />
        <p className="mt-3 text-xs text-muted">To change these, contact the clinic admin.</p>
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Qualification & bio</h2>
        <DoctorProfileForm initial={{ qualification: (data?.qualification as string | null) ?? "", bio: (data?.bio as string | null) ?? "" }} />
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Signature</h2>
        <SignatureUpload hasSignature={Boolean(data?.signature_storage_path)} />
      </Card>
    </div>
  );
}
