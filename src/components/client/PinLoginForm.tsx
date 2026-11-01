"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, buttonStyles, inputClass } from "../ui";
import { Stethoscope, UserCheck, Users, Activity, KeyRound, ArrowRight } from "lucide-react";

interface RoleOption {
  role: "doctor" | "admin" | "patient";
  title: string;
  subtitle: string;
  pin: string;
  badge: string;
  icon: typeof Stethoscope;
  color: string;
  border: string;
}

const QUICK_ROLES: RoleOption[] = [
  {
    role: "doctor",
    title: "Dr. Ratish Juyal (Doctor Portal)",
    subtitle: "OPD Consultation, Digital Prescription Pad & Patients Queue",
    pin: "1234",
    badge: "PIN: 1234",
    icon: Stethoscope,
    color: "bg-purple-50 text-purple-700",
    border: "border-purple-200 hover:border-purple-400 hover:bg-purple-50/50",
  },
  {
    role: "doctor",
    title: "Dr. Amit Sharma (Neuro-Physio)",
    subtitle: "Rehabilitation, Stroke recovery & Physical Therapy",
    pin: "1235",
    badge: "PIN: 1235",
    icon: Activity,
    color: "bg-teal-50 text-teal-700",
    border: "border-teal-200 hover:border-teal-400 hover:bg-teal-50/50",
  },
  {
    role: "admin",
    title: "Staff & Receptionist Desk",
    subtitle: "Appointments management, Token Counter, Clinic Settings",
    pin: "2345",
    badge: "PIN: 2345",
    icon: Users,
    color: "bg-blue-50 text-blue-700",
    border: "border-blue-200 hover:border-blue-400 hover:bg-blue-50/50",
  },
  {
    role: "patient",
    title: "Patient Portal",
    subtitle: "Book Doctor, View Prescriptions & Appointment History",
    pin: "3456",
    badge: "PIN: 3456",
    icon: UserCheck,
    color: "bg-emerald-50 text-emerald-700",
    border: "border-emerald-200 hover:border-emerald-400 hover:bg-emerald-50/50",
  },
];

export function PinLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? undefined;

  const [pin, setPin] = useState("");
  const [patientName, setPatientName] = useState("");
  const [patientMobile, setPatientMobile] = useState("");
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualMode, setManualMode] = useState(false);

  const handleLogin = async (loginPin: string, role?: "doctor" | "admin" | "patient") => {
    try {
      setError(null);
      setLoadingRole(role || loginPin);

      const res = await fetch("/api/auth/pin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: loginPin,
          selectedRole: role,
          patientName: patientName || undefined,
          patientMobile: patientMobile || undefined,
          next,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Invalid PIN. Please try again.");
      }

      router.replace(data.redirect || "/patient");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login failed";
      setError(msg);
      setLoadingRole(null);
    }
  };

  return (
    <div className="space-y-6">
      {error ? <Alert tone="danger">{error}</Alert> : null}

      {/* Quick 1-Click Role Login Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            Quick 1-Click Role Login
          </label>
          <span className="text-xs text-muted">Click any to login instantly</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {QUICK_ROLES.map((r) => {
            const Icon = r.icon;
            const isLoading = loadingRole === r.role && pin === r.pin;
            return (
              <button
                key={r.pin}
                type="button"
                onClick={() => {
                  setPin(r.pin);
                  handleLogin(r.pin, r.role);
                }}
                disabled={Boolean(loadingRole)}
                className={`flex flex-col text-left p-3.5 rounded-xl border bg-white shadow-2xs transition-all cursor-pointer ${r.border} disabled:opacity-60`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2.5">
                    <span className={`p-2 rounded-lg ${r.color}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="font-semibold text-sm text-ink">{r.title}</span>
                  </div>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                    {r.badge}
                  </span>
                </div>
                <p className="text-xs text-muted mt-2 pl-0.5 line-clamp-1">{r.subtitle}</p>
                <div className="mt-3 flex items-center justify-end text-xs font-medium text-brand-700 gap-1">
                  <span>{isLoading ? "Signing in..." : "Enter Portal"}</span>
                  <ArrowRight className="h-3 w-3" />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Manual PIN / Mobile Input Toggle */}
      <div className="rounded-xl border border-line bg-slate-50/70 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-ink">Enter Custom PIN or Mobile</span>
          </div>
          <button
            type="button"
            onClick={() => setManualMode(!manualMode)}
            className="text-xs text-brand-700 underline font-medium cursor-pointer"
          >
            {manualMode ? "Hide Form" : "Enter PIN"}
          </button>
        </div>

        {manualMode ? (
          <form
            className="mt-3 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (pin) handleLogin(pin);
            }}
          >
            <div>
              <label htmlFor="custom-pin" className="block text-xs font-medium text-slate-700 mb-1">
                4-Digit PIN (Doctor: 1234, Staff: 2345, Patient: 3456)
              </label>
              <input
                id="custom-pin"
                type="password"
                maxLength={6}
                placeholder="Enter 4-digit PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className={`${inputClass} tracking-widest text-center text-lg font-mono font-bold`}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label htmlFor="pat-name" className="block text-xs font-medium text-slate-700 mb-1">
                  Name (optional for patients)
                </label>
                <input
                  id="pat-name"
                  type="text"
                  placeholder="Patient Name"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="pat-mob" className="block text-xs font-medium text-slate-700 mb-1">
                  Mobile (optional)
                </label>
                <input
                  id="pat-mob"
                  type="tel"
                  placeholder="10-digit mobile"
                  value={patientMobile}
                  onChange={(e) => setPatientMobile(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!pin || Boolean(loadingRole)}
              className={`${buttonStyles.primary} w-full`}
            >
              {loadingRole ? "Logging in..." : "Sign In with PIN"}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
