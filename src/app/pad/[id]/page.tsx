import type { Metadata } from "next";
import { ExternalPadClient } from "./ExternalPadClient";

export const metadata: Metadata = {
  title: "Doctor Prescription Pad - Dr. Ratish Juyal Clinic",
};

export default async function PadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      <ExternalPadClient appointmentId={id} />
    </div>
  );
}
