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
}: {
  appointmentId: string;
  header: PatientHeaderInfo;
  initial: FormValues;
  history: HistoryItem[];
  locked: boolean;
  appointmentStatus: string;
}) {
  const router = useRouter();
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [finalizeError, setFinalizeError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
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

  async function saveDraft(data: FormOutput) {
    setSaveState("saving");
    setSaveError(null);
    const payload = {
      ...data,
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
        <div className="rounded-[14px] border border-line bg-white p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-lg font-semibold">{header.name}</p>
              <p className="text-sm text-muted">
                UHID {header.uhid}
                {header.age !== null ? ` - ${header.age} yrs` : ""}
                {header.gender ? `, ${header.gender}` : ""}
              </p>
            </div>
            <div className="text-right text-sm text-muted">
              <p>{header.appointmentNumber}</p>
              <p>
                {formatDateLong(header.date)}, {formatTime12(header.time)}
              </p>
            </div>
          </div>
          {history.length > 0 ? (
            <button type="button" onClick={() => setShowHistory((s) => !s)} className="mt-2 text-sm font-medium text-brand-700 hover:underline">
              {showHistory ? "Hide" : "Show"} previous visits ({history.length})
            </button>
          ) : null}
          {showHistory ? (
            <ul className="mt-2 space-y-1 border-t border-line pt-2 text-sm text-muted">
              {history.map((h) => (
                <li key={h.id}>
                  {formatDateLong(h.date)}: {h.diagnosis ?? "No diagnosis recorded"}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* Prescription Entry Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
          <div className="flex items-center gap-1.5 rounded-lg border border-line bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setViewMode("both")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === "both" ? "bg-white text-brand-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Split View (Pad & Form)
            </button>
            <button
              type="button"
              onClick={() => setViewMode("pad")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === "pad" ? "bg-white text-brand-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Digital Writing Pad (Stylus)
            </button>
            <button
              type="button"
              onClick={() => setViewMode("form")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                viewMode === "form" ? "bg-white text-brand-700 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Structured Form Only
            </button>
          </div>

          <div className="text-xs text-muted">
            {viewMode === "pad" ? "Writing Mode • Connect external iPad or draw directly" : "Dual Entry Enabled"}
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
            <fieldset className="space-y-3 rounded-[14px] border border-line bg-white p-4">
              <legend className="px-1 text-sm font-semibold">Vitals</legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <Field label="Blood pressure" htmlFor="bp" error={errors.bloodPressure?.message}>
                  <input id="bp" placeholder="120/80" className={inputClass} {...register("bloodPressure")} />
                </Field>
                <Field label="Pulse (bpm)" htmlFor="pulse" error={errors.pulse?.message}>
                  <input id="pulse" type="number" className={inputClass} {...register("pulse")} />
                </Field>
                <Field label="Temp (F)" htmlFor="temp" error={errors.temperature?.message}>
                  <input id="temp" type="number" step="0.1" className={inputClass} {...register("temperature")} />
                </Field>
                <Field label="SpO2 (%)" htmlFor="spo2" error={errors.spo2?.message}>
                  <input id="spo2" type="number" className={inputClass} {...register("spo2")} />
                </Field>
                <Field label="Weight (kg)" htmlFor="weight" error={errors.weight?.message}>
                  <input id="weight" type="number" step="0.1" className={inputClass} {...register("weight")} />
                </Field>
              </div>
            </fieldset>

            <Field label="Symptoms" htmlFor="symptoms" error={errors.symptoms?.message}>
              <textarea id="symptoms" rows={2} className={inputClass} {...register("symptoms")} />
            </Field>
            <Field label="Examination notes" htmlFor="exam" error={errors.examinationNotes?.message}>
              <textarea id="exam" rows={2} className={inputClass} {...register("examinationNotes")} />
            </Field>
            <Field label="Diagnosis" htmlFor="diagnosis" error={errors.diagnosis?.message}>
              <textarea id="diagnosis" rows={2} className={inputClass} {...register("diagnosis")} placeholder={padDataUrl ? "Optional (handwritten on pad)" : "Diagnosis"} />
            </Field>

            <fieldset className="space-y-3 rounded-[14px] border border-line bg-white p-4">
              <div className="flex items-center justify-between px-1">
                <legend className="text-sm font-semibold">Medicines</legend>
                <button type="button" onClick={() => append(EMPTY_MEDICINE)} className="text-sm font-medium text-brand-700 hover:underline">
                  + Add medicine
                </button>
              </div>
              {fields.length === 0 ? <p className="px-1 text-sm text-muted">No medicines added yet (or handwrite them on the pad above).</p> : null}
              <div className="space-y-4">
                {fields.map((f, i) => (
                  <div key={f.id} className="space-y-2 rounded-lg border border-line p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted">Medicine {i + 1}</p>
                      <button type="button" onClick={() => remove(i)} className="text-xs font-medium text-red-600 hover:underline">
                        Remove
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Field label="Name" htmlFor={`m${i}name`} error={errors.medicines?.[i]?.medicineName?.message}>
                        <input id={`m${i}name`} className={inputClass} {...register(`medicines.${i}.medicineName` as const)} />
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
              {errors.medicines?.message ? <p className="text-xs text-red-600">{errors.medicines.message}</p> : null}
            </fieldset>

            <Field label="Advice" htmlFor="advice" error={errors.advice?.message}>
              <textarea id="advice" rows={2} className={inputClass} {...register("advice")} />
            </Field>
            <Field label="Follow-up date" htmlFor="followup" error={errors.followUpDate?.message}>
              <input id="followup" type="date" className={inputClass} {...register("followUpDate")} />
            </Field>

            {saveError ? <Alert tone="danger">{saveError}</Alert> : null}
            {finalizeError ? <Alert tone="danger">{finalizeError}</Alert> : null}
            {!canFinalize ? <Alert tone="info">Write on the digital pad or add a diagnosis and at least one medicine before finalizing.</Alert> : null}

            <div className="flex flex-wrap items-center gap-3">
              <button type="button" disabled={saveState === "saving"} className={buttonStyles.secondary} onClick={handleSubmit(saveDraft)}>
                {saveState === "saving" ? "Saving..." : "Save draft"}
              </button>
              <button type="button" disabled={finalizing || !canFinalize} className={buttonStyles.primary} onClick={handleSubmit(finalize)}>
                {finalizing ? "Issuing..." : "Finalize & issue prescription"}
              </button>
              {saveState === "saved" ? <span className="text-sm text-emerald-700">Draft saved</span> : null}
            </div>
            <p className="text-xs text-muted">Finalizing locks this consultation and marks the appointment complete ({appointmentStatus === "in_consultation" ? "in progress" : appointmentStatus}).</p>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button type="button" disabled={saveState === "saving"} className={buttonStyles.secondary} onClick={handleSubmit(saveDraft)}>
              {saveState === "saving" ? "Saving..." : "Save draft"}
            </button>
            <button type="button" disabled={finalizing || !canFinalize} className={buttonStyles.primary} onClick={handleSubmit(finalize)}>
              {finalizing ? "Issuing..." : "Finalize & issue prescription"}
            </button>
            {saveState === "saved" ? <span className="text-sm text-emerald-700">Draft saved</span> : null}
          </div>
        )}
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <PrescriptionPreview header={header} values={values} padDrawing={padDataUrl} />
      </div>
    </div>
  );
}

function PrescriptionPreview({
  header,
  values,
  padDrawing,
}: {
  header: PatientHeaderInfo;
  values: FormValues;
  padDrawing?: string | null;
}) {
  const medicines = (values.medicines ?? []).filter((m) => m?.medicineName?.trim());
  return (
    <div className="rounded-[14px] border border-line bg-white p-5 text-sm">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Live preview</p>
      <div className="rounded-lg border border-dashed border-line p-4 space-y-3">
        <div>
          <p className="font-semibold text-brand-700">{header.doctorName}</p>
          <p className="text-xs text-muted">Dr. Ratish Juyal Neuro & Spine Clinic, Lucknow</p>
        </div>

        <div className="border-t border-line pt-2 text-xs">
          <p className="font-medium text-ink">
            {header.name} • {header.uhid}
            {header.age !== null ? `, ${header.age} yrs` : ""}
            {header.gender ? `, ${header.gender}` : ""}
          </p>
        </div>

        {/* Digital Pad Handwritten Prescription Display */}
        {padDrawing ? (
          <div className="rounded-lg border border-brand-200 bg-slate-50 p-2 space-y-1">
            <span className="text-[11px] font-semibold text-brand-700 uppercase tracking-wide">
              Digital Writing Pad Notes (Attached)
            </span>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={padDrawing}
              alt="Handwritten Prescription Pad"
              className="w-full h-auto rounded border border-line bg-white shadow-xs max-h-64 object-contain"
            />
          </div>
        ) : null}

        {values.diagnosis ? (
          <div>
            <span className="font-medium text-xs text-muted block">Diagnosis:</span>
            <p className="text-sm font-medium">{values.diagnosis}</p>
          </div>
        ) : null}

        <div>
          <p className="font-semibold text-xs text-muted mb-1">Rx Medicines:</p>
          {medicines.length === 0 ? (
            <p className="text-xs text-muted italic">
              {padDrawing ? "Medicines written directly on digital pad above." : "No medicines added yet."}
            </p>
          ) : (
            <ol className="list-decimal space-y-1 pl-4 text-xs">
              {medicines.map((m, i) => (
                <li key={i}>
                  <span className="font-medium">
                    {m?.medicineName} {m?.strength}
                  </span>
                  {m?.dosage || m?.frequency || m?.duration ? (
                    <span className="text-muted">
                      {" "}
                      - {[m?.dosage, m?.frequency, m?.duration].filter(Boolean).join(", ")}
                    </span>
                  ) : null}
                  {m?.instructions ? <span className="block text-[11px] text-muted">{m.instructions}</span> : null}
                </li>
              ))}
            </ol>
          )}
        </div>

        {values.advice ? (
          <div className="border-t border-line pt-2 text-xs">
            <span className="font-medium text-muted">Advice: </span>
            <span>{values.advice}</span>
          </div>
        ) : null}

        {values.followUpDate ? (
          <div className="text-xs">
            <span className="font-medium text-muted">Follow-up: </span>
            <span className="font-semibold text-brand-700">{values.followUpDate}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
