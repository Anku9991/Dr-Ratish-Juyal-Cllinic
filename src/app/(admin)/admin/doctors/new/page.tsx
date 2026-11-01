import type { Metadata } from "next";
import { requirePageRole } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";
import { NewDoctorForm } from "@/components/client/AdminDoctorForm";

export const metadata: Metadata = { title: "Add doctor" };

export default async function NewDoctorPage() {
  await requirePageRole("admin");
  return (
    <div className="max-w-2xl">
      <PageHeader title="Add doctor" description="Creates a doctor login. Share the temporary password securely; the doctor should change it after signing in." />
      <Card>
        <NewDoctorForm />
      </Card>
    </div>
  );
}
