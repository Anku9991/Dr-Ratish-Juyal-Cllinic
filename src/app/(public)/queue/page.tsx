"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brain, Clock, Volume2, ArrowLeft } from "lucide-react";

interface QueueToken {
  token: number;
  patientName: string;
  doctorName: string;
  cabin: string;
  status: "in_consultation" | "waiting";
  time: string;
}

const INITIAL_QUEUE: QueueToken[] = [
  {
    token: 101,
    patientName: "Rajesh Kumar",
    doctorName: "Dr. Ratish Juyal",
    cabin: "Cabin 1 (Neurology)",
    status: "in_consultation",
    time: "12:15 PM",
  },
  {
    token: 102,
    patientName: "Sunita Verma",
    doctorName: "Dr. Amit Sharma",
    cabin: "Cabin 2 (Physiotherapy)",
    status: "in_consultation",
    time: "12:20 PM",
  },
  {
    token: 103,
    patientName: "Mohd. Asif",
    doctorName: "Dr. Ratish Juyal",
    cabin: "Cabin 1 (Neurology)",
    status: "waiting",
    time: "12:35 PM",
  },
  {
    token: 104,
    patientName: "Geeta Devi",
    doctorName: "Dr. Ratish Juyal",
    cabin: "Cabin 1 (Neurology)",
    status: "waiting",
    time: "12:50 PM",
  },
  {
    token: 105,
    patientName: "Rameshwar Singh",
    doctorName: "Dr. Amit Sharma",
    cabin: "Cabin 2 (Physiotherapy)",
    status: "waiting",
    time: "01:00 PM",
  },
  {
    token: 106,
    patientName: "Pooja Srivastava",
    doctorName: "Dr. Ratish Juyal",
    cabin: "Cabin 1 (Neurology)",
    status: "waiting",
    time: "01:15 PM",
  },
];

export default function WaitingRoomQueuePage() {
  const [clock, setClock] = useState("");
  const [dateStr, setDateStr] = useState("");
  const [queue] = useState<QueueToken[]>(INITIAL_QUEUE);
  const [soundEnabled, setSoundEnabled] = useState(false);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true }));
      setDateStr(now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const currentlyInside = queue.filter((q) => q.status === "in_consultation");
  const waitingNext = queue.filter((q) => q.status === "waiting");

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans select-none">
      {/* Top TV Header */}
      <header className="border-b border-slate-800 bg-slate-900/90 px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-slate-400 hover:text-white p-2 rounded-lg bg-slate-800/80">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-600 text-white shadow-lg">
            <Brain className="h-7 w-7" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Dr. Ratish Juyal Neuro & Spine Clinic
            </h1>
            <p className="text-xs text-purple-300 font-medium">
              OPD Waiting Room Live Queue Display • LDA Colony / Aashiyana, Lucknow
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              soundEnabled ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" : "bg-slate-800 text-slate-400 border-slate-700"
            }`}
          >
            <Volume2 className="h-4 w-4" />
            <span>{soundEnabled ? "Audio Announce ON" : "Audio Muted"}</span>
          </button>

          <div className="text-right">
            <div className="text-2xl sm:text-3xl font-mono font-bold text-emerald-400 tracking-wider">
              {clock || "12:00:00 PM"}
            </div>
            <div className="text-xs text-slate-400 font-medium">{dateStr}</div>
          </div>
        </div>
      </header>

      {/* Main TV Screen Content */}
      <main className="flex-1 p-6 grid gap-6 lg:grid-cols-12">
        {/* Left Column: Currently Inside Doctor Cabins */}
        <section className="lg:col-span-5 flex flex-col gap-4">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-emerald-400">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
            <span>Currently In Consultation</span>
          </div>

          <div className="space-y-4 flex-1">
            {currentlyInside.map((item) => (
              <div
                key={item.token}
                className="rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-br from-slate-900 to-emerald-950/40 p-6 shadow-xl relative overflow-hidden"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {item.cabin}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">Started: {item.time}</span>
                </div>

                <div className="mt-4 flex items-baseline gap-4">
                  <span className="text-5xl sm:text-6xl font-black font-mono text-emerald-400">
                    #{item.token}
                  </span>
                  <div>
                    <h3 className="text-2xl font-bold text-white">{item.patientName}</h3>
                    <p className="text-sm text-purple-300 font-medium mt-0.5">{item.doctorName}</p>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800 text-xs text-emerald-300/80 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Doctor is currently reviewing medical history & prescription</span>
                </div>
              </div>
            ))}
          </div>

          {/* OPD Notice Card */}
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400 space-y-1.5">
            <p className="text-white font-semibold">ℹ️ Patient Instructions:</p>
            <p>1. Please keep your previous prescriptions, MRI/CT scans and blood test files ready.</p>
            <p>2. Please silence mobile phones when entering the doctor consultation cabin.</p>
            <p>3. OPD Timings: 12:00 PM to 05:00 PM (Monday to Saturday).</p>
          </div>
        </section>

        {/* Right Column: Next Patients In Waiting Queue */}
        <section className="lg:col-span-7 flex flex-col gap-4">
          <div className="flex items-center justify-between text-sm font-bold uppercase tracking-wider text-purple-400">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span>Next In Line (Waiting Queue)</span>
            </div>
            <span className="text-xs text-slate-400 font-normal">
              Average consultation: 15-20 mins
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 flex-1">
            {waitingNext.map((item, idx) => (
              <div
                key={item.token}
                className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 flex flex-col justify-between hover:border-slate-700 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-purple-400">
                      Token #{item.token}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      Position #{idx + 1}
                    </span>
                  </div>
                  <h4 className="text-lg font-bold text-white mt-2">{item.patientName}</h4>
                  <p className="text-xs text-slate-400 mt-1">{item.doctorName}</p>
                </div>

                <div className="mt-4 pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                  <span>{item.cabin}</span>
                  <span className="font-mono text-purple-300 font-medium">Est. {item.time}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* Footer Ticker */}
      <footer className="border-t border-slate-800 bg-slate-900/90 px-6 py-2.5 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span>Real-time Token System Active • In-house Neuro-Physiotherapy & Digital Prescription Sync</span>
        </div>
        <div className="flex items-center gap-4 text-purple-300 font-medium">
          <span>Dr. Ratish Juyal (DM Neurology, KGMU)</span>
          <span>•</span>
          <span>Dr. Amit K. Sharma (MPT Neuro)</span>
        </div>
      </footer>
    </div>
  );
}
