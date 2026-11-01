"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FileText,
  Activity,
  Stethoscope,
  Pill,
  Download,
  Eye,
  Clock,
  ExternalLink,
} from "lucide-react";
import type { PatientMedicalReport } from "@/lib/reports-store";

export interface ConsultationHistoryItem {
  id: string;
  doctorName: string;
  speciality: string;
  appointmentNumber: string;
  date: string;
  diagnosis: string | null;
  symptoms?: string | null;
  examinationNotes?: string | null;
  advice: string | null;
  followUpDate: string | null;
  vitals?: {
    bp?: string | null;
    pulse?: number | null;
    temp?: number | string | null;
    spo2?: number | null;
    weight?: number | string | null;
    height?: number | string | null;
    bmi?: number | string | null;
    bloodSugar?: number | string | null;
  };
  prescription?: {
    id: string;
    prescriptionNumber: string;
    medicinesCount: number;
    medicinesSummary: string;
  } | null;
}

interface Props {
  consultations: ConsultationHistoryItem[];
  reports: PatientMedicalReport[];
  patientName: string;
  uhid: string;
}

export function PatientMedicalHistoryTimeline({ consultations, reports, patientName, uhid }: Props) {
  const [activeTab, setActiveTab] = useState<"all" | "consultations" | "prescriptions" | "reports" | "vitals">("all");
  const [selectedReport, setSelectedReport] = useState<PatientMedicalReport | null>(null);

  // Derive all chronological events
  interface TimelineEvent {
    id: string;
    date: string;
    type: "consultation" | "prescription" | "report" | "vitals";
    title: string;
    subtitle: string;
    badge: string;
    doctor?: string;
    details?: string | null;
    meta?: Record<string, unknown>;
  }

  const events: TimelineEvent[] = [];

  consultations.forEach((c) => {
    // Consultation Event
    events.push({
      id: `c-${c.id}`,
      date: c.date,
      type: "consultation",
      title: c.diagnosis ? `Diagnosis: ${c.diagnosis}` : "Clinical Consultation",
      subtitle: `${c.doctorName} • ${c.speciality}`,
      badge: "Consultation",
      doctor: c.doctorName,
      details: c.advice,
      meta: {
        appointmentNumber: c.appointmentNumber,
        symptoms: c.symptoms,
        followUpDate: c.followUpDate,
        consultationId: c.id,
      },
    });

    // Prescription Event
    if (c.prescription) {
      events.push({
        id: `p-${c.prescription.id}`,
        date: c.date,
        type: "prescription",
        title: `Prescription #${c.prescription.prescriptionNumber}`,
        subtitle: `Prescribed by ${c.doctorName} (${c.prescription.medicinesCount} medicines)`,
        badge: "Prescription",
        doctor: c.doctorName,
        details: c.prescription.medicinesSummary,
        meta: {
          prescriptionId: c.prescription.id,
        },
      });
    }

    // Vitals Event
    if (c.vitals && (c.vitals.bp || c.vitals.pulse || c.vitals.spo2 || c.vitals.weight || c.vitals.bloodSugar)) {
      events.push({
        id: `v-${c.id}`,
        date: c.date,
        type: "vitals",
        title: "Clinical Vitals Recorded",
        subtitle: `Recorded during OPD visit with ${c.doctorName}`,
        badge: "Vitals Track",
        meta: c.vitals as Record<string, unknown>,
      });
    }
  });

  // Reports Events
  reports.forEach((r) => {
    events.push({
      id: `r-${r.id}`,
      date: r.reportDate || r.uploadedAt,
      type: "report",
      title: r.title,
      subtitle: `${r.category} • Uploaded ${new Date(r.uploadedAt).toLocaleDateString("en-IN")}`,
      badge: "Lab / Imaging",
      details: r.description,
      meta: {
        fileType: r.fileType,
        fileSizeFormatted: r.fileSizeFormatted,
        reportObj: r,
      },
    });
  });

  // Sort newest first
  events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredEvents =
    activeTab === "all"
      ? events
      : activeTab === "consultations"
      ? events.filter((e) => e.type === "consultation")
      : activeTab === "prescriptions"
      ? events.filter((e) => e.type === "prescription")
      : activeTab === "reports"
      ? events.filter((e) => e.type === "report")
      : events.filter((e) => e.type === "vitals");

  return (
    <div className="space-y-6">
      {/* Top Patient Profile Summary Bar */}
      <div className="rounded-2xl border border-line bg-gradient-to-r from-brand-50/70 via-white to-slate-50 p-5 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-ink">{patientName}</h2>
            <p className="text-xs text-muted font-medium mt-0.5">
              UHID: <span className="font-semibold text-brand-700">{uhid}</span> • Dr. Ratish Juyal Neuro & Spine Clinic
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <span className="rounded-xl border border-brand-200 bg-white px-3 py-1.5 font-semibold text-brand-800 shadow-2xs">
              🩺 {consultations.length} Consultations
            </span>
            <span className="rounded-xl border border-emerald-200 bg-white px-3 py-1.5 font-semibold text-emerald-800 shadow-2xs">
              📁 {reports.length} Uploaded Reports
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("all")}
          className={`rounded-xl px-4 py-2 text-xs font-semibold transition cursor-pointer ${
            activeTab === "all"
              ? "bg-brand-600 text-white shadow-xs"
              : "bg-white border border-line text-slate-700 hover:bg-slate-50"
          }`}
        >
          All Timeline ({events.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("consultations")}
          className={`rounded-xl px-4 py-2 text-xs font-semibold transition cursor-pointer ${
            activeTab === "consultations"
              ? "bg-brand-600 text-white shadow-xs"
              : "bg-white border border-line text-slate-700 hover:bg-slate-50"
          }`}
        >
          Consultations & Diagnoses ({consultations.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("prescriptions")}
          className={`rounded-xl px-4 py-2 text-xs font-semibold transition cursor-pointer ${
            activeTab === "prescriptions"
              ? "bg-brand-600 text-white shadow-xs"
              : "bg-white border border-line text-slate-700 hover:bg-slate-50"
          }`}
        >
          Prescriptions & Rx
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("reports")}
          className={`rounded-xl px-4 py-2 text-xs font-semibold transition cursor-pointer ${
            activeTab === "reports"
              ? "bg-brand-600 text-white shadow-xs"
              : "bg-white border border-line text-slate-700 hover:bg-slate-50"
          }`}
        >
          Lab & Imaging Records ({reports.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("vitals")}
          className={`rounded-xl px-4 py-2 text-xs font-semibold transition cursor-pointer ${
            activeTab === "vitals"
              ? "bg-brand-600 text-white shadow-xs"
              : "bg-white border border-line text-slate-700 hover:bg-slate-50"
          }`}
        >
          Clinical Vitals Track
        </button>
      </div>

      {/* Timeline Section */}
      {filteredEvents.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-8 text-center">
          <p className="font-semibold text-ink">No records found under this section.</p>
          <p className="mt-1 text-xs text-muted">Records from your OPD visits and uploaded lab reports will appear here.</p>
        </div>
      ) : (
        <div className="relative border-l-2 border-brand-200 ml-4 space-y-6 pl-6 py-2">
          {filteredEvents.map((evt) => {
            const isConsult = evt.type === "consultation";
            const isPrescription = evt.type === "prescription";
            const isReport = evt.type === "report";
            const isVitals = evt.type === "vitals";

            return (
              <div key={evt.id} className="relative group">
                {/* Timeline node icon */}
                <span
                  className={`absolute -left-[35px] top-1.5 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-white ${
                    isConsult
                      ? "bg-brand-600 text-white"
                      : isPrescription
                      ? "bg-purple-600 text-white"
                      : isReport
                      ? "bg-emerald-600 text-white"
                      : "bg-blue-500 text-white"
                  }`}
                >
                  {isConsult ? (
                    <Stethoscope className="h-3.5 w-3.5" />
                  ) : isPrescription ? (
                    <Pill className="h-3.5 w-3.5" />
                  ) : isReport ? (
                    <FileText className="h-3.5 w-3.5" />
                  ) : (
                    <Activity className="h-3.5 w-3.5" />
                  )}
                </span>

                {/* Event Card */}
                <div className="rounded-2xl border border-line bg-white p-5 shadow-2xs transition hover:border-slate-300">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${
                          isConsult
                            ? "bg-brand-50 text-brand-700 border border-brand-200"
                            : isPrescription
                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                            : isReport
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {evt.badge}
                      </span>
                      <span className="text-xs text-muted flex items-center gap-1 font-medium">
                        <Clock className="h-3 w-3" />
                        {new Date(evt.date).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    {isPrescription && evt.meta?.prescriptionId ? (
                      <Link
                        href={`/patient/prescriptions/${evt.meta.prescriptionId}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
                      >
                        View Prescription PDF <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : null}

                    {isReport && evt.meta?.reportObj ? (
                      <button
                        type="button"
                        onClick={() => setSelectedReport(evt.meta?.reportObj as PatientMedicalReport)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                      >
                        <Eye className="h-3.5 w-3.5" /> Preview Report
                      </button>
                    ) : null}
                  </div>

                  <h3 className="text-base font-bold text-ink">{evt.title}</h3>
                  <p className="text-xs text-muted mt-0.5 font-medium">{evt.subtitle}</p>

                  {/* Consultation Details */}
                  {isConsult && evt.meta?.symptoms ? (
                    <div className="mt-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-700 space-y-1 border border-slate-100">
                      <p>
                        <strong className="text-slate-900">Symptoms:</strong> {String(evt.meta.symptoms)}
                      </p>
                      {evt.details ? (
                        <p>
                          <strong className="text-slate-900">Doctor&apos;s Advice:</strong> {evt.details}
                        </p>
                      ) : null}
                      {evt.meta?.followUpDate ? (
                        <p className="text-brand-700 font-semibold">
                          Follow-up Date: {String(evt.meta.followUpDate)}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Prescription Medicines Details */}
                  {isPrescription && evt.details ? (
                    <div className="mt-3 rounded-xl bg-purple-50/50 p-3 text-xs text-purple-950 border border-purple-100">
                      <p className="font-semibold text-purple-900 mb-1">Prescribed Medicines:</p>
                      <p className="whitespace-pre-line text-purple-800 leading-relaxed">{evt.details}</p>
                    </div>
                  ) : null}

                  {/* Vitals Summary Pill Grid */}
                  {isVitals && evt.meta ? (
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 text-xs">
                      {evt.meta.bp ? (
                        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                          <span className="text-[11px] text-muted block">Blood Pressure</span>
                          <span className="font-bold text-ink">{String(evt.meta.bp)} mmHg</span>
                        </div>
                      ) : null}
                      {evt.meta.pulse ? (
                        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                          <span className="text-[11px] text-muted block">Pulse</span>
                          <span className="font-bold text-ink">{String(evt.meta.pulse)} bpm</span>
                        </div>
                      ) : null}
                      {evt.meta.spo2 ? (
                        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                          <span className="text-[11px] text-muted block">SpO2</span>
                          <span className="font-bold text-emerald-700">{String(evt.meta.spo2)}%</span>
                        </div>
                      ) : null}
                      {evt.meta.temp ? (
                        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                          <span className="text-[11px] text-muted block">Temperature</span>
                          <span className="font-bold text-ink">{String(evt.meta.temp)} °F</span>
                        </div>
                      ) : null}
                      {evt.meta.weight ? (
                        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                          <span className="text-[11px] text-muted block">Weight</span>
                          <span className="font-bold text-ink">{String(evt.meta.weight)} kg</span>
                        </div>
                      ) : null}
                      {evt.meta.height ? (
                        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                          <span className="text-[11px] text-muted block">Height</span>
                          <span className="font-bold text-ink">{String(evt.meta.height)} cm</span>
                        </div>
                      ) : null}
                      {evt.meta.bmi ? (
                        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                          <span className="text-[11px] text-muted block">BMI</span>
                          <span className="font-bold text-brand-700">{String(evt.meta.bmi)} kg/m²</span>
                        </div>
                      ) : null}
                      {evt.meta.bloodSugar ? (
                        <div className="rounded-lg bg-slate-50 p-2.5 border border-slate-100">
                          <span className="text-[11px] text-muted block">Blood Sugar</span>
                          <span className="font-bold text-amber-700">{String(evt.meta.bloodSugar)} mg/dL</span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Report Details */}
                  {isReport && evt.details ? (
                    <p className="mt-2 text-xs text-slate-600 bg-emerald-50/40 p-2.5 rounded-xl border border-emerald-100">
                      <strong>Clinical Notes:</strong> {evt.details}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Report Preview Modal */}
      {selectedReport ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="flex h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-6 py-4 bg-slate-50">
              <div>
                <h3 className="font-bold text-ink text-base">{selectedReport.title}</h3>
                <p className="text-xs text-muted">
                  {selectedReport.category} • {selectedReport.reportDate} • {selectedReport.fileSizeFormatted}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={selectedReport.fileUrl}
                  download={selectedReport.fileName}
                  className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
                <button
                  type="button"
                  onClick={() => setSelectedReport(null)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-slate-100 flex items-center justify-center">
              {(selectedReport.fileType || selectedReport.file_type || "").includes("pdf") ? (
                <iframe src={selectedReport.fileUrl || selectedReport.file_url} className="h-full w-full rounded-xl border border-line bg-white" />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={selectedReport.fileUrl}
                  alt={selectedReport.title}
                  className="max-h-full max-w-full rounded-xl object-contain shadow-md"
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
