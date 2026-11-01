import { beforeEach, describe, expect, it } from "vitest";
import { createDb, seed, as, futureDate, type Db, type Seeded } from "./db";
import { createPgliteBookingDb } from "./pglite-booking-db";
import { FakeGateway, TEST_KEY_SECRET, TEST_WEBHOOK_SECRET } from "./fake-gateway";
import { ensureOrder, verifyCheckoutPayment, handleWebhook, cancelAppointment, refundPayment } from "@/lib/payments";
import type { BookingDb } from "@/lib/booking-db";
import { HttpError } from "@/lib/errors";

let db: Db;
let s: Seeded;
let bookingDb: BookingDb;
let gateway: FakeGateway;
let monday: string;

beforeEach(async () => {
  db = await createDb();
  s = await seed(db);
  bookingDb = createPgliteBookingDb(db);
  gateway = new FakeGateway();
  monday = await futureDate(db, 1, 3);
});

async function makeHold(doctorId = s.doctorId, patientId = s.patientId, startTime = "09:00") {
  return bookingDb.rpc<{ hold_token: string; expires_at: string }>("create_hold", { p_doctor: doctorId, p_patient: patientId, p_date: monday, p_start: startTime });
}

describe("slot holds and double booking", () => {
  it("creates a hold for a valid, bookable slot", async () => {
    const hold = await makeHold();
    expect(hold.hold_token).toBeTruthy();
  });

  it("rejects a hold on an already-held slot for a different patient", async () => {
    await makeHold(s.doctorId, s.patientId, "09:00");
    await expect(makeHold(s.doctorId, s.patient2Id, "09:00")).rejects.toThrow(/just taken/);
  });

  it("prevents double booking: two patients cannot both confirm the same slot", async () => {
    const h1 = await makeHold(s.doctorId, s.patientId, "09:30");
    const appt1 = await bookingDb.rpc<{ id: string }>("create_pending_appointment", { p_hold_token: h1.hold_token, p_patient: s.patientId, p_reason: null });
    // second patient cannot even get a hold on the now-pending slot
    await expect(makeHold(s.doctorId, s.patient2Id, "09:30")).rejects.toThrow(/just taken/);
    expect(appt1.id).toBeTruthy();
  });

  it("rejects a hold outside the doctor's schedule", async () => {
    await expect(makeHold(s.doctorId, s.patientId, "13:00")).rejects.toThrow(/not a bookable time/);
  });

  it("rejects a hold on a doctor leave day", async () => {
    await as(db, { role: "service_role" }, () => db.query(`insert into doctor_leaves (doctor_id, leave_date) values ($1,$2)`, [s.doctorId, monday]));
    await expect(makeHold()).rejects.toThrow(/not available on that date/);
  });

  it("rejects a hold on a clinic holiday", async () => {
    await as(db, { role: "service_role" }, () => db.query(`insert into clinic_holidays (holiday_date, name) values ($1,'Test Holiday')`, [monday]));
    await expect(makeHold()).rejects.toThrow(/clinic is closed/);
  });

  it("a new hold for the same patient releases their previous hold", async () => {
    await makeHold(s.doctorId, s.patientId, "09:00");
    await makeHold(s.doctorId, s.patientId, "09:30"); // should not throw
    const active = await as(db, { role: "service_role" }, () => db.query(`select count(*)::int as n from appointment_holds where patient_id = $1 and status = 'active'`, [s.patientId]));
    expect((active.rows[0] as { n: number }).n).toBe(1);
  });
});

