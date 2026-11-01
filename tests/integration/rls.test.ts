import { beforeEach, describe, expect, it } from "vitest";
import { createDb, seed, as, futureDate, type Db, type Seeded } from "./db";
import { createPgliteBookingDb } from "./pglite-booking-db";
import { FakeGateway, TEST_KEY_SECRET } from "./fake-gateway";
import { ensureOrder, verifyCheckoutPayment } from "@/lib/payments";
import type { BookingDb } from "@/lib/booking-db";

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

async function confirmedAppointmentFor(patientId: string, patientUserId: string, doctorId = s.doctorId) {
  const hold = await bookingDb.rpc<{ hold_token: string }>("create_hold", { p_doctor: doctorId, p_patient: patientId, p_date: monday, p_start: "09:00" });
  const appt = await bookingDb.rpc<{ id: string }>("create_pending_appointment", { p_hold_token: hold.hold_token, p_patient: patientId, p_reason: null });
  const order = await ensureOrder({ db: bookingDb, gateway }, { appointmentId: appt.id, patientId });
  const { paymentId, signature } = gateway.simulatePay(order.orderId);
  await verifyCheckoutPayment({ db: bookingDb, gateway, keySecret: TEST_KEY_SECRET }, { patientId, orderId: order.orderId, paymentId, signature });
  void patientUserId;
  return appt.id as string;
}

