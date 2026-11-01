import { route, uuidParam } from "@/lib/api";
import { cancelSchema } from "@/lib/validation";
import { bookingDeps } from "@/lib/deps";
import { cancelAppointment } from "@/lib/payments";
import { getClinicSettings } from "@/lib/clinic";

export const POST = route(
  { roles: ["patient"], schema: cancelSchema, limit: { name: "cancel", max: 10, windowMs: 60_000, by: "user" } },
  async (ctx) => {
    const patientId = await ctx.patientId();
    const settings = await getClinicSettings();
    const outcome = await cancelAppointment(bookingDeps(), {
      appointmentId: uuidParam(ctx.params, "id"),
      actorUserId: ctx.user?.id ?? "",
      patientId,
      reason: ctx.body.reason,
      windowHours: settings.cancellation_window_hours,
    });
    return outcome;
  },
);
