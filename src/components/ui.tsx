import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export const inputClass =
  "block w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-200 disabled:bg-slate-50 disabled:text-slate-500";

const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60";
export const buttonStyles = {
  primary: `${buttonBase} bg-brand-600 text-white hover:bg-brand-700`,
  secondary: `${buttonBase} border border-line bg-white text-ink hover:bg-slate-50`,
  danger: `${buttonBase} bg-red-600 text-white hover:bg-red-700`,
  ghost: `${buttonBase} text-brand-700 hover:bg-brand-50`,
};

export function LinkButton({ href, variant = "primary", children, className }: { href: string; variant?: keyof typeof buttonStyles; children: ReactNode; className?: string }) {
  return (
    <Link href={href} className={cn(buttonStyles[variant], className)}>
      {children}
    </Link>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-[14px] border border-line bg-white p-5", className)}>{children}</section>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

const tones = {
  neutral: "bg-slate-100 text-slate-700",
  info: "bg-brand-100 text-brand-700",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  danger: "bg-red-100 text-red-700",
};

export function Badge({ tone = "neutral", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone])}>{children}</span>;
}

const APPOINTMENT_TONE: Record<string, keyof typeof tones> = {
  pending_payment: "warning",
  confirmed: "info",
  checked_in: "info",
  in_consultation: "info",
  completed: "success",
  cancelled: "danger",
  no_show: "danger",
  expired: "neutral",
};
const PAYMENT_TONE: Record<string, keyof typeof tones> = {
  created: "warning",
  authorized: "warning",
  captured: "success",
  failed: "danger",
  refunded: "neutral",
  partially_refunded: "neutral",
};

export function label(value: string): string {
  const s = value.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function AppointmentBadge({ status }: { status: string }) {
  return <Badge tone={APPOINTMENT_TONE[status] ?? "neutral"}>{label(status)}</Badge>;
}
export function PaymentBadge({ status }: { status: string }) {
  return <Badge tone={PAYMENT_TONE[status] ?? "neutral"}>{label(status)}</Badge>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-[14px] border border-dashed border-line bg-white px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Alert({ tone = "info", title, children }: { tone?: "info" | "success" | "warning" | "danger"; title?: string; children?: ReactNode }) {
  const styles = {
    info: "border-brand-200 bg-brand-50 text-brand-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-900",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("rounded-lg border px-4 py-3 text-sm", styles[tone])}>
      {title ? <p className="font-medium">{title}</p> : null}
      {children ? <div className={title ? "mt-0.5" : ""}>{children}</div> : null}
    </div>
  );
}

export function Field({ label: text, htmlFor, error, hint, children }: { label: string; htmlFor: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium">
        {text}
      </label>
      {children}
      {hint && !error ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
      {error ? (
        <p id={`${htmlFor}-error`} className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Responsive table: scrolls horizontally on small screens. */
export function TableWrap({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-[14px] border border-line bg-white">
      <table className="min-w-full text-left text-sm">{children}</table>
    </div>
  );
}
export const th = "whitespace-nowrap border-b border-line bg-slate-50 px-4 py-2.5 text-xs font-semibold text-muted";
export const td = "border-b border-line px-4 py-3 align-top last:border-b-0";

export function DefinitionList({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k}>
          <dt className="text-xs text-muted">{k}</dt>
          <dd className="mt-0.5 text-sm font-medium">{v ?? "-"}</dd>
        </div>
      ))}
    </dl>
  );
}
