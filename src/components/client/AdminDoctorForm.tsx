"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { createDoctorSchema, updateDoctorSchema } from "@/lib/validation";
import { api } from "./api";
import { Alert, Field, buttonStyles, inputClass } from "../ui";

type CreateInput = z.input<typeof createDoctorSchema>;

export function NewDoctorForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateInput, unknown, z.output<typeof createDoctorSchema>>({ resolver: zodResolver(createDoctorSchema) });

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit(async (values) => {
        setError(null);
        const res = await api<{ id: string }>("/api/admin/doctors", "POST", values);
        if (!res.ok) return setError(res.message);
        router.push(`/admin/doctors/${res.data.id}`);
      })}
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="fullName" error={errors.fullName?.message}>
          <input id="fullName" className={inputClass} {...register("fullName")} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <input id="email" type="email" className={inputClass} {...register("email")} />
        </Field>
        <Field label="Mobile" htmlFor="mobile" error={errors.mobile?.message}>
          <input id="mobile" className={inputClass} {...register("mobile")} />
        </Field>
        <Field label="Temporary password" htmlFor="pw" error={errors.temporaryPassword?.message} hint="Share this with the doctor to sign in for the first time.">
          <input id="pw" className={inputClass} {...register("temporaryPassword")} />
        </Field>
        <Field label="Speciality" htmlFor="speciality" error={errors.speciality?.message}>
          <input id="speciality" className={inputClass} {...register("speciality")} />
        </Field>
        <Field label="Consultation fee (INR)" htmlFor="fee" error={errors.consultationFee?.message}>
          <input id="fee" type="number" step="0.01" className={inputClass} {...register("consultationFee")} />
        </Field>
        <Field label="Qualification" htmlFor="qual" error={errors.qualification?.message}>
          <input id="qual" className={inputClass} {...register("qualification")} />
        </Field>
        <Field label="Registration number" htmlFor="reg" error={errors.registrationNumber?.message}>
          <input id="reg" className={inputClass} {...register("registrationNumber")} />
        </Field>
      </div>
      <Field label="Bio" htmlFor="bio" error={errors.bio?.message}>
        <textarea id="bio" rows={3} className={inputClass} {...register("bio")} />
      </Field>
      <button type="submit" disabled={isSubmitting} className={buttonStyles.primary}>
        {isSubmitting ? "Creating..." : "Create doctor"}
      </button>
    </form>
  );
}

type UpdateInput = z.input<typeof updateDoctorSchema>;

export function EditDoctorForm({ doctorId, initial }: { doctorId: string; initial: UpdateInput }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateInput, unknown, z.output<typeof updateDoctorSchema>>({ resolver: zodResolver(updateDoctorSchema), defaultValues: initial });

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit(async (values) => {
        setError(null);
        setSaved(false);
        const res = await api(`/api/admin/doctors/${doctorId}`, "PATCH", values);
        if (!res.ok) return setError(res.message);
        setSaved(true);
        router.refresh();
      })}
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {saved ? <Alert tone="success">Saved.</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="e-fullName" error={errors.fullName?.message}>
          <input id="e-fullName" className={inputClass} {...register("fullName")} />
        </Field>
        <Field label="Speciality" htmlFor="e-speciality" error={errors.speciality?.message}>
          <input id="e-speciality" className={inputClass} {...register("speciality")} />
        </Field>
        <Field label="Consultation fee (INR)" htmlFor="e-fee" error={errors.consultationFee?.message}>
          <input id="e-fee" type="number" step="0.01" className={inputClass} {...register("consultationFee")} />
        </Field>
        <Field label="Registration number" htmlFor="e-reg" error={errors.registrationNumber?.message}>
          <input id="e-reg" className={inputClass} {...register("registrationNumber")} />
        </Field>
        <Field label="Qualification" htmlFor="e-qual" error={errors.qualification?.message}>
          <input id="e-qual" className={inputClass} {...register("qualification")} />
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
          <input type="checkbox" {...register("isActive")} /> Active (bookable)
        </label>
      </div>
      <Field label="Bio" htmlFor="e-bio" error={errors.bio?.message}>
        <textarea id="e-bio" rows={3} className={inputClass} {...register("bio")} />
      </Field>
      <button type="submit" disabled={isSubmitting} className={buttonStyles.primary}>
        {isSubmitting ? "Saving..." : "Save changes"}
      </button>
    </form>
  );
}
