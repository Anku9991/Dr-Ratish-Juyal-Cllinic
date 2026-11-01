"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname } from "next/navigation";

export function NavigationProgress() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [, startTransition] = useTransition();

  // Reset when route pathname changes
  useEffect(() => {
    setProgress(100);
    const timeout = setTimeout(() => {
      setLoading(false);
      setProgress(0);
    }, 200);
    return () => clearTimeout(timeout);
  }, [pathname]);

  // Intercept all internal anchor clicks for instant visual feedback
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest("a");
      if (!target) return;

      const href = target.getAttribute("href");
      const targetAttr = target.getAttribute("target");

      // Only handle internal links without new tab or download
      if (
        href &&
        href.startsWith("/") &&
        !href.startsWith("#") &&
        !href.startsWith("/api/") &&
        !target.hasAttribute("download") &&
        (!targetAttr || targetAttr === "_self")
      ) {
        if (href === pathname) return; // Same page

        startTransition(() => {
          setLoading(true);
          setProgress(25);
          setTimeout(() => setProgress((p) => (p < 80 ? 70 : p)), 100);
          setTimeout(() => setProgress((p) => (p < 90 ? 88 : p)), 300);
        });
      }
    };

    document.addEventListener("click", handleClick, { passive: true });
    return () => document.removeEventListener("click", handleClick);
  }, [pathname]);

  if (!loading && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed top-0 left-0 right-0 z-[9999] h-[3px] bg-transparent"
    >
      <div
        className="h-full bg-gradient-to-r from-brand-500 via-indigo-500 to-purple-600 transition-all duration-200 ease-out shadow-[0_0_8px_rgba(74,85,214,0.6)]"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
          transitionProperty: "width, opacity",
        }}
      />
    </div>
  );
}