describe("payment ordering and confirmation", () => {
  async function pendingAppt(startTime = "10:00") {
    const hold = await makeHold(s.doctorId, s.patientId, startTime);
    return bookingDb.rpc<{ id: string; appointment_number: string }>("create_pending_appointment", { p_hold_token: hold.hold_token, p_patient: s.patientId, p_reason: "Fever" });
  }

  it("creates an order for the doctor's exact fee, in paise, never trusting a client amount", async () => {
    const appt = await pendingAppt();
    const order = await ensureOrder({ db: bookingDb, gateway }, { appointmentId: appt.id, patientId: s.patientId });
    expect(order.amount).toBe(50000); // doctor fee is 500.00
    expect(order.currency).toBe("INR");
  });

  it("reuses an open order instead of creating a duplicate on retry", async () => {
    const appt = await pendingAppt();
    const o1 = await ensureOrder({ db: bookingDb, gateway }, { appointmentId: appt.id, patientId: s.patientId });
    const o2 = await ensureOrder({ db: bookingDb, gateway }, { appointmentId: appt.id, patientId: s.patientId });
    expect(o2.orderId).toBe(o1.orderId);
    expect(gateway.orders.size).toBe(1);
  });

  it("confirms the appointment only after a verified, signature-checked payment", async () => {
    const appt = await pendingAppt();
    const order = await ensureOrder({ db: bookingDb, gateway }, { appointmentId: appt.id, patientId: s.patientId });
    const { paymentId, signature } = gateway.simulatePay(order.orderId);

    const before = await as(db, { role: "service_role" }, () => db.query(`select status from appointments where id = $1`, [appt.id]));
    expect((before.rows[0] as { status: string }).status).toBe("pending_payment");

    const result = await verifyCheckoutPayment(
      { db: bookingDb, gateway, keySecret: TEST_KEY_SECRET },
      { patientId: s.patientId, orderId: order.orderId, paymentId, signature },
    );
    expect(result.result).toBe("confirmed");
    const after = await as(db, { role: "service_role" }, () => db.query(`select status from appointments where id = $1`, [appt.id]));
    expect((after.rows[0] as { status: string }).status).toBe("confirmed");
  });

  it("rejects verification with a tampered signature", async () => {
    const appt = await pendingAppt();
    const order = await ensureOrder({ db: bookingDb, gateway }, { appointmentId: appt.id, patientId: s.patientId });
    const { paymentId } = gateway.simulatePay(order.orderId);
    await expect(
      verifyCheckoutPayment({ db: bookingDb, gateway, keySecret: TEST_KEY_SECRET }, { patientId: s.patientId, orderId: order.orderId, paymentId, signature: "forged" }),
    ).rejects.toThrow(HttpError);
  });

  it("is idempotent: confirming the same payment twice does not error and stays confirmed", async () => {
    const appt = await pendingAppt();
    const order = await ensureOrder({ db: bookingDb, gateway }, { appointmentId: appt.id, patientId: s.patientId });
    const { paymentId, signature } = gateway.simulatePay(order.orderId);
    const first = await verifyCheckoutPayment({ db: bookingDb, gateway, keySecret: TEST_KEY_SECRET }, { patientId: s.patientId, orderId: order.orderId, paymentId, signature });
    const second = await verifyCheckoutPayment({ db: bookingDb, gateway, keySecret: TEST_KEY_SECRET }, { patientId: s.patientId, orderId: order.orderId, paymentId, signature });
    expect(first.result).toBe("confirmed");
    expect(second.result).toBe("already_confirmed");
  });

  it("a failed payment can be retried on the same order", async () => {
    const appt = await pendingAppt();
    const order = await ensureOrder({ db: bookingDb, gateway }, { appointmentId: appt.id, patientId: s.patientId });
    await bookingDb.rpc("fail_payment", { p_order_id: order.orderId, p_reason: "Card declined" });
    const retryOrder = await ensureOrder({ db: bookingDb, gateway }, { appointmentId: appt.id, patientId: s.patientId });
    expect(retryOrder.orderId).toBe(order.orderId); // same order reused, not superseded (same amount)
  });
});

describe("webhook processing", () => {
  async function confirmedAppt() {
    const hold = await makeHold();
    const appt = await bookingDb.rpc<{ id: string }>("create_pending_appointment", { p_hold_token: hold.hold_token, p_patient: s.patientId, p_reason: null });
    const order = await ensureOrder({ db: bookingDb, gateway }, { appointmentId: appt.id, patientId: s.patientId });
    return { appt, order };
  }

  it("confirms an appointment from a verified payment.captured webhook", async () => {
    const { appt, order } = await confirmedAppt();
    const { paymentId } = gateway.simulatePay(order.orderId);
    const { rawBody, signature } = gateway.webhookFor("payment.captured", { payment: { entity: { id: paymentId, order_id: order.orderId, amount: order.amount, method: "upi" } } });
    const outcome = await handleWebhook({ db: bookingDb, webhookSecret: TEST_WEBHOOK_SECRET }, { rawBody, signature, eventId: "evt_1" });
    expect(outcome.duplicate).toBe(false);
    expect(outcome.result).toBe("confirmed");
    const after = await as(db, { role: "service_role" }, () => db.query(`select status from appointments where id = $1`, [appt.id]));
    expect((after.rows[0] as { status: string }).status).toBe("confirmed");
  });

  it("rejects a webhook with an invalid signature", async () => {
    const { order } = await confirmedAppt();
    const { paymentId } = gateway.simulatePay(order.orderId);
    const rawBody = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: paymentId, order_id: order.orderId, amount: order.amount } } } });
    await expect(handleWebhook({ db: bookingDb, webhookSecret: TEST_WEBHOOK_SECRET }, { rawBody, signature: "bad-signature", eventId: "evt_x" })).rejects.toThrow(HttpError);
  });

  it("processes a duplicate webhook delivery idempotently (same event id, same amount)", async () => {
    const { order } = await confirmedAppt();
    const { paymentId } = gateway.simulatePay(order.orderId);
    const { rawBody, signature } = gateway.webhookFor("payment.captured", { payment: { entity: { id: paymentId, order_id: order.orderId, amount: order.amount, method: "upi" } } });
    const first = await handleWebhook({ db: bookingDb, webhookSecret: TEST_WEBHOOK_SECRET }, { rawBody, signature, eventId: "evt_dup" });
    const second = await handleWebhook({ db: bookingDb, webhookSecret: TEST_WEBHOOK_SECRET }, { rawBody, signature, eventId: "evt_dup" });
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
  });

  it("marks payment failed on a payment.failed webhook", async () => {
    const { order } = await confirmedAppt();
    const { rawBody, signature } = gateway.webhookFor("payment.failed", { payment: { entity: { order_id: order.orderId, error_description: "Insufficient funds" } } });
    const outcome = await handleWebhook({ db: bookingDb, webhookSecret: TEST_WEBHOOK_SECRET }, { rawBody, signature, eventId: "evt_fail" });
    expect(outcome.result).toBe("failed");
    const p = await as(db, { role: "service_role" }, () => db.query(`select status from payments where razorpay_order_id = $1`, [order.orderId]));
    expect((p.rows[0] as { status: string }).status).toBe("failed");
  });
});

