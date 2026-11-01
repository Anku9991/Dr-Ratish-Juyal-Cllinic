import { describe, expect, it } from "vitest";
import { generateSlots, findScheduleOverlap } from "@/lib/slots";
import { rupeesToPaise, paiseToRupees, formatINR } from "@/lib/money";
import { localToUtc, dateInTz, addDays, weekdayOf, toMinutes, fromMinutes, isValidDate, isValidTime, ageFromDob } from "@/lib/time";
import { canTransitionAppointment, canTransitionPayment } from "@/lib/status";
import { verifyCheckoutSignature, verifyWebhookSignature, parseWebhookEvent } from "@/lib/razorpay";
import crypto from "node:crypto";

const RULE = { weekday: 1, startTime: "09:00", endTime: "12:00", slotMinutes: 30 }; // Monday

describe("slot generation", () => {
  it("generates slots within the working window, none touching the boundary end", () => {
    const now = new Date("2026-01-01T00:00:00Z"); // Thu
    const { slots } = generateSlots({ date: "2026-01-05", tz: "Asia/Kolkata", now, rules: [RULE], horizonDays: 30 }); // next Monday
    expect(slots.map((s) => s.startTime)).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00", "11:30"]);
    expect(slots.every((s) => s.endTime <= "12:00")).toBe(true);
  });

  it("excludes past times on today", () => {
    const now = new Date("2026-01-05T05:00:00Z"); // 10:30 IST
    const { slots } = generateSlots({ date: "2026-01-05", tz: "Asia/Kolkata", now, rules: [RULE], horizonDays: 30 });
    expect(slots.every((s) => new Date(s.startsAt).getTime() > now.getTime())).toBe(true);
    expect(slots.find((s) => s.startTime === "09:00")).toBeUndefined();
  });

  it("excludes doctor leave and clinic holiday dates", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const leave = generateSlots({ date: "2026-01-05", tz: "Asia/Kolkata", now, rules: [RULE], leaveDates: ["2026-01-05"], horizonDays: 30 });
    expect(leave.slots).toHaveLength(0);
    expect(leave.reason).toBe("leave");
    const holiday = generateSlots({ date: "2026-01-05", tz: "Asia/Kolkata", now, rules: [RULE], holidayDates: ["2026-01-05"], horizonDays: 30 });
    expect(holiday.reason).toBe("holiday");
  });

  it("excludes already-taken slots and rejects dates beyond the horizon", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const taken = generateSlots({ date: "2026-01-05", tz: "Asia/Kolkata", now, rules: [RULE], unavailableStarts: new Set(["09:00"]), horizonDays: 30 });
    expect(taken.slots.find((s) => s.startTime === "09:00")).toBeUndefined();
    const far = generateSlots({ date: "2026-03-01", tz: "Asia/Kolkata", now, rules: [RULE], horizonDays: 30 });
    expect(far.reason).toBe("beyond_horizon");
  });

  it("detects overlapping schedule rules on the same weekday", () => {
    expect(findScheduleOverlap([RULE, { weekday: 1, startTime: "11:00", endTime: "13:00", slotMinutes: 30 }])).not.toBeNull();
    expect(findScheduleOverlap([RULE, { weekday: 2, startTime: "09:00", endTime: "12:00", slotMinutes: 30 }])).toBeNull();
  });
});

describe("timezone helpers", () => {
  it("converts clinic-local wall time to the correct UTC instant (IST = UTC+5:30)", () => {
    const d = localToUtc("2026-06-15", "09:00", "Asia/Kolkata");
    expect(d.toISOString()).toBe("2026-06-15T03:30:00.000Z");
  });

  it("round-trips dateInTz with the offset applied", () => {
    expect(dateInTz(new Date("2026-06-14T19:00:00Z"), "Asia/Kolkata")).toBe("2026-06-15");
  });

  it("addDays and weekdayOf are consistent", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(weekdayOf("2026-01-05")).toBe(1); // Monday
  });

  it("minutes conversions round-trip", () => {
    expect(fromMinutes(toMinutes("13:45"))).toBe("13:45");
  });

  it("validates date/time strings including impossible calendar dates", () => {
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2026-02-28")).toBe(true);
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidTime("23:59")).toBe(true);
  });

  it("computes age from date of birth", () => {
    expect(ageFromDob("2000-06-15", new Date("2026-06-14T00:00:00Z"))).toBe(25);
    expect(ageFromDob("2000-06-15", new Date("2026-06-15T00:00:00Z"))).toBe(26);
    expect(ageFromDob(null)).toBeNull();
  });
});

describe("money helpers", () => {
  it("converts rupees to paise exactly, no float drift", () => {
    expect(rupeesToPaise(500)).toBe(50000);
    expect(rupeesToPaise("700.50")).toBe(70050);
    expect(rupeesToPaise(19.99)).toBe(1999);
  });
  it("round-trips paise to rupees and formats INR", () => {
    expect(paiseToRupees(50000)).toBe(500);
    expect(formatINR(150050)).toContain("1,500.50");
  });
  it("rejects malformed amounts", () => {
    expect(() => rupeesToPaise("12.999")).toThrow();
  });
});

describe("status transitions", () => {
  it("allows only valid doctor transitions", () => {
    expect(canTransitionAppointment("confirmed", "checked_in", "doctor")).toBe(true);
    expect(canTransitionAppointment("confirmed", "completed", "doctor")).toBe(false); // must go through in_consultation + finalize
    expect(canTransitionAppointment("pending_payment", "confirmed", "patient")).toBe(false); // system-only
  });
  it("allows only valid payment transitions", () => {
    expect(canTransitionPayment("created", "captured")).toBe(true);
    expect(canTransitionPayment("refunded", "captured")).toBe(false);
    expect(canTransitionPayment("failed", "authorized")).toBe(true); // retry on same order
  });
});

describe("razorpay signature verification", () => {
  const secret = "test_secret";
  it("verifies a correctly signed checkout callback", () => {
    const sig = crypto.createHmac("sha256", secret).update("order_1|pay_1").digest("hex");
    expect(verifyCheckoutSignature("order_1", "pay_1", sig, secret)).toBe(true);
    expect(verifyCheckoutSignature("order_1", "pay_1", "bad", secret)).toBe(false);
    expect(verifyCheckoutSignature("order_2", "pay_1", sig, secret)).toBe(false);
  });
  it("verifies webhook body signatures", () => {
    const body = JSON.stringify({ event: "payment.captured" });
    const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
    expect(verifyWebhookSignature(body, sig, secret)).toBe(true);
    expect(verifyWebhookSignature(body, null, secret)).toBe(false);
    expect(verifyWebhookSignature(body + "x", sig, secret)).toBe(false);
  });
  it("parses known webhook events and ignores unknown ones", () => {
    const captured = parseWebhookEvent({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1", order_id: "order_1", amount: 50000, method: "upi" } } } });
    expect(captured).toEqual({ kind: "captured", orderId: "order_1", paymentId: "pay_1", amount: 50000, method: "upi" });
    expect(parseWebhookEvent({ event: "something.else" })).toEqual({ kind: "ignored", event: "something.else" });
  });
});
