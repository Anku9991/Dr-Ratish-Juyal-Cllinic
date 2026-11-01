import type { Metadata } from "next";
import { requirePageRole } from "@/lib/auth";
import { getClinicSettings } from "@/lib/clinic";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { Card, PageHeader } from "@/components/ui";
import { ClinicSettingsForm } from "@/components/client/ClinicSettingsForm";
import { HolidayManager } from "@/components/client/HolidayManager";
import { LogoUpload } from "@/components/client/LogoUpload";

export const metadata: Metadata = { title: "Clinic settings" };

export default async function AdminSettingsPage() {
  await requirePageRole("admin");
  const settings = await getClinicSettings();
  const { data: holidays } = await supabaseAdmin().from("clinic_holidays").select("id, holiday_date, name").gte("holiday_date", new Date().toISOString().slice(0, 10)).order("holiday_date");

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Clinic settings" description="These details appear on the public site, receipts and prescription PDFs." />
      <Card>
        <ClinicSettingsForm
          initial={{
            clinicName: settings.clinic_name ?? "",
            address: settings.address ?? "",
            phone: settings.phone ?? "",
            email: settings.email ?? "",
            prescriptionFooter: settings.prescription_footer ?? "",
            timezone: settings.timezone,
            cancellationWindowHours: settings.cancellation_window_hours,
            slotHoldMinutes: settings.slot_hold_minutes,
            bookingHorizonDays: settings.booking_horizon_days,
            recordRetentionYears: settings.record_retention_years,
          }}
        />
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Clinic logo</h2>
        <LogoUpload hasLogo={Boolean(settings.logo_storage_path)} />
      </Card>
      <Card>
        <h2 className="mb-3 font-semibold">Holidays</h2>
        <HolidayManager rows={(holidays ?? []) as never} />
      </Card>
    </div>
  );
}

