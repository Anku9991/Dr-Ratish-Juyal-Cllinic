import { Suspense } from "react";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { LoginForm } from "@/components/client/AuthForms";
import { Card } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/permissions";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getSessionUser();
  if (user) redirect(ROLE_HOME[user.role]);
  return (
    <div className="mx-auto max-w-xl">
      <h1 className="mb-1 text-2xl font-bold text-ink">Sign in to Clinic Portal</h1>
      <p className="mb-5 text-sm text-muted">Select your portal or enter your 4-digit PIN for instant access.</p>
      <Card>
        <Suspense>
          <LoginForm />
        </Suspense>
      </Card>
    </div>
  );
}
