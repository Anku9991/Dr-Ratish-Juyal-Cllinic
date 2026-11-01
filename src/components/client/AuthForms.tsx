"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { loginSchema, registerSchema } from "@/lib/validation";
import { api } from "./api";
import { Alert, Field, buttonStyles, inputClass } from "../ui";
import { PinLoginForm } from "./PinLoginForm";

type LoginInput = z.input<typeof loginSchema>;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? undefined;
  const [error, setError] = useState<string | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput, unknown, z.output<typeof loginSchema>>({ resolver: zodResolver(loginSchema) });

  return (
    <div className="space-y-6">
      {/* 1-Click Fast PIN Login */}
      <PinLoginForm />

      {/* Alternative Email Login (Collapsible) */}
      <div className="pt-2 border-t border-line text-center">
        <button
          type="button"
          onClick={() => setShowEmailForm(!showEmailForm)}
          className="text-xs text-muted hover:text-ink font-medium underline cursor-pointer"
        >
          {showEmailForm ? "Hide Email Login" : "Or Sign In with Email & Password"}
        </button>
      </div>

      {showEmailForm ? (
        <form
          noValidate
          className="space-y-4 pt-2"
          onSubmit={handleSubmit(async (values) => {
            setError(null);
            const res = await api<{ redirect: string }>("/api/auth/login", "POST", { ...values, next });
            if (!res.ok) return setError(res.message);
            router.replace(res.data.redirect);
            router.refresh();
          })}
        >
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <input id="email" type="email" autoComplete="email" className={inputClass} {...register("email")} aria-describedby={errors.email ? "email-error" : undefined} />
          </Field>
          <Field label="Password" htmlFor="password" error={errors.password?.message}>
            <input id="password" type="password" autoComplete="current-password" className={inputClass} {...register("password")} aria-describedby={errors.password ? "password-error" : undefined} />
          </Field>
          <button type="submit" disabled={isSubmitting} className={`${buttonStyles.primary} w-full`}>
            {isSubmitting ? "Signing in..." : "Sign in with password"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

type RegisterInput = z.input<typeof registerSchema>;

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [confirmEmail, setConfirmEmail] = useState(false);
  const [showEmailRegister, setShowEmailRegister] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput, unknown, z.output<typeof registerSchema>>({ resolver: zodResolver(registerSchema) });

  if (confirmEmail) {
    return (
      <Alert tone="success" title="Check your email">
        We sent a confirmation link. Open it, then{" "}
        <Link href="/login" className="font-medium underline">
          sign in
        </Link>
        .
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1-Click Fast PIN Register / Entry */}
      <PinLoginForm />

      <div className="pt-2 border-t border-line text-center">
        <button
          type="button"
          onClick={() => setShowEmailRegister(!showEmailRegister)}
          className="text-xs text-muted hover:text-ink font-medium underline cursor-pointer"
        >
          {showEmailRegister ? "Hide Email Form" : "Or Register with Email"}
        </button>
      </div>

      {showEmailRegister ? (
        <form
          noValidate
          className="space-y-4 pt-2"
          onSubmit={handleSubmit(async (values) => {
            setError(null);
            const res = await api<{ needsEmailConfirmation: boolean }>("/api/auth/register", "POST", values);
            if (!res.ok) return setError(res.message);
            if (res.data.needsEmailConfirmation) return setConfirmEmail(true);
            router.replace("/patient/profile?welcome=1");
            router.refresh();
          })}
        >
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <Field label="Full name" htmlFor="fullName" error={errors.fullName?.message}>
            <input id="fullName" autoComplete="name" className={inputClass} {...register("fullName")} />
          </Field>
          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <input id="email" type="email" autoComplete="email" className={inputClass} {...register("email")} />
          </Field>
          <Field label="Mobile number" htmlFor="mobile" error={errors.mobile?.message} hint="10-digit Indian mobile number.">
            <input id="mobile" type="tel" inputMode="numeric" autoComplete="tel-national" className={inputClass} {...register("mobile")} />
          </Field>
          <Field label="Password" htmlFor="password" error={errors.password?.message} hint="At least 8 characters.">
            <input id="password" type="password" autoComplete="new-password" className={inputClass} {...register("password")} />
          </Field>
          <div>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" {...register("acceptTerms")} />
              <span>
                I agree to the{" "}
                <Link href="/terms" className="font-medium text-brand-700 underline" target="_blank">
                  terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="font-medium text-brand-700 underline" target="_blank">
                  privacy policy
                </Link>
                .
              </span>
            </label>
            {errors.acceptTerms ? <p className="mt-1 text-xs text-red-600">{errors.acceptTerms.message}</p> : null}
          </div>
          <button type="submit" disabled={isSubmitting} className={`${buttonStyles.primary} w-full`}>
            {isSubmitting ? "Creating account..." : "Create account"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
