"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
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
        try {
          await signOut(auth).catch(() => {});
        } catch {}
        await api("/api/auth/logout", "POST", {});
        router.replace("/login");
        router.refresh();
      }}
      className="w-full rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-slate-100 cursor-pointer"
    >
      {busy ? "Signing out..." : "Sign out"}
    </button>
  );
}
