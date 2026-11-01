"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { consultationSchema } from "@/lib/validation";
import { api } from "./api";
import { Alert, Field, buttonStyles, inputClass } from "../ui";
import { formatDateLong, formatTime12 } from "@/lib/time";
import { DigitalPrescriptionPad } from "./DigitalPrescriptionPad";
import type { PatientMedicalReport } from "@/lib/reports-store";
import {
  Eye,
  Download,
  ShieldCheck,
  X,
  FileCheck,
} from "lucide-react";

type FormValues = z.input<typeof consultationSchema>;
type FormOutput = z.output<typeof consultationSchema>;

export interface PatientHeaderInfo {
  name: string;
  uhid: string;
  age: number | null;
  gender: string | null;
  appointmentNumber: string;
  doctorName: string;
  date: string;
  time: string;
}

export interface HistoryItem {
  id: string;
  diagnosis: string | null;
  date: string;
}

const EMPTY_MEDICINE = { medicineName: "", strength: "", dosage: "", frequency: "", duration: "", instructions: "" };

export function ConsultationForm({
  appointmentId,
  header,
  initial,
  history,
  locked,
  appointmentStatus,
  patientReports = [],
}: {
  appointmentId: string;
  header: PatientHeaderInfo;
  initial: FormValues;
  history: HistoryItem[];
  locked: boolean;
  appointmentStatus: string;
  patientReports?: PatientMedicalReport[];
}) {
  const router = useRouter();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showReportsPanel, setShowReportsPanel] = useState(true);
  const [previewReport, setPreviewReport] = useState<PatientMedicalReport | null>(null);
  const [viewMode, setViewMode] = useState<"pad" | "form" | "both">("both");
  const [padDataUrl, setPadDataUrl] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues, unknown, FormOutput>({ resolver: zodResolver(consultationSchema), defaultValues: initial });
  const { fields, append, remove } = useFieldArray({ control, name: "medicines" });
  const values = watch();

  // Real-time BMI calculation
  const heightNum = Number(values.height);
  const weightNum = Number(values.weight);

  const calculatedBmi = useMemo(() => {
    if (heightNum > 0 && weightNum > 0) {
      const heightM = heightNum / 100;
      const val = weightNum / (heightM * heightM);
      return Number(val.toFixed(1));
    }
    return null;
  }, [heightNum, weightNum]);

  const bmiCategory = useMemo(() => {
    if (!calculatedBmi) return null;
    if (calculatedBmi < 18.5) return { label: "Underweight", color: "bg-blue-100 text-blue-800 border-blue-200" };
    if (calculatedBmi <= 24.9) return { label: "Normal (Healthy)", color: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    if (calculatedBmi <= 29.9) return { label: "Overweight", color: "bg-amber-100 text-amber-800 border-amber-200" };
    return { label: "Obese", color: "bg-rose-100 text-rose-800 border-rose-200" };
  }, [calculatedBmi]);

  async function saveDraft(data: FormOutput) {
    setSaveState("saving");
    setSaveError(null);
    const payload = {
      ...data,
      bmi: calculatedBmi || data.bmi || null,
      padDrawing: padDataUrl || data.padDrawing || null,
    };
    const res = await api(`/api/doctor/consultations/${appointmentId}`, "PUT", payload);
    if (!res.ok) {
      setSaveState("error");
      setSaveError(res.message);
      return false;
    }
    setSaveState("saved");
    return true;
  }

  async function finalize(data: FormOutput) {
    setFinalizing(true);
    setFinalizeError(null);
    const finalData = {
      ...data,
      bmi: calculatedBmi || data.bmi || null,
      diagnosis: data.diagnosis?.trim() || (padDataUrl ? "Consultation & Handwritten Prescription" : "Clinical Consultation"),
      padDrawing: padDataUrl || data.padDrawing || null,
    };
    const res = await api<{ prescriptionId: string }>(`/api/doctor/consultations/${appointmentId}/finalize`, "POST", finalData);
    setFinalizing(false);
    if (!res.ok) return setFinalizeError(res.message);
    router.push(`/doctor/prescriptions/${res.data.prescriptionId}`);
  }

  const canFinalize = useMemo(
    () => (Boolean(values.diagnosis?.trim()) && (values.medicines?.length ?? 0) > 0) || Boolean(padDataUrl),
    [values.diagnosis, values.medicines, padDataUrl]
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
      <div className="space-y-6">
        {/* Patient Header Card */}
        <div className="rounded-2xl border border-line bg-white p-5 shadow-2xs">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-xl font-bold text-ink">{header.name}</p>
              <p className="text-xs text-muted font-medium mt-0.5">
                UHID: <span className="font-semibold text-brand-700">{header.uhid}</span>
                {header.age !== null ? ` • ${header.age} yrs` : ""}
                {header.gender ? ` • ${header.gender}` : ""}
              </p>
            </div>
            <div className="text-right text-xs text-muted">
              <p className="font-bold text-ink">{header.appointmentNumber}</p>
              <p>
                {formatDateLong(header.date)}, {formatTime12(header.time)}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-line pt-3 text-xs">
            {history.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowHistory((s) => !s)}
                className="font-semibold text-brand-700 hover:underline cursor-pointer"
              >
                {showHistory ? "Hide" : "View"} previous visits ({history.length})
              </button>
            ) : (
              <span className="text-muted">First visit</span>
            )}

            {patientReports.length > 0 ? (
              <button
                type="button"
                onClick={() => setShowReportsPanel((s) => !s)}
                className="font-semibold text-emerald-700 hover:underline cursor-pointer flex items-center gap-1"
              >
                📁 {showReportsPanel ? "Hide" : "View"} Patient Uploaded Reports ({patientReports.length})
              </button>
            ) : null}
          </div>

          {showHistory ? (
            <ul className="mt-3 space-y-1.5 border-t border-line pt-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl">
              {history.map((h) => (
                <li key={h.id}>
                  <strong>{formatDateLong(h.date)}:</strong> {h.diagnosis ?? "Consultation recorded"}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* Patient Reports Integration Bar */}
        {showReportsPanel && patientReports.length > 0 ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-emerald-700" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                  Patient Uploaded Reports ({patientReports.length})
                </h3>
              </div>
              <span className="text-[11px] text-emerald-800">1-Click preview & download</span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {patientReports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-white p-3 shadow-2xs text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ink truncate">{report.title}</p>
                    <p className="text-[11px] text-muted truncate">
                      {report.category} • {report.reportDate}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setPreviewReport(report)}
                      className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 flex items-center gap-1 cursor-pointer"
                      title="Preview report"
                    >
                      <Eye className="h-3 w-3" /> Preview
                    </button>
                    <a
                      href={report.fileUrl}
                      download={report.fileName}
                      className="rounded-lg border border-line bg-white p-1 text-slate-600 hover:bg-slate-50"
                      title="Download file"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Prescription Entry Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
          <div className="flex items-center gap-1.5 rounded-xl border border-line bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setViewMode("both")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                viewMode === "both" ? "bg-white text-brand-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Split View (Pad & Form)
            </button>
            <button
              type="button"
              onClick={() => setViewMode("pad")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                viewMode === "pad" ? "bg-white text-brand-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Digital Writing Pad (Stylus)
            </button>
            <button
              type="button"
              onClick={() => setViewMode("form")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                viewMode === "form" ? "bg-white text-brand-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Structured Form Only
            </button>
          </div>

          <div className="text-xs text-muted font-medium">
            {viewMode === "pad" ? "Digital Stylus / Companion Tablet Sync Enabled" : "Dual Prescription Mode Active"}
          </div>
        </div>

        {/* Digital Prescription Writing Pad */}
        {viewMode === "pad" || viewMode === "both" ? (
          <div className="space-y-2">
            <DigitalPrescriptionPad
              appointmentId={appointmentId}
              patientName={header.name}
              uhid={header.uhid}
              doctorName={header.doctorName}
              onImageChange={(img) => setPadDataUrl(img)}
            />
          </div>
        ) : null}

        {locked ? (
          <Alert tone="info">This consultation is finalized. Use amend or cancel from the issued prescription to make changes.</Alert>
        ) : viewMode === "form" || viewMode === "both" ? (
          <form
            className="space-y-6"
            onSubmit={(e) => {
              e.preventDefault();
            }}
          >
            {/* Vitals Section with BMI Auto-Calculation */}
            <fieldset className="space-y-4 rounded-2xl border border-line bg-white p-5 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1 border-b border-line pb-3">
                <legend className="text-sm font-bold text-ink">Prescription Vitals Section</legend>
                {calculatedBmi ? (
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold border ${bmiCategory?.color}`}>
                    BMI: {calculatedBmi} kg/m² • {bmiCategory?.label}
                  </span>
                ) : (
                  <span className="text-xs text-muted">Enter Height & Weight for auto-BMI</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="BP (mmHg)" htmlFor="bp" error={errors.bloodPressure?.message}>
                  <input id="bp" placeholder="120/80" className={inputClass} {...register("bloodPressure")} />
                </Field>

                <Field label="Pulse (bpm)" htmlFor="pulse" error={errors.pulse?.message}>
                  <input id="pulse" type="number" placeholder="72" className={inputClass} {...register("pulse")} />
                </Field>

                <Field label="Body Temp (°F)" htmlFor="temp" error={errors.temperature?.message}>
                  <input id="temp" type="number" step="0.1" placeholder="98.6" className={inputClass} {...register("temperature")} />
                </Field>

                <Field label="SpO2 (%)" htmlFor="spo2" error={errors.spo2?.message}>
                  <input id="spo2" type="number" placeholder="99" className={inputClass} {...register("spo2")} />
                </Field>

                <Field label="Resp. Rate (/min)" htmlFor="respRate" error={errors.respiratoryRate?.message}>
                  <input id="respRate" type="number" placeholder="16" className={inputClass} {...register("respiratoryRate")} />
                </Field>

                <Field label="Height (cm)" htmlFor="height" error={errors.height?.message}>
                  <input id="height" type="number" step="0.5" placeholder="170" className={inputClass} {...register("height")} />
                </Field>

                <Field label="Weight (kg)" htmlFor="weight" error={errors.weight?.message}>
                  <input id="weight" type="number" step="0.5" placeholder="70" className={inputClass} {...register("weight")} />
                </Field>

                <Field label="Blood Sugar (mg/dL)" htmlFor="sugar" error={errors.bloodSugar?.message}>
                  <input id="sugar" type="number" placeholder="110 (Fasting/R)" className={inputClass} {...register("bloodSugar")} />
                </Field>

                <div className="flex flex-col justify-end">
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-center">
                    <span className="text-[10px] text-muted block uppercase font-bold">Auto-Calculated BMI</span>
                    <span className="font-bold text-brand-700 text-sm">
                      {calculatedBmi ? `${calculatedBmi} kg/m²` : "—"}
                    </span>
                  </div>
                </div>
              </div>
            </fieldset>

            {/* Chief Complaints */}
            <Field label="Chief Complaints / Presenting Issues" htmlFor="chiefComplaints" error={errors.chiefComplaints?.message}>
              <textarea
                id="chiefComplaints"
                rows={2}
                className={inputClass}
                placeholder="e.g. Throbbing right temporal headache with photophobia for 4 months..."
                {...register("chiefComplaints")}
              />
            </Field>

            {/* Symptoms & Examination */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Symptoms & Clinical History" htmlFor="symptoms" error={errors.symptoms?.message}>
                <textarea id="symptoms" rows={2} className={inputClass} {...register("symptoms")} />
              </Field>
              <Field label="Clinical Examination Notes" htmlFor="exam" error={errors.examinationNotes?.message}>
                <textarea id="exam" rows={2} className={inputClass} {...register("examinationNotes")} />
              </Field>
            </div>

            {/* Diagnosis */}
            <Field label="Diagnosis" htmlFor="diagnosis" error={errors.diagnosis?.message}>
              <textarea
                id="diagnosis"
                rows={2}
                className={inputClass}
                placeholder={padDataUrl ? "Optional (handwritten on digital pad)" : "e.g. Chronic Migraine with Aura / Cervical Radiculopathy"}
                {...register("diagnosis")}
              />
            </Field>

            {/* Medicines Fieldset */}
            <fieldset className="space-y-4 rounded-2xl border border-line bg-white p-5 shadow-2xs">
              <div className="flex items-center justify-between px-1 border-b border-line pb-3">
                <div>
                  <legend className="text-sm font-bold text-ink">Prescription Medicines (Rx)</legend>
                  <p className="text-xs text-muted">Add dosages, frequencies, and administration instructions</p>
                </div>
                <button
                  type="button"
                  onClick={() => append(EMPTY_MEDICINE)}
                  className="rounded-xl border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-100 cursor-pointer"
                >
                  + Add Medicine
                </button>
              </div>

              {fields.length === 0 ? (
                <p className="px-1 text-xs text-muted italic">
                  No medicines added yet (or handwrite them directly onto the digital prescription pad above).
                </p>
              ) : null}

              <div className="space-y-3">
                {fields.map((f, i) => (
                  <div key={f.id} className="space-y-2 rounded-xl border border-line bg-slate-50/50 p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-700">Medicine #{i + 1}</p>
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        className="text-xs font-semibold text-rose-600 hover:underline cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      <Field label="Medicine Name" htmlFor={`m${i}name`} error={errors.medicines?.[i]?.medicineName?.message}>
                        <input id={`m${i}name`} placeholder="e.g. Tab. Naproxen" className={inputClass} {...register(`medicines.${i}.medicineName` as const)} />
                      </Field>
                      <Field label="Strength" htmlFor={`m${i}strength`} error={errors.medicines?.[i]?.strength?.message}>
                        <input id={`m${i}strength`} placeholder="500mg" className={inputClass} {...register(`medicines.${i}.strength` as const)} />
                      </Field>
                      <Field label="Dosage" htmlFor={`m${i}dosage`} error={errors.medicines?.[i]?.dosage?.message}>
                        <input id={`m${i}dosage`} placeholder="1-0-1" className={inputClass} {...register(`medicines.${i}.dosage` as const)} />
                      </Field>
                      <Field label="Frequency" htmlFor={`m${i}freq`} error={errors.medicines?.[i]?.frequency?.message}>
                        <input id={`m${i}freq`} placeholder="Twice daily" className={inputClass} {...register(`medicines.${i}.frequency` as const)} />
                      </Field>
                      <Field label="Duration" htmlFor={`m${i}dur`} error={errors.medicines?.[i]?.duration?.message}>
                        <input id={`m${i}dur`} placeholder="5 days" className={inputClass} {...register(`medicines.${i}.duration` as const)} />
                      </Field>
                      <Field label="Instructions" htmlFor={`m${i}ins`} error={errors.medicines?.[i]?.instructions?.message}>
                        <input id={`m${i}ins`} placeholder="After food" className={inputClass} {...register(`medicines.${i}.instructions` as const)} />
                      </Field>
                    </div>
                  </div>
                ))}
              </div>
              {errors.medicines?.message ? <p className="text-xs text-rose-600">{errors.medicines.message}</p> : null}
            </fieldset>

            {/* Investigation Advised */}
            <Field label="Investigation Advised (Lab / Imaging / MRI / NCV)" htmlFor="investigation" error={errors.investigationAdvised?.message}>
              <textarea
                id="investigation"
                rows={2}
                className={inputClass}
                placeholder="e.g. MRI Brain Repeat with contrast, Serum Vitamin B12, EEG (Video 1-hour)"
                {...register("investigationAdvised")}
              />
            </Field>

            {/* Doctor's Advice & Follow-up Date */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Doctor's Advice & Guidance" htmlFor="advice" error={errors.advice?.message}>
                <textarea id="advice" rows={2} className={inputClass} placeholder="Lifestyle changes, exercise, trigger avoidance..." {...register("advice")} />
              </Field>
              <Field label="Follow-up Date" htmlFor="followup" error={errors.followUpDate?.message}>
                <input id="followup" type="date" className={inputClass} {...register("followUpDate")} />
              </Field>
            </div>

            {saveError ? <Alert tone="danger">{saveError}</Alert> : null}
            {finalizeError ? <Alert tone="danger">{finalizeError}</Alert> : null}
            {!canFinalize ? (
              <Alert tone="info">
                Write notes on the digital pad or add a diagnosis and at least one medicine before finalizing.
              </Alert>
            ) : null}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                disabled={saveState === "saving"}
                className={buttonStyles.secondary}
                onClick={handleSubmit(saveDraft)}
              >
                {saveState === "saving" ? "Saving..." : "Save Draft"}
              </button>
              <button
                type="button"
                disabled={finalizing || !canFinalize}
                className={buttonStyles.primary}
                onClick={handleSubmit(finalize)}
              >
                {finalizing ? "Issuing Prescription..." : "Finalize & Issue Prescription"}
              </button>
              {saveState === "saved" ? <span className="text-xs font-bold text-emerald-700">✓ Draft saved successfully</span> : null}
            </div>
            <p className="text-xs text-muted">
              Finalizing locks this consultation, issues an official PDF prescription with digital signature, and completes the appointment ({appointmentStatus.replace("_", " ")}).
            </p>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              disabled={saveState === "saving"}
              className={buttonStyles.secondary}
              onClick={handleSubmit(saveDraft)}
            >
              {saveState === "saving" ? "Saving..." : "Save Draft"}
            </button>
            <button
              type="button"
              disabled={finalizing || !canFinalize}
              className={buttonStyles.primary}
              onClick={handleSubmit(finalize)}
            >
              {finalizing ? "Issuing..." : "Finalize & Issue Prescription"}
            </button>
            {saveState === "saved" ? <span className="text-xs font-bold text-emerald-700">✓ Draft saved</span> : null}
          </div>
        )}
      </div>

      {/* Right Column: Live Prescription Preview */}
      <div className="lg:sticky lg:top-6 lg:self-start">
        <PrescriptionPreview
          header={header}
          values={values}
          padDrawing={padDataUrl}
          calculatedBmi={calculatedBmi}
          bmiCategory={bmiCategory?.label}
        />
      </div>

      {/* Report Preview Modal */}
      {previewReport ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="flex h-[90vh] w-full max-w-4xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-6 py-4 bg-slate-50">
              <div>
                <h3 className="font-bold text-ink text-base">{previewReport.title}</h3>
                <p className="text-xs text-muted">
                  {previewReport.category} • {previewReport.reportDate} • {previewReport.fileSizeFormatted}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewReport.fileUrl}
                  download={previewReport.fileName}
                  className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewReport(null)}
                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-slate-100 flex items-center justify-center">
              {(previewReport.fileType || previewReport.file_type || "").includes("pdf") ? (
                <iframe src={previewReport.fileUrl || previewReport.file_url} className="h-full w-full rounded-xl border border-line bg-white" />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={previewReport.fileUrl}
                  alt={previewReport.title}
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

function PrescriptionPreview({
  header,
  values,
  padDrawing,
  calculatedBmi,
  bmiCategory,
}: {
  header: PatientHeaderInfo;
  values: FormValues;
  padDrawing?: string | null;
  calculatedBmi?: number | null;
  bmiCategory?: string | null;
}) {
  const medicines = (values.medicines ?? []).filter((m) => m?.medicineName?.trim());

  return (
    <div className="rounded-2xl border border-line bg-white p-5 text-sm shadow-2xs">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Live Prescription Preview</p>
        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
          <ShieldCheck className="h-3.5 w-3.5" /> Official Pad
        </span>
      </div>

      <div className="rounded-xl border border-dashed border-line p-4 space-y-3 bg-slate-50/40">
        <div>
          <p className="font-bold text-brand-700">{header.doctorName}</p>
          <p className="text-[11px] text-muted">Dr. Ratish Juyal Neuro & Spine Clinic, Lucknow</p>
          <p className="text-[10px] text-slate-400">OPD Timings: 12:00 PM – 05:00 PM (Mon – Sat)</p>
        </div>

        <div className="border-t border-line pt-2 text-xs">
          <p className="font-bold text-ink">
            {header.name} • {header.uhid}
            {header.age !== null ? `, ${header.age} yrs` : ""}
            {header.gender ? `, ${header.gender}` : ""}
          </p>
        </div>

        {/* Digital Pad Handwritten Prescription Display */}
        {padDrawing ? (
          <div className="rounded-xl border border-brand-200 bg-white p-2 space-y-1">
            <span className="text-[10px] font-bold text-brand-700 uppercase tracking-wide">
              Handwritten Prescription Pad Attached
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={padDrawing}
              alt="Handwritten Prescription Pad"
              className="w-full h-auto rounded border border-line bg-white shadow-2xs max-h-56 object-contain"
            />
          </div>
        ) : null}

        {/* Vitals in Live Preview */}
        {values.bloodPressure || values.pulse || values.temperature || values.spo2 || values.weight || values.height ? (
          <div className="rounded-xl bg-white p-2.5 border border-line text-[11px] space-y-1">
            <span className="font-bold text-brand-800 block">Vitals Summary:</span>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-slate-700">
              {values.bloodPressure ? <span>BP: <strong>{values.bloodPressure}</strong></span> : null}
              {values.pulse ? <span>Pulse: <strong>{values.pulse} bpm</strong></span> : null}
              {values.temperature ? <span>Temp: <strong>{values.temperature} °F</strong></span> : null}
              {values.spo2 ? <span>SpO2: <strong>{values.spo2}%</strong></span> : null}
              {values.respiratoryRate ? <span>RR: <strong>{values.respiratoryRate}/min</strong></span> : null}
              {values.height ? <span>Height: <strong>{values.height} cm</strong></span> : null}
              {values.weight ? <span>Weight: <strong>{values.weight} kg</strong></span> : null}
              {calculatedBmi ? (
                <span className="text-emerald-700 font-bold">
                  BMI: {calculatedBmi} ({bmiCategory})
                </span>
              ) : null}
              {values.bloodSugar ? <span>Sugar: <strong>{values.bloodSugar} mg/dL</strong></span> : null}
            </div>
          </div>
        ) : null}

        {values.chiefComplaints ? (
          <div className="text-xs">
            <span className="font-bold text-slate-700 block">Chief Complaints:</span>
            <p className="text-slate-800">{values.chiefComplaints}</p>
          </div>
        ) : null}

        {values.diagnosis ? (
          <div className="text-xs">
            <span className="font-bold text-slate-700 block">Diagnosis:</span>
            <p className="font-bold text-brand-800">{values.diagnosis}</p>
          </div>
        ) : null}

        <div>
          <p className="font-bold text-xs text-slate-700 mb-1">Rx Medicines:</p>
          {medicines.length === 0 ? (
            <p className="text-xs text-muted italic">
              {padDrawing ? "Medicines written directly onto digital pad." : "No medicines added yet."}
            </p>
          ) : (
            <ol className="list-decimal space-y-1.5 pl-4 text-xs">
              {medicines.map((m, i) => (
                <li key={i}>
                  <span className="font-bold text-ink">
                    {m?.medicineName} {m?.strength}
                  </span>
                  {m?.dosage || m?.frequency || m?.duration ? (
                    <span className="text-slate-600 block text-[11px]">
                      {[m?.dosage, m?.frequency, m?.duration].filter(Boolean).join(" • ")}
                    </span>
                  ) : null}
                  {m?.instructions ? <span className="block text-[11px] text-muted italic">{m.instructions}</span> : null}
                </li>
              ))}
            </ol>
          )}
        </div>

        {values.investigationAdvised ? (
          <div className="border-t border-line pt-2 text-xs">
            <span className="font-bold text-slate-700">Investigation Advised: </span>
            <span className="text-slate-800">{values.investigationAdvised}</span>
          </div>
        ) : null}

        {values.advice ? (
          <div className="border-t border-line pt-2 text-xs">
            <span className="font-bold text-slate-700">Advice: </span>
            <span className="text-slate-800">{values.advice}</span>
          </div>
        ) : null}

        {values.followUpDate ? (
          <div className="text-xs">
            <span className="font-bold text-slate-700">Follow-up: </span>
            <span className="font-bold text-brand-700">{values.followUpDate}</span>
          </div>
        ) : null}

        {/* Digital Signature Stamp */}
        <div className="border-t border-line pt-3 mt-3 text-right">
          <p className="text-[11px] font-bold text-ink">Digitally Signed & Verified</p>
          <p className="text-[10px] text-muted">{header.doctorName}</p>
          <p className="text-[9px] text-slate-400">Dr. Ratish Juyal Neuro & Spine Clinic</p>
        </div>
      </div>
    </div>
  );
}
