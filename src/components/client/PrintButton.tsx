"use client";

import { buttonStyles } from "../ui";

export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button type="button" className={buttonStyles.primary} onClick={() => window.print()}>
      {label}
    </button>
  );
}
