import { DR_RATISH_JUYAL_ID, PHYSIOTHERAPIST_ID } from "./firebase/data";
import type { ApptWithDoctor } from "./queries";
import type { DoctorAppointmentRow } from "./doctor-queries";
import type { AppointmentStatus } from "./status";

export type PaymentMethod = "cash" | "card" | "razorpay";

export interface ClinicAppointment {
  id: string;
  appointment_number: string;
  token_number: number;
  patient_id: string;
  patient_name: string;
  patient_phone: string;
  patient_code: string;
  doctor_id: string;
  doctor_name: string;
  speciality: string;
  consultation_fee: number;
  appointment_date: string;
  start_time: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  payment_method: PaymentMethod;
  payment_status: "captured" | "pending_at_counter" | "pending_payment";
  receipt_number: string;
  reason: string | null;
  cancel_reason?: string | null;
  cabin: string;
  created_at: string;
}

// Pre-seeded demo appointments so queue & dashboards are always populated and live
const initialAppointments: ClinicAppointment[] = [
  {
    id: "a101-7b9a-4c3d-8f9b-0c2d3e4f5a6b",
    appointment_number: "RJ-202611-101",
    token_number: 101,
    patient_id: "patient-rajesh",
    patient_name: "Rajesh Kumar",
    patient_phone: "9876543210",
    patient_code: "P-1001",
    doctor_id: DR_RATISH_JUYAL_ID,
    doctor_name: "Dr. Ratish Juyal",
    speciality: "Senior Consultant Neurologist",
    consultation_fee: 1000,
    appointment_date: new Date().toISOString().slice(0, 10),
    start_time: "12:00",
    starts_at: `${new Date().toISOString().slice(0, 10)}T12:00:00+05:30`,
    ends_at: `${new Date().toISOString().slice(0, 10)}T12:20:00+05:30`,
    status: "in_consultation",
    payment_method: "cash",
    payment_status: "captured",
    receipt_number: "RCP-1001",
    reason: "Chronic migraine and morning cluster headache",
    cabin: "Cabin 1 (Neurology OPD)",
    created_at: new Date().toISOString(),
  },
  {
    id: "a102-7b9a-4c3d-8f9b-0c2d3e4f5a6c",
    appointment_number: "RJ-202611-102",
    token_number: 102,
    patient_id: "patient-sunita",
    patient_name: "Sunita Verma",
    patient_phone: "9876543211",
    patient_code: "P-1002",
    doctor_id: DR_RATISH_JUYAL_ID,
    doctor_name: "Dr. Ratish Juyal",
    speciality: "Senior Consultant Neurologist",
    consultation_fee: 1000,
    appointment_date: new Date().toISOString().slice(0, 10),
    start_time: "12:30",
    starts_at: `${new Date().toISOString().slice(0, 10)}T12:30:00+05:30`,
    ends_at: `${new Date().toISOString().slice(0, 10)}T12:50:00+05:30`,
    status: "confirmed",
    payment_method: "cash",
    payment_status: "pending_at_counter",
    receipt_number: "RCP-1002",
    reason: "Post-stroke follow up consultation & reflex assessment",
    cabin: "Cabin 1 (Neurology OPD)",
    created_at: new Date().toISOString(),
  },
  {
    id: "a103-8c0b-4f2b-9a0c-1d3e4f5a6b7c",
    appointment_number: "RJ-202611-103",
    token_number: 103,
    patient_id: "patient-mohit",
    patient_name: "Mohit Srivastava",
    patient_phone: "9876543212",
    patient_code: "P-1003",
    doctor_id: PHYSIOTHERAPIST_ID,
    doctor_name: "Dr. Amit K. Sharma (PT)",
    speciality: "Consultant Neuro-Physiotherapist",
    consultation_fee: 500,
    appointment_date: new Date().toISOString().slice(0, 10),
    start_time: "12:15",
    starts_at: `${new Date().toISOString().slice(0, 10)}T12:15:00+05:30`,
    ends_at: `${new Date().toISOString().slice(0, 10)}T12:45:00+05:30`,
    status: "in_consultation",
    payment_method: "razorpay",
    payment_status: "captured",
    receipt_number: "RCP-1003",
    reason: "Cervical radiculopathy & shoulder mobility physiotherapy",
    cabin: "Cabin 2 (Physiotherapy Rehab)",
    created_at: new Date().toISOString(),
  },
];

// In-memory appointments storage
class ClinicStore {
  private appointments: ClinicAppointment[] = [...initialAppointments];
  private nextToken = 104;

