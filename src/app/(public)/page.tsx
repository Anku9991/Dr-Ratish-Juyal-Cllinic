import { getPublicClinic, clinicDisplayName, listPublicDoctors } from "@/lib/clinic";
import { DoctorCard } from "@/components/DoctorCard";
import { LinkButton, EmptyState } from "@/components/ui";
import { Clock, FileSignature, MapPin, Phone, Brain, Activity, Video } from "lucide-react";
import { listClinicVideos } from "@/lib/firebase/videos";
import { ClinicVideosSection } from "@/components/ClinicVideosSection";
import { LiveOpdBadge } from "@/components/LiveOpdBadge";

export default async function Home() {
  const [clinic, doctors, videos] = await Promise.all([
    getPublicClinic(),
    listPublicDoctors(),
    listClinicVideos(),
  ]);

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-[20px] border border-line bg-gradient-to-br from-white via-brand-50/20 to-sky-50/30 px-6 py-12 sm:px-10 lg:py-16 shadow-xs">
        <div className="max-w-3xl">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50/90 px-3.5 py-1 text-xs font-semibold text-brand-700 shadow-2xs">
              <Brain className="h-3.5 w-3.5" />
              <span>Neurology & Neuro-Physiotherapy Excellence • Lucknow</span>
            </div>
            <LiveOpdBadge />
          </div>
          <h1 className="text-3xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">
            {clinicDisplayName(clinic)}
          </h1>
          <p className="mt-4 text-base sm:text-lg text-muted max-w-2xl leading-relaxed">
            Led by <strong>Dr. Ratish Juyal</strong>, Senior Consultant Neurologist (DM Neurology, KGMU Lucknow),
            offering comprehensive care for Brain, Spine, Nerve & Stroke conditions, supported by dedicated
            in-house Neuro-Physiotherapy rehabilitation.
          </p>

          {/* Timing & OPD Highlights */}
          <div className="mt-6 flex flex-wrap items-center gap-4 text-sm text-slate-700">
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-1.5 font-medium text-emerald-800">
              <Clock className="h-4 w-4 text-emerald-600" />
              <span>OPD Timings: 12:00 PM – 05:00 PM (Mon – Sat)</span>
            </div>
            {clinic.phone ? (
              <div className="flex items-center gap-2 rounded-lg bg-white border border-line px-3 py-1.5 font-medium text-slate-700">
                <Phone className="h-4 w-4 text-brand-600" />
                <a href={`tel:${clinic.phone}`} className="hover:text-brand-700">{clinic.phone}</a>
              </div>
            ) : null}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <LinkButton href="/doctors" className="px-6 py-3 text-base shadow-sm">
              Book Appointment (12 PM - 5 PM)
            </LinkButton>
            <LinkButton href="/register" variant="secondary" className="px-6 py-3 text-base">
              Patient Registration
            </LinkButton>
          </div>

          {clinic.address ? (
            <div className="mt-8 flex items-start gap-2 text-xs text-muted">
              <MapPin className="h-4 w-4 shrink-0 text-slate-400 mt-0.5" />
              <span>{clinic.address}</span>
            </div>
          ) : null}
        </div>
      </section>

      {/* Feature Badges */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
              <Brain className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-semibold text-sm text-ink">Super-Specialist Neurologist</h3>
              <p className="text-xs text-muted">DM (Neurology) trained at premier KGMU</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-line bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
              <Activity className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-semibold text-sm text-ink">Integrated Neuro-Physiotherapy</h3>
              <p className="text-xs text-muted">Stroke, spine & mobility rehabilitation</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-line bg-white p-5 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
              <FileSignature className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-semibold text-sm text-ink">Digital Prescription Pad</h3>
              <p className="text-xs text-muted">Handwritten stylus notes + instant cloud PDF</p>
            </div>
          </div>
        </div>
      </section>

      {/* Doctors & Specialists Section */}
      <section aria-labelledby="docs">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 id="docs" className="text-2xl font-bold tracking-tight text-ink">
              Our Medical Specialists
            </h2>
            <p className="text-sm text-muted">Consultation Timings: 12:00 PM to 05:00 PM</p>
          </div>
        </div>

        {doctors.length === 0 ? (
          <EmptyState
            title="Doctors will be listed here soon"
            description="The clinic is still setting up. Please check back shortly or contact the clinic directly."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {doctors.map((d) => (
              <DoctorCard key={d.id} doctor={d} />
            ))}
          </div>
        )}
      </section>

      {/* Clinic & Doctor Videos Section */}
      <section aria-labelledby="videos" className="rounded-2xl border border-line bg-gradient-to-br from-white via-slate-50/50 to-purple-50/20 p-6 sm:p-8">
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-3 py-0.5 text-xs font-semibold text-purple-700 mb-2">
            <Video className="h-3.5 w-3.5" />
            <span>Doctor Videos & Clinical Guidance</span>
          </div>
          <h2 id="videos" className="text-2xl font-bold tracking-tight text-ink">
            Doctor Insights & Patient Guidance Videos
          </h2>
          <p className="text-sm text-muted mt-1 max-w-2xl">
            Watch Dr. Ratish Juyal and our Neuro-Physiotherapist explain brain, spine, stroke emergency care, and rehabilitation exercises.
          </p>
        </div>

        <ClinicVideosSection initialVideos={videos} />
      </section>

      {/* Clinical Departments & Specialities */}
      <section className="rounded-2xl border border-line bg-white p-6 sm:p-8">
        <h2 className="text-xl font-bold text-ink mb-2">Conditions Treated & Clinical Care</h2>
        <p className="text-sm text-muted mb-6">Expert neurological diagnosis, electrophysiology, and advanced physical rehabilitation.</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          {[
            "Stroke & Paralysis Care",
            "Migraine & Chronic Headache",
            "Epilepsy & Seizures",
            "Parkinson's & Tremors",
            "Sciatica & Slip Disc",
            "Cervical Spondylosis",
            "Peripheral Neuropathy",
            "Neuro-Rehabilitation",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2 rounded-lg bg-slate-50 border border-line px-3 py-2 text-xs font-medium text-slate-700">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
