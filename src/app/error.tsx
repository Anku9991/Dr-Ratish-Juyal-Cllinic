"use client";

import { buttonStyles } from "@/components/ui";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="main" className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="mt-2 text-sm text-muted">We could not load this page. Please try again. If the problem continues, contact the clinic.</p>
      <button type="button" onClick={reset} className={`${buttonStyles.primary} mt-6`}>
        Try again
      </button>
    </main>
  );
}
