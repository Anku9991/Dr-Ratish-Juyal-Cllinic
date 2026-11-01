import { formatRupees } from "./money";
import type { PublicDoctor } from "@/types/db";

export function doctorFee(d: PublicDoctor): string {
  return formatRupees(d.consultation_fee);
}

export function initials(name: string): string {
  return name
    .replace(/^dr\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p.charAt(0).toUpperCase())
    .join("");
}
