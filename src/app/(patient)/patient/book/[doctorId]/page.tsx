import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { z } from "zod";
import { requirePageRole } from "@/lib/auth";
import { getPublicClinic, getPublicDoctor, clinicDisplayName } from "@/lib/clinic";
import { dateInTz, isValidDate, isValidTime } from "@/lib/time";
import { doctorFee } from "@/lib/public-format";
import { BookingFlow } from "@/components/client/BookingFlow";
import { Card, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Book appointment" };

export default async function BookPage({ params, searchParams }: { params: Promise<{ doctorId: string }>; searchParams: Promise<{ date?: string; time?: string }> }) {
  const { doctorId } = await params;
  const { date, time } = await searchParams;
  if (!z.string().uuid().safeParse(doctorId).success) notFound();
  await requirePageRole("patient");
  const [doctor, clinic] = await Promise.all([getPublicDoctor(doctorId), getPublicClinic()]);
  if (!doctor) notFound();
  const today = dateInTz(new Date(), clinic.timezone);
  return (
    <div className="max-w-2xl">
      <PageHeader title={`Book with ${doctor.full_name}`} description={`${doctor.speciality} - consultation fee ${doctorFee(doctor)}`} />
      <Card>
        <BookingFlow
          doctorId={doctor.id}
          doctorName={doctor.full_name}
          feeLabel={doctorFee(doctor)}
          clinicName={clinicDisplayName(clinic)}
          today={today}
          horizonDays={clinic.booking_horizon_days}
          initialDate={date && isValidDate(date) ? date : null}
          initialTime={time && isValidTime(time) ? time.slice(0, 5) : null}
        />
      </Card>
    </div>
  );
}
