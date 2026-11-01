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
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-2xl font-semibold">Sign in</h1>
      <p className="mb-5 text-sm text-muted">Patients, doctors and clinic staff sign in here.</p>
      <Card>
        <Suspense>
          <LoginForm />
        </Suspense>
      </Card>
    </div>
  );
}
