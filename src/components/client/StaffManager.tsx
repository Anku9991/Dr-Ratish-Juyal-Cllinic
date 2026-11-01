"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { indianMobile, passwordSchema } from "@/lib/validation";
import { ADMIN_PERMISSIONS, type AdminPermission } from "@/lib/permissions";
import { api } from "./api";
import { Alert, Badge, Field, buttonStyles, inputClass } from "../ui";

const createSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  mobile: indianMobile.optional().or(z.literal("").transform(() => undefined)),
  temporaryPassword: passwordSchema,
});
type CreateInput = z.input<typeof createSchema>;

const PERMISSION_LABEL: Record<AdminPermission, string> = { manage_staff: "Manage staff", medical_records: "View medical records" };

export interface StaffRow {
  id: string;
  full_name: string;
  email: string | null;
  is_active: boolean;
  permissions: string[];
}

export function StaffManager({ currentUserId, rows }: { currentUserId: string; rows: StaffRow[] }) {
  const router = useRouter();
  const [createError, setCreateError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateInput, unknown, z.output<typeof createSchema>>({ resolver: zodResolver(createSchema) });

  async function togglePermission(row: StaffRow, perm: AdminPermission) {
    setBusyRow(row.id);
    setRowError((e) => ({ ...e, [row.id]: "" }));
    const permissions = row.permissions.includes(perm) ? row.permissions.filter((p) => p !== perm) : [...row.permissions, perm];
    const res = await api("/api/admin/staff", "PUT", { userId: row.id, permissions });
    setBusyRow(null);
    if (!res.ok) return setRowError((e) => ({ ...e, [row.id]: res.message }));
    router.refresh();
  }

  async function toggleActive(row: StaffRow) {
    setBusyRow(row.id);
    setRowError((e) => ({ ...e, [row.id]: "" }));
    const res = await api("/api/admin/staff", "PUT", { userId: row.id, permissions: row.permissions, isActive: !row.is_active });
    setBusyRow(null);
    if (!res.ok) return setRowError((e) => ({ ...e, [row.id]: res.message }));
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-3 font-semibold">Add staff member</h2>
        <form
          className="grid gap-4 rounded-[14px] border border-line bg-white p-4 sm:grid-cols-2"
          onSubmit={handleSubmit(async (values) => {
            setCreateError(null);
            const res = await api("/api/admin/staff", "POST", values);
            if (!res.ok) return setCreateError(res.message);
            reset();
            router.refresh();
          })}
        >
          {createError ? (
            <div className="sm:col-span-2">
              <Alert tone="danger">{createError}</Alert>
            </div>
          ) : null}
          <Field label="Full name" htmlFor="s-name" error={errors.fullName?.message}>
            <input id="s-name" className={inputClass} {...register("fullName")} />
          </Field>
          <Field label="Email" htmlFor="s-email" error={errors.email?.message}>
            <input id="s-email" type="email" className={inputClass} {...register("email")} />
          </Field>
          <Field label="Mobile (optional)" htmlFor="s-mobile" error={errors.mobile?.message}>
            <input id="s-mobile" className={inputClass} {...register("mobile")} />
          </Field>
          <Field label="Temporary password" htmlFor="s-pw" error={errors.temporaryPassword?.message}>
            <input id="s-pw" className={inputClass} {...register("temporaryPassword")} />
          </Field>
          <div className="sm:col-span-2">
            <button type="submit" disabled={isSubmitting} className={buttonStyles.primary}>
              {isSubmitting ? "Creating..." : "Add staff member"}
            </button>
          </div>
        </form>
      </div>

      <div>
        <h2 className="mb-3 font-semibold">Staff accounts</h2>
        <ul className="space-y-2">
          {rows.map((r) => (
            <li key={r.id} className="rounded-[14px] border border-line bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium">
                    {r.full_name} {r.id === currentUserId ? <span className="text-xs text-muted">(you)</span> : null}
                  </p>
                  <p className="text-sm text-muted">{r.email}</p>
                </div>
                <Badge tone={r.is_active ? "success" : "neutral"}>{r.is_active ? "Active" : "Inactive"}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-3">
                {ADMIN_PERMISSIONS.map((perm) => (
                  <label key={perm} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={r.permissions.includes(perm)} disabled={busyRow === r.id} onChange={() => togglePermission(r, perm)} />
                    {PERMISSION_LABEL[perm]}
                  </label>
                ))}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  disabled={busyRow === r.id || r.id === currentUserId}
                  onClick={() => toggleActive(r)}
                  className={`${buttonStyles.secondary} !px-3 !py-1.5 text-xs`}
                >
                  {r.is_active ? "Deactivate" : "Activate"}
                </button>
                {rowError[r.id] ? <span className="text-xs text-red-600">{rowError[r.id]}</span> : null}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
