import Link from "next/link";
import type { ReactNode } from "react";
import { LogoutButton } from "./client/LogoutButton";
import { NavLinks } from "./client/NavLinks";

export interface NavItem {
  href: string;
  label: string;
}

export function AppShell({ clinicName, roleLabel, userName, nav, children }: { clinicName: string; roleLabel: string; userName: string; nav: NavItem[]; children: ReactNode }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="no-print border-b border-line bg-white lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-4 py-3 lg:block lg:px-5 lg:py-5">
          <Link href="/" className="block">
            <span className="block text-base font-semibold text-brand-700">{clinicName}</span>
            <span className="block text-xs text-muted">{roleLabel}</span>
          </Link>
        </div>
        <NavLinks items={nav} />
        <div className="hidden border-t border-line p-3 lg:absolute lg:inset-x-0 lg:bottom-0 lg:block">
          <p className="truncate px-3 pb-1 text-xs text-muted">{userName}</p>
          <LogoutButton />
        </div>
        <div className="border-t border-line p-2 lg:hidden">
          <LogoutButton />
        </div>
      </aside>
      <main id="main" className="min-w-0 px-4 py-6 sm:px-8 lg:py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