describe("cancellation and refunds", () => {
  async function confirmedPaidAppt(startTime = "09:00") {
    const hold = await makeHold(s.doctorId, s.patientId, startTime);
    const appt = await bookingDb.rpc<{ id: string }>("create_pending_appointment", { p_hold_token: hold.hold_token, p_patient: s.patientId, p_reason: null });
    const order = await ensureOrder({ db: bookingDb, gateway }, { appointmentId: appt.id, patientId: s.patientId });
    const { paymentId, signature } = gateway.simulatePay(order.orderId);
    await verifyCheckoutPayment({ db: bookingDb, gateway, keySecret: TEST_KEY_SECRET }, { patientId: s.patientId, orderId: order.orderId, paymentId, signature });
    return appt;
  }

  it("refunds in full when cancelling outside the cancellation window", async () => {
    const appt = await confirmedPaidAppt();
    const outcome = await cancelAppointment({ db: bookingDb, gateway }, { appointmentId: appt.id, actorUserId: s.patientUserId, patientId: s.patientId, reason: "Change of plan", windowHours: 24 });
    expect(outcome.refund).toBe("refunded");
    const p = await as(db, { role: "service_role" }, () => db.query(`select status, refunded_amount from payments where appointment_id = $1`, [appt.id]));
    const row = p.rows[0] as { status: string; refunded_amount: number };
    expect(row.status).toBe("refunded");
    expect(row.refunded_amount).toBe(50000);
  });

  it("does not refund when cancelling inside the cancellation window", async () => {
    const appt = await confirmedPaidAppt();
    const outcome = await cancelAppointment({ db: bookingDb, gateway }, { appointmentId: appt.id, actorUserId: s.patientUserId, patientId: s.patientId, reason: "Last minute", windowHours: 100000 });
    expect(outcome.refund).toBe("not_eligible");
    const p = await as(db, { role: "service_role" }, () => db.query(`select status from payments where appointment_id = $1`, [appt.id]));
    expect((p.rows[0] as { status: string }).status).toBe("captured");
  });

  it("a patient cannot cancel another patient's appointment", async () => {
    const appt = await confirmedPaidAppt();
    await expect(
      cancelAppointment({ db: bookingDb, gateway }, { appointmentId: appt.id, actorUserId: s.patient2UserId, patientId: s.patient2Id, reason: null, windowHours: 24 }),
    ).rejects.toThrow(HttpError);
  });

  it("admin partial refund cannot exceed the refundable balance", async () => {
    const appt = await confirmedPaidAppt();
    const payment = await bookingDb.paymentsForAppointment(appt.id);
    await refundPayment({ db: bookingDb, gateway }, { paymentId: payment[0]!.id, amountPaise: 20000, reason: "Goodwill", actorId: s.adminId });
    await expect(refundPayment({ db: bookingDb, gateway }, { paymentId: payment[0]!.id, amountPaise: 40000, reason: "Too much", actorId: s.adminId })).rejects.toThrow(/exceeds the refundable balance/);
  });
});

