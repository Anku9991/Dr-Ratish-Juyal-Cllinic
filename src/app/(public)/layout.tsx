import Link from "next/link";
import type { ReactNode } from "react";
import { getPublicClinic, clinicDisplayName } from "@/lib/clinic";
import { getSessionUser } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/permissions";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const [clinic, user] = await Promise.all([getPublicClinic(), getSessionUser()]);
  const name = clinicDisplayName(clinic);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="text-lg font-semibold text-brand-700">
            {name}
          </Link>
          <nav aria-label="Primary" className="flex flex-wrap items-center gap-1 text-sm">
            <Link href="/doctors" className="rounded-lg px-3 py-2 hover:bg-slate-100">
              Doctors
            </Link>
            <Link href="/videos" className="rounded-lg px-3 py-2 hover:bg-slate-100 font-medium text-purple-700">
              Videos
            </Link>
            <Link href="/queue" target="_blank" className="rounded-lg px-3 py-2 hover:bg-slate-100 font-medium text-emerald-700 flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Queue TV</span>
            </Link>
            <Link href="/contact" className="rounded-lg px-3 py-2 hover:bg-slate-100">
              Contact
            </Link>
            {user ? (
              <Link href={ROLE_HOME[user.role]} className="rounded-lg bg-brand-600 px-3 py-2 font-medium text-white hover:bg-brand-700">
                My dashboard
              </Link>
            ) : (
              <>
                <Link href="/login" className="rounded-lg px-3 py-2 hover:bg-slate-100">
                  Sign in
                </Link>
                <Link href="/register" className="rounded-lg bg-brand-600 px-3 py-2 font-medium text-white hover:bg-brand-700">
                  Register
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-2 px-4 py-4 text-xs text-muted sm:px-6">
          <span>{name}</span>
          <span className="flex gap-4">
            <Link href="/terms" className="hover:text-ink">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-ink">
              Privacy policy
            </Link>
            <Link href="/contact" className="hover:text-ink">
              Contact
            </Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
