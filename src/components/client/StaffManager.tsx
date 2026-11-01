"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { indianMobile } from "@/lib/validation";
import { ADMIN_PERMISSIONS, type AdminPermission } from "@/lib/permissions";
import { api } from "./api";
import { Alert, Badge, Field, buttonStyles, inputClass } from "../ui";

const createSchema = z.object({
  fullName: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  email: z.string().trim().toLowerCase().email("Valid email required").max(254),
  role: z.enum(["admin", "doctor"]).default("admin"),
  mobile: indianMobile.optional().or(z.literal("").transform(() => undefined)),
  temporaryPassword: z.string().optional().or(z.literal("").transform(() => undefined)),
});
type CreateInput = z.input<typeof createSchema>;

const PERMISSION_LABEL: Record<AdminPermission, string> = {
  manage_staff: "Manage staff & clinic",
  medical_records: "View patient records",
};

export interface StaffRow {
  id: string;
  full_name: string;
  email: string | null;
  role?: string;
  is_active: boolean;
  permissions: string[];
}

export function StaffManager({ currentUserId, rows }: { currentUserId: string; rows: StaffRow[] }) {
  const router = useRouter();
  const [createError, setCreateError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateInput, unknown, z.output<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: "admin" },
  });

  const selectedRole = watch("role");

  async function togglePermission(row: StaffRow, perm: AdminPermission) {
    setBusyRow(row.id);
    setRowError((e) => ({ ...e, [row.id]: "" }));
    const permissions = row.permissions.includes(perm)
      ? row.permissions.filter((p) => p !== perm)
      : [...row.permissions, perm];
    const res = await api("/api/admin/staff", "PUT", { userId: row.id, permissions });
    setBusyRow(null);
    if (!res.ok) return setRowError((e) => ({ ...e, [row.id]: res.message }));
    router.refresh();
  }

  async function toggleActive(row: StaffRow) {
    setBusyRow(row.id);
    setRowError((e) => ({ ...e, [row.id]: "" }));
    const res = await api("/api/admin/staff", "PUT", {
      userId: row.id,
      permissions: row.permissions,
      isActive: !row.is_active,
    });
    setBusyRow(null);
    if (!res.ok) return setRowError((e) => ({ ...e, [row.id]: res.message }));
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {/* Add Staff / Doctor Form */}
      <div className="rounded-[16px] border border-line bg-white p-5 shadow-2xs">
        <h2 className="text-base font-semibold text-ink mb-1">Add Staff Member or Doctor</h2>
        <p className="text-xs text-muted mb-4">
          Add their Google Email. When they click <strong>&quot;Sign in with Google&quot;</strong>, they will automatically be granted access to their respective portal.
        </p>

        {createError ? <Alert tone="danger">{createError}</Alert> : null}
        {successMsg ? <Alert tone="success">{successMsg}</Alert> : null}

        <form
          className="grid gap-4 sm:grid-cols-2 mt-3"
          onSubmit={handleSubmit(async (values) => {
            setCreateError(null);
            setSuccessMsg(null);
            const res = await api<{ id: string }>("/api/admin/staff", "POST", values);
            if (!res.ok) return setCreateError(res.message);
            setSuccessMsg(`Successfully added ${values.fullName} as ${values.role === "doctor" ? "Doctor" : "Staff/Receptionist"}!`);
            reset();
            router.refresh();
          })}
        >
          <Field label="Full Name" htmlFor="s-name" error={errors.fullName?.message}>
            <input id="s-name" placeholder="e.g. Dr. Ramesh / Priya Reception" className={inputClass} {...register("fullName")} />
          </Field>

          <Field label="Google Email Address" htmlFor="s-email" error={errors.email?.message} hint="Gmail / Google Workspace email">
            <input id="s-email" type="email" placeholder="example@gmail.com" className={inputClass} {...register("email")} />
          </Field>

          <Field label="Role Type" htmlFor="s-role" error={errors.role?.message}>
            <select id="s-role" className={inputClass} {...register("role")}>
              <option value="admin">Staff / Receptionist (Clinic Appointments & Admin)</option>
              <option value="doctor">Doctor (OPD Consultation & Digital Pen Pad)</option>
            </select>
          </Field>

          <Field label="Mobile Number (optional)" htmlFor="s-mobile" error={errors.mobile?.message}>
            <input id="s-mobile" placeholder="10-digit mobile number" className={inputClass} {...register("mobile")} />
          </Field>

          <div className="sm:col-span-2">
            <div className="rounded-lg bg-sky-50 border border-sky-100 p-3 text-xs text-sky-800">
              <strong>1-Click Google Login:</strong> Password daalne ki zaroorat nahi hai. Staff/Doctor directly apne Google account se sign in kar sakenge.
            </div>
          </div>

          <div className="sm:col-span-2">
            <button type="submit" disabled={isSubmitting} className={buttonStyles.primary}>
              {isSubmitting ? "Adding..." : `Add ${selectedRole === "doctor" ? "Doctor" : "Staff Member"}`}
            </button>
          </div>
        </form>
      </div>

      {/* List of Registered Accounts */}
      <div>
        <h2 className="text-base font-semibold text-ink mb-3">Registered Staff & Doctor Accounts</h2>
        <ul className="space-y-3">
          {rows.map((r) => {
            const isDoctor = r.role === "doctor" || r.email?.includes("juyal") || r.email?.includes("sharma");
            return (
              <li key={r.id} className="rounded-[14px] border border-line bg-white p-4 shadow-2xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-ink text-sm">
                        {r.full_name} {r.id === currentUserId ? <span className="text-xs font-normal text-muted">(you)</span> : null}
                      </p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isDoctor ? "bg-purple-50 text-purple-700 border border-purple-200" : "bg-blue-50 text-blue-700 border border-blue-200"}`}>
                        {isDoctor ? "Doctor" : "Staff / Admin"}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-0.5">{r.email}</p>
                  </div>
                  <Badge tone={r.is_active ? "success" : "neutral"}>
                    {r.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>

                {!isDoctor ? (
                  <div className="mt-3 flex flex-wrap gap-3">
                    {ADMIN_PERMISSIONS.map((perm) => (
                      <label key={perm} className="flex items-center gap-1.5 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={r.permissions.includes(perm)}
                          disabled={busyRow === r.id}
                          onChange={() => togglePermission(r, perm)}
                        />
                        {PERMISSION_LABEL[perm]}
                      </label>
                    ))}
                  </div>
                ) : null}

                <div className="mt-3 flex items-center gap-2">
                  <button
                    type="button"
                    disabled={busyRow === r.id || r.id === currentUserId}
                    onClick={() => toggleActive(r)}
                    className={`${buttonStyles.secondary} !px-3 !py-1 text-xs`}
                  >
                    {r.is_active ? "Deactivate" : "Activate"}
                  </button>
                  {rowError[r.id] ? <span className="text-xs text-red-600">{rowError[r.id]}</span> : null}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
