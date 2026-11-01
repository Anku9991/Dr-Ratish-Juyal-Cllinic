"use client";

import { buttonStyles } from "@/components/ui";

export default function AdminError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-[14px] border border-line bg-white p-8 text-center">
      <h1 className="text-lg font-semibold">We could not load this page</h1>
      <p className="mt-1 text-sm text-muted">Please try again in a moment.</p>
      <button type="button" onClick={reset} className={`${buttonStyles.primary} mt-4`}>
        Try again
      </button>
    </div>
  );
}