describe("consultation and prescription lifecycle", () => {
  async function checkedInAppointment() {
    const hold = await makeHold();
    const appt = await bookingDb.rpc<{ id: string }>("create_pending_appointment", { p_hold_token: hold.hold_token, p_patient: s.patientId, p_reason: null });
    const order = await ensureOrder({ db: bookingDb, gateway }, { appointmentId: appt.id, patientId: s.patientId });
    const { paymentId, signature } = gateway.simulatePay(order.orderId);
    await verifyCheckoutPayment({ db: bookingDb, gateway, keySecret: TEST_KEY_SECRET }, { patientId: s.patientId, orderId: order.orderId, paymentId, signature });
    return appt;
  }

  it("finalizing requires a diagnosis and at least one medicine", async () => {
    const appt = await checkedInAppointment();
    const saved = await bookingDb.rpc<{ consultation_id: string }>("save_consultation_draft", { p_appointment: appt.id, p_doctor: s.doctorId, p_data: { symptoms: "Fever" } });
    await expect(bookingDb.rpc("finalize_prescription", { p_consultation: saved.consultation_id, p_doctor: s.doctorId })).rejects.toThrow(/diagnosis is required/);
  });

  it("finalizes a prescription and completes the appointment", async () => {
    const appt = await checkedInAppointment();
    const saved = await bookingDb.rpc<{ consultation_id: string }>("save_consultation_draft", {
      p_appointment: appt.id,
      p_doctor: s.doctorId,
      p_data: { diagnosis: "Viral fever", medicines: [{ medicineName: "Paracetamol", dosage: "1-0-1", frequency: "Twice daily", duration: "3 days" }] },
    });
    const rx = await bookingDb.rpc<{ id: string; prescription_number: string; status: string }>("finalize_prescription", { p_consultation: saved.consultation_id, p_doctor: s.doctorId });
    expect(rx.prescription_number).toMatch(/^RX/);
    const apptRow = await as(db, { role: "service_role" }, () => db.query(`select status from appointments where id = $1`, [appt.id]));
    expect((apptRow.rows[0] as { status: string }).status).toBe("completed");
  });

  it("an issued prescription cannot be edited directly (immutability trigger)", async () => {
    const appt = await checkedInAppointment();
    const saved = await bookingDb.rpc<{ consultation_id: string }>("save_consultation_draft", {
      p_appointment: appt.id,
      p_doctor: s.doctorId,
      p_data: { diagnosis: "Migraine", medicines: [{ medicineName: "Ibuprofen", dosage: "1", frequency: "Once", duration: "1 day" }] },
    });
    const rx = await bookingDb.rpc<{ id: string }>("finalize_prescription", { p_consultation: saved.consultation_id, p_doctor: s.doctorId });
    await expect(
      as(db, { role: "service_role" }, () => db.query(`update prescriptions set status_reason = 'hacked' where id = $1`, [rx.id])),
    ).rejects.toThrow(/PRESCRIPTION_IMMUTABLE/);
  });

  it("amending an issued prescription creates a new editable draft and keeps the original as amended", async () => {
    const appt = await checkedInAppointment();
    const saved = await bookingDb.rpc<{ consultation_id: string }>("save_consultation_draft", {
      p_appointment: appt.id,
      p_doctor: s.doctorId,
      p_data: { diagnosis: "Cold", medicines: [{ medicineName: "Cetirizine", dosage: "1", frequency: "Nightly", duration: "5 days" }] },
    });
    const rx = await bookingDb.rpc<{ id: string }>("finalize_prescription", { p_consultation: saved.consultation_id, p_doctor: s.doctorId });
    const newDraftId = await bookingDb.rpc<string>("amend_prescription", { p_prescription: rx.id, p_doctor: s.doctorId, p_reason: "Dosage correction needed" });
    expect(newDraftId).not.toBe(rx.id);
    const orig = await as(db, { role: "service_role" }, () => db.query(`select status from prescriptions where id = $1`, [rx.id]));
    expect((orig.rows[0] as { status: string }).status).toBe("amended");
    const fresh = await as(db, { role: "service_role" }, () => db.query(`select status from prescriptions where id = $1`, [newDraftId]));
    expect((fresh.rows[0] as { status: string }).status).toBe("draft");
  });

  it("a doctor cannot finalize a consultation for another doctor's appointment", async () => {
    const appt = await checkedInAppointment();
    const saved = await bookingDb.rpc<{ consultation_id: string }>("save_consultation_draft", { p_appointment: appt.id, p_doctor: s.doctorId, p_data: { diagnosis: "x", medicines: [{ medicineName: "A", dosage: "1", frequency: "1", duration: "1" }] } });
    await expect(bookingDb.rpc("finalize_prescription", { p_consultation: saved.consultation_id, p_doctor: s.doctor2Id })).rejects.toThrow(/[Cc]onsultation not found/);
  });
});
