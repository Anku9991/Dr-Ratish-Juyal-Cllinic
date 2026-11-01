import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { z } from "zod";
import { getPublicClinic, getPublicDoctor } from "@/lib/clinic";
import { doctorFee, initials } from "@/lib/public-format";
import { dateInTz } from "@/lib/time";
import { PublicSlotBrowser } from "@/components/client/PublicSlotBrowser";
import { Card } from "@/components/ui";

export const metadata: Metadata = { title: "Doctor profile" };

export default async function DoctorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [doctor, clinic] = await Promise.all([getPublicDoctor(id), getPublicClinic()]);
  if (!doctor) notFound();
  const today = dateInTz(new Date(), clinic.timezone);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <Card>
        <div className="flex items-center gap-4">
          <span aria-hidden className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-xl font-semibold text-brand-700">
            {initials(doctor.full_name)}
          </span>
          <div>
            <h1 className="text-xl font-semibold">{doctor.full_name}</h1>
            <p className="text-sm text-muted">{doctor.speciality}</p>
          </div>
        </div>
        <dl className="mt-5 space-y-3 text-sm">
          {doctor.qualification ? (
            <div>
              <dt className="text-xs text-muted">Qualification</dt>
              <dd className="font-medium">{doctor.qualification}</dd>
            </div>
          ) : null}
          {doctor.registration_number ? (
            <div>
              <dt className="text-xs text-muted">Registration number</dt>
              <dd className="font-medium">{doctor.registration_number}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-xs text-muted">OPD Timings</dt>
            <dd className="font-semibold text-emerald-700">12:00 PM – 05:00 PM (Mon – Sat)</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Consultation fee</dt>
            <dd className="font-medium">{doctorFee(doctor)}</dd>
          </div>
        </dl>
        {doctor.bio ? <p className="mt-5 whitespace-pre-line text-sm text-muted">{doctor.bio}</p> : null}
      </Card>
      <Card>
        <h2 className="mb-1 text-lg font-semibold">Book an appointment</h2>
        <p className="mb-4 text-sm text-muted">Choose a date, then a time. You will be asked to sign in before paying.</p>
        <PublicSlotBrowser doctorId={doctor.id} today={today} horizonDays={clinic.booking_horizon_days} />
      </Card>
    </div>
  );
}
