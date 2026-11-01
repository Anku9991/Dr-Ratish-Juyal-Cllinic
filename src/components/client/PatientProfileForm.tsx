"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "./api";
import { Alert, Field, buttonStyles, inputClass } from "../ui";

export interface ProfileValues {
  fullName: string;
  mobile: string;
  dateOfBirth: string;
  gender: string;
  address: string;
  emergencyContact: string;
  allergies: string;
  medicalHistory: string;
}

export function PatientProfileForm({ initial }: { initial: ProfileValues }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const set = (k: keyof ProfileValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV({ ...v, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrors({});
    setSaved(false);
    const res = await api("/api/patient/profile", "PUT", v);
    setBusy(false);
    if (!res.ok) {
      setError(res.message);
      if (res.fieldErrors) setErrors(res.fieldErrors);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {saved ? <Alert tone="success">Profile saved.</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="fullName" error={errors.fullName}>
          <input id="fullName" className={inputClass} value={v.fullName} onChange={set("fullName")} required />
        </Field>
        <Field label="Mobile number" htmlFor="mobile" error={errors.mobile}>
          <input id="mobile" type="tel" inputMode="numeric" className={inputClass} value={v.mobile} onChange={set("mobile")} required />
        </Field>
        <Field label="Date of birth" htmlFor="dob" error={errors.dateOfBirth}>
          <input id="dob" type="date" className={inputClass} value={v.dateOfBirth} onChange={set("dateOfBirth")} max={new Date().toISOString().slice(0, 10)} />
        </Field>
        <Field label="Gender" htmlFor="gender" error={errors.gender}>
          <select id="gender" className={inputClass} value={v.gender} onChange={set("gender")}>
            <option value="">Prefer not to say</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </Field>
      </div>
      <Field label="Address" htmlFor="address" error={errors.address}>
        <textarea id="address" rows={2} className={inputClass} value={v.address} onChange={set("address")} maxLength={500} />
      </Field>
      <Field label="Emergency contact" htmlFor="emergency" error={errors.emergencyContact} hint="Name and phone number of someone we can call.">
        <input id="emergency" className={inputClass} value={v.emergencyContact} onChange={set("emergencyContact")} maxLength={200} />
      </Field>
      <Field label="Allergies" htmlFor="allergies" error={errors.allergies} hint="Shared with your consulting doctor only.">
        <textarea id="allergies" rows={2} className={inputClass} value={v.allergies} onChange={set("allergies")} maxLength={2000} />
      </Field>
      <Field label="Medical history" htmlFor="history" error={errors.medicalHistory} hint="Existing conditions, past surgeries, regular medicines.">
        <textarea id="history" rows={3} className={inputClass} value={v.medicalHistory} onChange={set("medicalHistory")} maxLength={4000} />
      </Field>
      <button type="submit" disabled={busy} className={buttonStyles.primary}>
        {busy ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}
