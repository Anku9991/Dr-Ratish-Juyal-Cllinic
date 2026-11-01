"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { clinicSettingsSchema } from "@/lib/validation";
import { api } from "./api";
import { Alert, Field, buttonStyles, inputClass } from "../ui";

type Input = z.input<typeof clinicSettingsSchema>;

export function ClinicSettingsForm({ initial }: { initial: Input }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Input, unknown, z.output<typeof clinicSettingsSchema>>({ resolver: zodResolver(clinicSettingsSchema), defaultValues: initial });

  return (
    <form
      className="space-y-4"
      onSubmit={handleSubmit(async (values) => {
        setError(null);
        setSaved(false);
        const res = await api("/api/admin/settings", "PUT", values);
        if (!res.ok) return setError(res.message);
        setSaved(true);
        router.refresh();
      })}
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {saved ? <Alert tone="success">Settings saved.</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Clinic name" htmlFor="clinicName" error={errors.clinicName?.message}>
          <input id="clinicName" className={inputClass} {...register("clinicName")} />
        </Field>
        <Field label="Phone" htmlFor="phone" error={errors.phone?.message}>
          <input id="phone" className={inputClass} {...register("phone")} />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email?.message}>
          <input id="email" className={inputClass} {...register("email")} />
        </Field>
        <Field label="Timezone" htmlFor="timezone" error={errors.timezone?.message}>
          <input id="timezone" className={inputClass} {...register("timezone")} />
        </Field>
      </div>
      <Field label="Address" htmlFor="address" error={errors.address?.message}>
        <textarea id="address" rows={2} className={inputClass} {...register("address")} />
      </Field>
      <Field label="Prescription footer" htmlFor="footer" error={errors.prescriptionFooter?.message} hint="Shown at the bottom of every prescription PDF.">
        <textarea id="footer" rows={2} className={inputClass} {...register("prescriptionFooter")} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Cancellation window (hours)" htmlFor="cw" error={errors.cancellationWindowHours?.message}>
          <input id="cw" type="number" className={inputClass} {...register("cancellationWindowHours")} />
        </Field>
        <Field label="Slot hold (minutes)" htmlFor="sh" error={errors.slotHoldMinutes?.message}>
          <input id="sh" type="number" className={inputClass} {...register("slotHoldMinutes")} />
        </Field>
        <Field label="Booking horizon (days)" htmlFor="bh" error={errors.bookingHorizonDays?.message}>
          <input id="bh" type="number" className={inputClass} {...register("bookingHorizonDays")} />
        </Field>
        <Field label="Record retention (years)" htmlFor="rr" error={errors.recordRetentionYears?.message}>
          <input id="rr" type="number" className={inputClass} {...register("recordRetentionYears")} />
        </Field>
      </div>
      <button type="submit" disabled={isSubmitting} className={buttonStyles.primary}>
        {isSubmitting ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}
