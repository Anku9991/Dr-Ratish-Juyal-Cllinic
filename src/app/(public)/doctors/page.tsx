import type { Metadata } from "next";
import { listPublicDoctors } from "@/lib/clinic";
import { DoctorCard } from "@/components/DoctorCard";
import { EmptyState, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Doctors" };

export default async function DoctorsPage({ searchParams }: { searchParams: Promise<{ speciality?: string }> }) {
  const { speciality } = await searchParams;
  const all = await listPublicDoctors();
  const specialities = [...new Set(all.map((d) => d.speciality))].sort();
  const doctors = speciality ? all.filter((d) => d.speciality === speciality) : all;
  return (
    <div>
      <PageHeader title="Our doctors" description="Choose a doctor to see fees and available times." />
      {specialities.length > 1 ? (
        <form method="get" className="mb-5 flex flex-wrap items-center gap-2">
          <label htmlFor="speciality" className="text-sm font-medium">
            Speciality
          </label>
          <select id="speciality" name="speciality" defaultValue={speciality ?? ""} className="rounded-lg border border-line bg-white px-3 py-2 text-sm">
            <option value="">All specialities</option>
            {specialities.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <button className="rounded-lg border border-line bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">Filter</button>
        </form>
      ) : null}
      {doctors.length === 0 ? (
        <EmptyState title="No doctors found" description={speciality ? "No doctors are listed under that speciality right now." : "Doctors will appear here once the clinic adds them."} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {doctors.map((d) => (
            <DoctorCard key={d.id} doctor={d} />
          ))}
        </div>
      )}
    </div>
  );
}
