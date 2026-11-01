import type { Metadata } from "next";
import { getPublicClinic, clinicDisplayName } from "@/lib/clinic";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Terms of use" };

export default async function TermsPage() {
  const name = clinicDisplayName(await getPublicClinic());
  return (
    <article className="max-w-2xl space-y-4 text-sm leading-6">
      <PageHeader title="Terms of use" description="Template text. The clinic must have it reviewed by a lawyer before go-live." />
      <h2 className="text-base font-semibold">Booking and payment</h2>
      <p>An appointment with {name} is confirmed only after your payment has been verified. A time slot is held for a short period while you pay; if payment is not completed the slot is released.</p>
      <h2 className="text-base font-semibold">Cancellation and refunds</h2>
      <p>You may cancel from your appointments page. Cancellations made outside the clinic&apos;s cancellation window are refunded in full to the original payment method. Cancellations inside the window may not be refunded. If the clinic cancels, you are refunded in full. Refunds normally reach your account in 5 to 7 working days.</p>
      <h2 className="text-base font-semibold">Medical advice</h2>
      <p>Online booking does not replace emergency care. Prescriptions are issued only by the consulting doctor after a consultation. This website does not provide automated diagnosis or medicine suggestions.</p>
      <h2 className="text-base font-semibold">Your account</h2>
      <p>Keep your password private and give the clinic accurate details. The clinic may suspend accounts that are misused.</p>
    </article>
  );
}
