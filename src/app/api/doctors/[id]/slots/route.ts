import { NextResponse } from "next/server";
import { route, uuidParam } from "@/lib/api";
import { slotsQuerySchema } from "@/lib/validation";
import { getSlotsForDoctor } from "@/lib/availability";
import { HttpError } from "@/lib/errors";

export const GET = route({ limit: { name: "slots", max: 90, windowMs: 60_000 } }, async ({ req, params }) => {
  const doctorId = uuidParam(params, "id");
  const q = slotsQuerySchema.safeParse({ date: req.nextUrl.searchParams.get("date") });
  if (!q.success) throw new HttpError(422, "invalid_date", "Choose a valid date.");
  const result = await getSlotsForDoctor(doctorId, q.data.date);
  const res = NextResponse.json(result);
  res.headers.set("Cache-Control", "no-store");
  return res;
});
