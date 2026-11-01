"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "./api";

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await api("/api/auth/logout", "POST", {});
        router.replace("/login");
        router.refresh();
      }}
      className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-slate-100"
    >
      {busy ? "Signing out..." : "Sign out"}
    </button>
  );
}
