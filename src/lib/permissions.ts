import type { Role } from "./status";

export const ROLE_HOME: Record<Role, string> = {
  patient: "/patient",
  doctor: "/doctor",
  admin: "/admin",
};

const PREFIX_ROLE: Array<[string, Role]> = [
  ["/patient", "patient"],
  ["/doctor", "doctor"],
  ["/admin", "admin"],
];

/** The role required by a path, or null for public paths. */
export function requiredRoleForPath(pathname: string): Role | null {
  for (const [prefix, role] of PREFIX_ROLE) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return role;
  }
  return null;
}

export function canAccessPath(role: Role | null, pathname: string): boolean {
  const required = requiredRoleForPath(pathname);
  if (!required) return true;
  return role === required;
}

export const ADMIN_PERMISSIONS = ["manage_staff", "medical_records"] as const;
export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export function hasPermission(role: Role, permissions: readonly string[], needed: AdminPermission): boolean {
  return role === "admin" && permissions.includes(needed);
}

/** Only allow same-site relative redirects after login. */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null;
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return null;
  return next;
}
