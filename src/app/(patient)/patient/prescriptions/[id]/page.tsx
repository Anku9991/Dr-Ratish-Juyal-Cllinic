import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { z } from "zod";
import { requirePageRole, requirePatientId } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PdfViewer } from "@/components/PdfViewer";
import { LinkButton, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Prescription" };

export default async function PrescriptionViewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const user = await requirePageRole("patient");
  const patientId = await requirePatientId(user);
  const { data: rx } = await supabaseAdmin().from("prescriptions").select("id, prescription_number").eq("id", id).eq("patient_id", patientId).eq("status", "issued").maybeSingle();
  if (!rx) notFound();
  return (
    <div>
      <PageHeader title={`Prescription ${rx.prescription_number}`} actions={<LinkButton href="/patient/prescriptions" variant="secondary">All prescriptions</LinkButton>} />
      <PdfViewer prescriptionId={rx.id as string} />
    </div>
  );
}
