import type { Metadata } from "next";
import { requirePageRole } from "@/lib/auth";
import { getPublicClinic, clinicDisplayName } from "@/lib/clinic";
import { dateInTz } from "@/lib/time";
import { BookingFlow } from "@/components/client/BookingFlow";
import { DR_RATISH_JUYAL_ID, PHYSIOTHERAPIST_ID } from "@/lib/firebase/data";
import { PageHeader } from "@/components/ui";
import { Stethoscope, Activity, Clock, MapPin, ShieldCheck } from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Book Doctor Appointment",
  description: "Book an OPD consultation with Dr. Ratish Juyal or Dr. Amit K. Sharma (PT) with instant token generation.",
};

const DOCTORS = [
  {
    id: DR_RATISH_JUYAL_ID,
    name: "Dr. Ratish Juyal",
    title: "Senior Consultant Neurologist",
    qualifications: "MBBS, MD (Medicine), DM (Neurology - KGMU)",
    speciality: "Brain, Spine, Stroke, Epilepsy, Headache & Parkinson's",
    fee: "₹1,000",
    cabin: "Cabin 1 (Neurology OPD)",
    timings: "12:00 PM – 05:00 PM (Mon – Sat)",
    duration: "20 mins per patient",
    color: "brand",
  },
  {
    id: PHYSIOTHERAPIST_ID,
    name: "Dr. Amit K. Sharma (PT)",
    title: "Consultant Neuro-Physiotherapist",
    qualifications: "BPT, MPT (Neuro-Rehabilitation)",
    speciality: "Stroke Rehab, Paralysis, Sciatica, Slip Disc & Spine Mobilization",
    fee: "₹500",
    cabin: "Cabin 2 (Physiotherapy Rehab)",
    timings: "12:00 PM – 05:00 PM (Mon – Sat)",
    duration: "30 mins per patient",
    color: "emerald",
  },
];

export default async function PatientBookPage({
  searchParams,
}: {
  searchParams: Promise<{ doctor?: string; date?: string; time?: string }>;
}) {
  await requirePageRole("patient");
  const clinic = await getPublicClinic();
  const today = dateInTz(new Date(), clinic.timezone);
  const params = await searchParams;

  const selectedDoctorId = params.doctor === PHYSIOTHERAPIST_ID ? PHYSIOTHERAPIST_ID : DR_RATISH_JUYAL_ID;
  const activeDoctor = DOCTORS.find((d) => d.id === selectedDoctorId) || DOCTORS[0]!;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Online Appointment Booking"
        description="Book your OPD consultation directly. Pay online via UPI/Card or choose 'Pay at Counter' for instant token generation."
      />

      {/* Doctor Selection Tabs */}
      <div className="grid gap-4 sm:grid-cols-2">
        {DOCTORS.map((doc) => {
          const isSelected = doc.id === selectedDoctorId;
          return (
            <Link
              key={doc.id}
              href={`/patient/book?doctor=${doc.id}`}
              className={`relative flex flex-col justify-between rounded-2xl border p-5 transition-all text-left ${
                isSelected
                  ? "border-brand-600 bg-brand-50/40 shadow-sm ring-2 ring-brand-600/20"
                  : "border-line bg-white hover:border-slate-300 hover:shadow-xs"
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-white ${
                        doc.id === DR_RATISH_JUYAL_ID ? "bg-brand-600" : "bg-emerald-600"
                      }`}
                    >
                      {doc.id === DR_RATISH_JUYAL_ID ? <Stethoscope className="h-5 w-5" /> : <Activity className="h-5 w-5" />}
                    </span>
                    <div>
                      <h3 className="font-bold text-ink">{doc.name}</h3>
                      <p className="text-xs text-muted font-medium">{doc.title}</p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                      isSelected ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {doc.fee}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  <strong className="text-slate-800">Specialization:</strong> {doc.speciality}
                </p>

                <div className="space-y-1.5 text-xs text-slate-600 border-t border-slate-200/60 pt-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>{doc.timings}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span>{doc.cabin}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-2">
                <span
                  className={`inline-flex items-center justify-center w-full rounded-xl py-2 text-xs font-semibold transition ${
                    isSelected
                      ? "bg-brand-700 text-white font-bold"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {isSelected ? "Selected Doctor (Booking Below)" : "Switch to this Doctor"}
                </span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* OPD Guidelines Banner */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-xs text-emerald-950 flex items-start gap-3">
        <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold text-emerald-900">Dr. Ratish Juyal Neuro & Spine Clinic — OPD Instructions</p>
          <p className="mt-0.5 text-emerald-800">
            OPD runs Monday to Saturday from <strong>12:00 PM to 05:00 PM</strong>. Please report 15 minutes before your
            slot time with your token receipt and any previous Brain/Spine MRI scans or prescriptions.
          </p>
        </div>
      </div>

      {/* Booking Form Card */}
      <div className="rounded-2xl border border-line bg-white p-6 shadow-2xs">
        <div className="mb-6 border-b border-line pb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-ink">
              Select Slot for {activeDoctor.name}
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Available slots are calculated in real time. Pick an open time slot to proceed.
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium">
            <span className="flex items-center gap-1.5 text-emerald-700">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-500"></span> Available
            </span>
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="h-2.5 w-2.5 rounded-full bg-slate-300"></span> Booked
            </span>
          </div>
        </div>

        <BookingFlow
          doctorId={activeDoctor.id}
          doctorName={activeDoctor.name}
          feeLabel={activeDoctor.fee}
          clinicName={clinicDisplayName(clinic)}
          today={today}
          horizonDays={clinic.booking_horizon_days}
          initialDate={params.date || null}
          initialTime={params.time || null}
        />
      </div>
    </div>
  );
}
