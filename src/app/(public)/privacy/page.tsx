import type { Metadata } from "next";
import { getPublicClinic, clinicDisplayName } from "@/lib/clinic";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Privacy policy" };

export default async function PrivacyPage() {
  const settings = await getPublicClinic();
  const name = clinicDisplayName(settings);
  return (
    <article className="max-w-2xl space-y-4 text-sm leading-6">
      <PageHeader title="Privacy policy" description="Template text. Have it reviewed against the Digital Personal Data Protection Act, 2023 and your state and professional rules before go-live." />
      <h2 className="text-base font-semibold">What we collect</h2>
      <p>{name} collects your name, email, mobile number, date of birth, gender, address and emergency contact, plus health information you or your doctor record: allergies, history, vitals, symptoms, diagnosis and prescriptions. Payments are handled by Razorpay; we never see or store your card or UPI details.</p>
      <h2 className="text-base font-semibold">Why we use it</h2>
      <p>To book and manage your appointments, take payment, provide care, issue prescriptions, meet legal and accounting duties, and keep the service secure.</p>
      <h2 className="text-base font-semibold">Who can see it</h2>
      <p>You can see your own records. A doctor can see only patients booked with them. Clinic administrators can see bookings and payments but cannot open clinical records unless the clinic has explicitly granted that access. Access to prescriptions is logged.</p>
      <h2 className="text-base font-semibold">How long we keep it</h2>
      <p>Medical records are kept for at least {settings.record_retention_years} years from the last consultation, or longer where the law requires. Audit and payment records are kept for accounting and legal purposes.</p>
      <h2 className="text-base font-semibold">Your rights</h2>
      <p>You may ask to access, correct or erase your personal data, and to withdraw consent, subject to records the clinic must legally retain. Contact the clinic using the details on the Contact page.</p>
    </article>
  );
}
