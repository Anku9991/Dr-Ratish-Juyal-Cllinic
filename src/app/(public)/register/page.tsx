import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { RegisterForm } from "@/components/client/AuthForms";
import { Card } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/permissions";

export const metadata: Metadata = { title: "Create your account" };

export default async function RegisterPage() {
  const user = await getSessionUser();
  if (user) redirect(ROLE_HOME[user.role]);
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 text-2xl font-bold text-ink">Patient & Clinic Sign In</h1>
      <p className="mb-5 text-sm text-muted">Use 1-click Quick PIN access or enter your mobile number.</p>
      <Card>
        <RegisterForm />
      </Card>
    </div>
  );
}
