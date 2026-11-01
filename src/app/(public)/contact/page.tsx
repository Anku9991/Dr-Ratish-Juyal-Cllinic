import type { Metadata } from "next";
import { getPublicClinic, clinicDisplayName, isClinicConfigured } from "@/lib/clinic";
import { Alert, Card, DefinitionList, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Contact the clinic" };

export default async function ContactPage() {
  const clinic = await getPublicClinic();
  return (
    <div className="max-w-2xl">
      <PageHeader title="Contact the clinic" />
      {!isClinicConfigured(clinic) ? (
        <Alert tone="info" title="Contact details are not published yet">
          The clinic is still being set up. Please check back soon.
        </Alert>
      ) : (
        <Card>
          <p className="mb-4 font-medium">{clinicDisplayName(clinic)}</p>
          <DefinitionList
            items={[
              ["Address", <span key="a" className="whitespace-pre-line">{clinic.address}</span>],
              ["OPD Timings", <span key="t" className="font-semibold text-emerald-700">12:00 PM – 05:00 PM (Monday to Saturday)</span>],
              ["Phone", clinic.phone ? <a key="p" href={`tel:${clinic.phone}`} className="text-brand-700 hover:underline">{clinic.phone}</a> : null],
              ["Email", clinic.email ? <a key="e" href={`mailto:${clinic.email}`} className="text-brand-700 hover:underline">{clinic.email}</a> : null],
            ]}
          />
          <p className="mt-5 text-sm text-muted">Specialities: Neurology, Brain & Spine Disorders, Neuro-Physiotherapy & Rehabilitation.</p>
        </Card>
      )}
    </div>
  );
}
