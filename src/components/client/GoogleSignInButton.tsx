"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { Alert } from "../ui";

export function GoogleSignInButton({ label = "Continue with Google" }: { label?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? undefined;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRedirectOption, setShowRedirectOption] = useState(false);

  // Exchange Firebase user with Next.js server to create HTTP-only session cookie
  const exchangeUserWithServer = useCallback(
    async (user: User) => {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/auth/google-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken,
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          next,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.message || "Failed to establish server session");
      }

      router.replace(data.redirect || "/patient");
      router.refresh();
    },
    [next, router]
  );

  // Check if returning from a redirect sign-in
  useEffect(() => {
    let mounted = true;
    getRedirectResult(auth)
      .then(async (result) => {
        if (!mounted || !result || !result.user) return;
        setLoading(true);
        await exchangeUserWithServer(result.user);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        console.error("Redirect sign-in error:", err);
      });

    return () => {
      mounted = false;
    };
  }, [exchangeUserWithServer]);

  const handleGoogleSignIn = async (useRedirect = false) => {
    try {
      setLoading(true);
      setError(null);

      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      if (useRedirect) {
        await signInWithRedirect(auth, provider);
        return;
      }

      const result = await signInWithPopup(auth, provider);
      if (result && result.user) {
        await exchangeUserWithServer(result.user);
      }
    } catch (err: unknown) {
      setLoading(false);
      const msg = err instanceof Error ? err.message : String(err);

      if (msg.includes("auth/popup-closed-by-user")) {
        setError("Sign-in popup band kar diya gaya tha. Dobara try karein.");
        return;
      }

      if (msg.includes("auth/internal-error") || msg.includes("auth/configuration-not-found")) {
        setShowRedirectOption(true);
        setError(
          "Firebase Console Setup: Firebase Console me Authentication > Sign-in method me jakar 'Google' ko Enable karein aur Support Email select karke Save karein. Agar already enabled hai, to neeche Redirect button try karein."
        );
        return;
      }

      if (msg.includes("auth/unauthorized-domain")) {
        setError(
          "Unauthorized Domain: Firebase Console > Authentication > Settings > Authorized domains me apna domain add karein."
        );
        return;
      }

      if (msg.includes("auth/operation-not-allowed")) {
        setError(
          "Google provider disabled hai. Firebase Console > Authentication > Sign-in method > Google me jakar Enable karein."
        );
        return;
      }

      setShowRedirectOption(true);
      setError(msg || "Failed to sign in with Google.");
    }
  };

  return (
    <div className="space-y-3">
      {error ? (
        <div className="space-y-2">
          <Alert tone="danger">{error}</Alert>
          {showRedirectOption ? (
            <button
              type="button"
              onClick={() => handleGoogleSignIn(true)}
              className="text-xs text-brand-700 underline font-medium hover:text-brand-900 block"
            >
              Pop-up kaam nahi kar raha? Yahan click karke Full-Page Redirect se sign in karein →
            </button>
          ) : null}
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => handleGoogleSignIn(false)}
        disabled={loading}
        className="w-full flex items-center justify-center gap-3 rounded-xl border border-line bg-white hover:bg-slate-50 text-slate-800 font-semibold py-2.5 px-4 shadow-2xs hover:shadow-xs transition-all disabled:opacity-60 cursor-pointer"
      >
        <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span>{loading ? "Signing in..." : label}</span>
      </button>
    </div>
  );
}
