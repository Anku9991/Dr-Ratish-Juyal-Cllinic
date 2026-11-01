import Link from "next/link";
import type { PublicDoctor } from "@/types/db";
import { doctorFee, initials } from "@/lib/public-format";
import { Clock } from "lucide-react";

export function DoctorCard({ doctor }: { doctor: PublicDoctor }) {
  return (
    <Link
      href={`/doctors/${doctor.id}`}
      className="group flex gap-4 rounded-[16px] border border-line bg-white p-5 hover:border-brand-500 hover:shadow-md transition"
    >
      <span
        aria-hidden
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-base font-bold text-brand-700 border border-brand-100"
      >
        {initials(doctor.full_name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2">
          <span className="block font-bold text-ink text-base group-hover:text-brand-700">
            {doctor.full_name}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            <Clock className="h-3 w-3" />
            12 PM – 5 PM
          </span>
        </span>
        <span className="block text-xs font-medium text-brand-600 mt-0.5">{doctor.speciality}</span>
        {doctor.qualification ? (
          <span className="block truncate text-xs text-muted mt-0.5">{doctor.qualification}</span>
        ) : null}
        <span className="mt-2.5 flex items-center justify-between text-xs pt-2 border-t border-line">
          <span className="font-semibold text-ink">{doctorFee(doctor)} consultation</span>
          <span className="text-brand-700 font-medium group-hover:underline">Book slot →</span>
        </span>
      </span>
    </Link>
  );
}
