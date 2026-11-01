"use client";

import { useEffect, useState } from "react";
import { Clock, Radio } from "lucide-react";

export function LiveOpdBadge() {
  const [isLive, setIsLive] = useState(false);
  const [timeStr, setTimeStr] = useState("");

  useEffect(() => {
    const checkOpdStatus = () => {
      const now = new Date();
      // Indian Standard Time (IST) offset +5:30
      const utc = now.getTime() + now.getTimezoneOffset() * 60000;
      const istTime = new Date(utc + 3600000 * 5.5);

      const hours = istTime.getHours();
      const day = istTime.getDay(); // 0 is Sunday, 1-6 Mon-Sat

      // OPD Timings: 12:00 PM (12) to 5:00 PM (17), Monday to Saturday
      const isOpdDay = day >= 1 && day <= 6;
      const isOpdHour = hours >= 12 && hours < 17;

      setIsLive(isOpdDay && isOpdHour);
      setTimeStr(
        now.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })
      );
    };

    checkOpdStatus();
    const interval = setInterval(checkOpdStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold shadow-2xs transition-all border">
      {isLive ? (
        <span className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border-emerald-200">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
          </span>
          <Radio className="h-3.5 w-3.5 text-emerald-600 animate-pulse" />
          <span>OPD IS LIVE NOW • Doctors In Consultation (12 PM - 5 PM)</span>
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-slate-700 bg-white border-slate-200">
          <Clock className="h-3.5 w-3.5 text-brand-600" />
          <span>Next OPD Session: 12:00 PM – 05:00 PM (Mon – Sat)</span>
          {timeStr ? <span className="text-muted ml-1">• IST {timeStr}</span> : null}
        </span>
      )}
    </div>
  );
}