  public createAppointment(input: {
    doctorId: string;
    doctorName?: string;
    speciality?: string;
    patientId: string;
    patientName?: string;
    patientPhone?: string;
    date: string;
    startTime: string;
    reason?: string | null;
    paymentMethod: PaymentMethod;
  }) {
    // Check for double booking collision
    const conflict = this.appointments.find(
      (a) =>
        a.doctor_id === input.doctorId &&
        a.appointment_date === input.date &&
        a.start_time === input.startTime &&
        !["cancelled", "expired"].includes(a.status)
    );
    if (conflict) {
      throw new Error("This slot has already been booked. Please choose another time.");
    }

    const isNeuro = input.doctorId === DR_RATISH_JUYAL_ID;
    const docName = input.doctorName || (isNeuro ? "Dr. Ratish Juyal" : "Dr. Amit K. Sharma (PT)");
    const spec = input.speciality || (isNeuro ? "Senior Consultant Neurologist" : "Consultant Neuro-Physiotherapist");
    const fee = isNeuro ? 1000 : 500;
    const cabin = isNeuro ? "Cabin 1 (Neurology OPD)" : "Cabin 2 (Physiotherapy Rehab)";

    // Duration in minutes
    const duration = isNeuro ? 20 : 30;
    const [h, m] = input.startTime.split(":").map(Number);
    const endMinutes = (m || 0) + duration;
    const endH = (h ?? 12) + Math.floor(endMinutes / 60);
    const endM = endMinutes % 60;
    const endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

    const token = this.nextToken++;
    const id = crypto.randomUUID();
    const apptNum = `RJ-${input.date.replace(/-/g, "").slice(0, 6)}-${token}`;
    const receiptNum = `RCP-${token}`;

    const newAppt: ClinicAppointment = {
      id,
      appointment_number: apptNum,
      token_number: token,
      patient_id: input.patientId,
      patient_name: input.patientName || "Clinic Patient",
      patient_phone: input.patientPhone || "+91 94530 25888",
      patient_code: `P-${token}`,
      doctor_id: input.doctorId,
      doctor_name: docName,
      speciality: spec,
      consultation_fee: fee,
      appointment_date: input.date,
      start_time: input.startTime,
      starts_at: `${input.date}T${input.startTime}:00+05:30`,
      ends_at: `${input.date}T${endTime}:00+05:30`,
      status: "confirmed",
      payment_method: input.paymentMethod,
      payment_status: input.paymentMethod === "cash" ? "pending_at_counter" : "captured",
      receipt_number: receiptNum,
      reason: input.reason || (input.paymentMethod === "cash" ? "Consultation (Pay in Cash at Counter)" : "Clinical Consultation"),
      cabin,
      created_at: new Date().toISOString(),
    };

    this.appointments.unshift(newAppt);
    return newAppt;
  }

  public getById(id: string): ClinicAppointment | null {
    return this.appointments.find((a) => a.id === id) || null;
  }

  public listForPatient(patientId: string): ClinicAppointment[] {
    return this.appointments.filter((a) => a.patient_id === patientId);
  }

  public listForDoctor(doctorId: string, date?: string): ClinicAppointment[] {
    return this.appointments.filter((a) => {
      const matchDoc = a.doctor_id === doctorId;
      const matchDate = date ? a.appointment_date === date : true;
      return matchDoc && matchDate;
    });
  }

  public listAll(filterDate?: string, status?: string): ClinicAppointment[] {
    return this.appointments.filter((a) => {
      if (filterDate && a.appointment_date !== filterDate) return false;
      if (status && a.status !== status) return false;
      return true;
    });
  }

  public updateStatus(id: string, status: AppointmentStatus): boolean {
    const appt = this.getById(id);
    if (!appt) return false;
    appt.status = status;
    return true;
  }

  public cancel(id: string, reason?: string): boolean {
    const appt = this.getById(id);
    if (!appt) return false;
    appt.status = "cancelled";
    appt.cancel_reason = reason || "Cancelled by patient";
    return true;
  }
}

// Global singleton instance
const globalStore = (globalThis as unknown as { __clinicStore?: ClinicStore }).__clinicStore ?? new ClinicStore();
(globalThis as unknown as { __clinicStore?: ClinicStore }).__clinicStore = globalStore;

export const clinicStore = globalStore;

/** Convert ClinicAppointment to ApptWithDoctor expected by patient queries */
export function toApptWithDoctor(a: ClinicAppointment): ApptWithDoctor {
  return {
    id: a.id,
    appointment_number: a.appointment_number,
    patient_id: a.patient_id,
    doctor_id: a.doctor_id,
    appointment_date: a.appointment_date,
    start_time: a.start_time,
    end_time: a.ends_at.slice(11, 16),
    starts_at: a.starts_at,
    ends_at: a.ends_at,
    status: a.status,
    reason: a.reason,
    notes: a.reason,
    payment_expires_at: null,
    cancel_reason: a.cancel_reason || null,
    created_at: a.created_at,
    doctors: {
      speciality: a.speciality,
      consultation_fee: a.consultation_fee,
      profiles: { full_name: a.doctor_name },
    },
    payments: [
      {
        id: `pay-${a.id}`,
        appointment_id: a.id,
        receipt_number: a.receipt_number,
        amount: a.consultation_fee * 100, // paise
        currency: "INR",
        method: a.payment_method === "cash" ? "cash" : a.payment_method === "card" ? "card" : "upi",
        status: a.payment_status === "captured" ? "captured" : "created",
        refunded_amount: 0,
        refund_required: false,
        razorpay_order_id: `order_${a.id.slice(0, 8)}`,
        razorpay_payment_id: a.payment_method === "razorpay" ? `pay_${a.id.slice(0, 8)}` : null,
        created_at: a.created_at,
        verified_at: a.payment_status === "captured" ? a.created_at : null,
        failure_reason: a.payment_method === "cash" ? "Pay at Clinic Counter (Cash)" : null,
      },
    ],
  };
}

/** Convert ClinicAppointment to DoctorAppointmentRow expected by doctor dashboard */
export function toDoctorAppointmentRow(a: ClinicAppointment): DoctorAppointmentRow {
  return {
    id: a.id,
    appointment_number: a.appointment_number,
    appointment_date: a.appointment_date,
    start_time: a.start_time,
    starts_at: a.starts_at,
    ends_at: a.ends_at,
    status: a.status,
    reason: a.reason,
    patients: {
      id: a.patient_id,
      patient_code: a.patient_code,
      date_of_birth: "1988-05-14",
      gender: "Male",
      profiles: { full_name: a.patient_name },
    },
  };
}
