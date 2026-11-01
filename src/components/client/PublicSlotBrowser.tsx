"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SlotPicker } from "./SlotPicker";

export function PublicSlotBrowser({ doctorId, today, horizonDays }: { doctorId: string; today: string; horizonDays: number }) {
  const router = useRouter();
  const [date, setDate] = useState<string | null>(null);
  return (
    <SlotPicker
      doctorId={doctorId}
      today={today}
      horizonDays={horizonDays}
      date={date}
      time={null}
      onSelect={(d, t) => {
        setDate(d);
        if (t) router.push(`/patient/book/${doctorId}?date=${d}&time=${t}`);
      }}
    />
  );
}
