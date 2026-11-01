import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Dr. Ratish Juyal Neuro & Spine Clinic, Lucknow",
    template: "%s | Dr. Ratish Juyal Clinic",
  },
  description: "Senior Consultant Neurologist & Neuro-Physiotherapist in Lucknow. OPD Timings 12 PM - 5 PM. Online appointments, secure consultation & digital prescription pad.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#3a44c2" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-IN">
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
