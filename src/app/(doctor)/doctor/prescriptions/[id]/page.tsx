import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { z } from "zod";
import { requirePageRole, requireDoctorId } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { PdfViewer } from "@/components/PdfViewer";
import { Alert, Badge, LinkButton, PageHeader } from "@/components/ui";
import { AmendPrescription, CancelPrescription } from "@/components/client/PrescriptionActions";

export const metadata: Metadata = { title: "Prescription" };

export default async function DoctorPrescriptionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const user = await requirePageRole("doctor");
  const doctorId = await requireDoctorId(user);
  const { data: rx } = await supabaseAdmin().from("prescriptions").select("id, prescription_number, status, status_reason").eq("id", id).eq("doctor_id", doctorId).maybeSingle();
  if (!rx || rx.status === "draft") notFound();

  return (
    <div>
      <PageHeader
        title={`Prescription ${rx.prescription_number}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge tone={rx.status === "issued" ? "success" : rx.status === "amended" ? "warning" : "danger"}>{rx.status}</Badge>
            {rx.status === "issued" ? (
              <>
                <AmendPrescription prescriptionId={rx.id as string} />
                <CancelPrescription prescriptionId={rx.id as string} />
              </>
            ) : null}
            <LinkButton href="/doctor/prescriptions" variant="secondary">
              All prescriptions
            </LinkButton>
          </div>
        }
      />
      {rx.status !== "issued" ? <Alert tone={rx.status === "amended" ? "warning" : "danger"}>{rx.status_reason ?? `This prescription is ${rx.status}.`}</Alert> : null}
      <div className="mt-4">
        <PdfViewer prescriptionId={rx.id as string} />
      </div>
    </div>
  );
}
