"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { NavItem } from "../AppShell";

export function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  // The shortest href (the dashboard root) only matches exactly so it is not always highlighted.
  const roots = items.map((i) => i.href).sort((a, b) => a.length - b.length);
  const root = roots[0];
  return (
    <nav aria-label="Main" className="flex gap-1 overflow-x-auto px-3 pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
      {items.map((item) => {
        const active = item.href === root ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium",
              active ? "bg-brand-50 text-brand-700" : "text-muted hover:bg-slate-100 hover:text-ink",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