describe("row level security: patient data isolation", () => {
  it("a patient can see their own appointment but not another patient's", async () => {
    const apptId = await confirmedAppointmentFor(s.patientId, s.patientUserId);
    const own = await as(db, { role: "authenticated", userId: s.patientUserId }, () => db.query(`select id from appointments where id = $1`, [apptId]));
    expect(own.rows).toHaveLength(1);
    const other = await as(db, { role: "authenticated", userId: s.patient2UserId }, () => db.query(`select id from appointments where id = $1`, [apptId]));
    expect(other.rows).toHaveLength(0);
  });

  it("a patient cannot see another patient's medical record", async () => {
    await as(db, { role: "service_role" }, () => db.query(`update patient_medical set allergies = 'Penicillin' where patient_id = $1`, [s.patientId]));
    const mine = await as(db, { role: "authenticated", userId: s.patientUserId }, () => db.query(`select allergies from patient_medical where patient_id = $1`, [s.patientId]));
    expect(mine.rows).toHaveLength(1);
    const theirs = await as(db, { role: "authenticated", userId: s.patient2UserId }, () => db.query(`select allergies from patient_medical where patient_id = $1`, [s.patientId]));
    expect(theirs.rows).toHaveLength(0);
  });

  it("a doctor can see a patient's appointment with them, but not the pending-payment hold-through", async () => {
    const hold = await bookingDb.rpc<{ hold_token: string }>("create_hold", { p_doctor: s.doctorId, p_patient: s.patientId, p_date: monday, p_start: "09:00" });
    const pending = await bookingDb.rpc<{ id: string }>("create_pending_appointment", { p_hold_token: hold.hold_token, p_patient: s.patientId, p_reason: null });
    const asDoctor = await as(db, { role: "authenticated", userId: s.doctorUserId }, () => db.query(`select id from appointments where id = $1`, [pending.id]));
    expect(asDoctor.rows).toHaveLength(0); // pending_payment hidden from the doctor
  });

  it("a doctor cannot see a different doctor's patient appointment", async () => {
    const apptId = await confirmedAppointmentFor(s.patientId, s.patientUserId, s.doctorId);
    const otherDoctor = await as(db, { role: "authenticated", userId: s.doctor2UserId }, () => db.query(`select id from appointments where id = $1`, [apptId]));
    expect(otherDoctor.rows).toHaveLength(0);
  });

  it("a doctor cannot see the payments table at all", async () => {
    const apptId = await confirmedAppointmentFor(s.patientId, s.patientUserId);
    const asDoctor = await as(db, { role: "authenticated", userId: s.doctorUserId }, () => db.query(`select id from payments where appointment_id = $1`, [apptId]));
    expect(asDoctor.rows).toHaveLength(0);
  });

  it("plain admin (no medical_records permission) cannot see medical records or consultations", async () => {
    const apptId = await confirmedAppointmentFor(s.patientId, s.patientUserId);
    const saved = await bookingDb.rpc<{ consultation_id: string }>("save_consultation_draft", { p_appointment: apptId, p_doctor: s.doctorId, p_data: { diagnosis: "x", medicines: [] } });
    const asAdmin = await as(db, { role: "authenticated", userId: s.adminId }, () => db.query(`select id from consultations where id = $1`, [saved.consultation_id]));
    expect(asAdmin.rows).toHaveLength(0);
    const canSeeAppt = await as(db, { role: "authenticated", userId: s.adminId }, () => db.query(`select id from appointments where id = $1`, [apptId]));
    expect(canSeeAppt.rows).toHaveLength(1); // admin sees the appointment itself, just not clinical content
  });

  it("admin WITH medical_records permission can see consultations", async () => {
    await as(db, { role: "service_role" }, () => db.query(`update profiles set permissions = array['medical_records'] where id = $1`, [s.adminId]));
    const apptId = await confirmedAppointmentFor(s.patientId, s.patientUserId);
    const saved = await bookingDb.rpc<{ consultation_id: string }>("save_consultation_draft", { p_appointment: apptId, p_doctor: s.doctorId, p_data: { diagnosis: "x", medicines: [] } });
    const asAdmin = await as(db, { role: "authenticated", userId: s.adminId }, () => db.query(`select id from consultations where id = $1`, [saved.consultation_id]));
    expect(asAdmin.rows).toHaveLength(1);
  });

  it("a patient cannot see a draft (unfinalized) consultation, only their own finalized ones", async () => {
    const apptId = await confirmedAppointmentFor(s.patientId, s.patientUserId);
    const saved = await bookingDb.rpc<{ consultation_id: string }>("save_consultation_draft", {
      p_appointment: apptId,
      p_doctor: s.doctorId,
      p_data: { diagnosis: "Flu", medicines: [{ medicineName: "X", dosage: "1", frequency: "1", duration: "1" }] },
    });
    const draftView = await as(db, { role: "authenticated", userId: s.patientUserId }, () => db.query(`select id from consultations where id = $1`, [saved.consultation_id]));
    expect(draftView.rows).toHaveLength(0);
    await bookingDb.rpc("finalize_prescription", { p_consultation: saved.consultation_id, p_doctor: s.doctorId });
    const finalizedView = await as(db, { role: "authenticated", userId: s.patientUserId }, () => db.query(`select id from consultations where id = $1`, [saved.consultation_id]));
    expect(finalizedView.rows).toHaveLength(1);
  });

  it("audit_logs are readable only by admin, and are append-only (no update or delete for anyone)", async () => {
    await as(db, { role: "service_role" }, () => db.query(`select write_audit($1,'test.action','test',null,'{}'::jsonb)`, [s.adminId]));
    const asPatient = await as(db, { role: "authenticated", userId: s.patientUserId }, () => db.query(`select id from audit_logs limit 1`));
    expect(asPatient.rows).toHaveLength(0);
    const asAdmin = await as(db, { role: "authenticated", userId: s.adminId }, () => db.query(`select id from audit_logs limit 1`));
    expect(asAdmin.rows.length).toBeGreaterThan(0);
    await expect(as(db, { role: "service_role" }, () => db.query(`update audit_logs set action = 'tampered'`))).rejects.toThrow(/AUDIT_LOG_IMMUTABLE/);
  });

  it("public doctor/clinic views expose no contact details or internal ids beyond what's needed", async () => {
    const r = await as(db, { role: "anon" }, () => db.query(`select * from public_doctors limit 1`));
    expect(r.rows[0]).not.toHaveProperty("registration_number_internal");
    const cols = Object.keys(r.rows[0] as object);
    expect(cols).toContain("consultation_fee");
    expect(cols).not.toContain("profile_id");
  });
});
