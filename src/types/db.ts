import type { AppointmentStatus, PaymentStatus } from "@/lib/status";

export interface ClinicSettings {
  clinic_name: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  logo_storage_path: string | null;
  prescription_footer: string | null;
  timezone: string;
  cancellation_window_hours: number;
  slot_hold_minutes: number;
  booking_horizon_days: number;
  record_retention_years: number;
}

export interface PublicDoctor {
  id: string;
  doctor_code: string;
  full_name: string;
  speciality: string;
  qualification: string | null;
  registration_number: string | null;
  consultation_fee: number | string;
  bio: string | null;
}

export interface AppointmentRow {
  id: string;
  appointment_number: string;
  patient_id: string;
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  end_time: string;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  reason: string | null;
  notes: string | null;
  payment_expires_at: string | null;
  cancel_reason: string | null;
  created_at: string;
}

export interface PaymentRow {
  id: string;
  appointment_id: string;
  receipt_number: string;
  razorpay_order_id: string;
  razorpay_payment_id: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  method: string | null;
  refunded_amount: number;
  refund_required: boolean;
  failure_reason: string | null;
  verified_at: string | null;
  created_at: string;
}

export interface MedicineInput {
  medicineName: string;
  strength?: string | null;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string | null;
}

export interface ConsultationRow {
  id: string;
  appointment_id: string;
  doctor_id: string;
  patient_id: string;
  chief_complaints?: string | null;
  symptoms: string | null;
  examination_notes: string | null;
  diagnosis: string | null;
  blood_pressure: string | null;
  pulse: number | null;
  temperature: number | string | null;
  spo2: number | null;
  respiratory_rate?: number | null;
  height?: number | string | null;
  weight: number | string | null;
  bmi?: number | string | null;
  blood_sugar?: number | string | null;
  investigation_advised?: string | null;
  advice: string | null;
  follow_up_date: string | null;
  status: "draft" | "finalized";
  finalized_at: string | null;
}

export interface PrescriptionRow {
  id: string;
  consultation_id: string;
  prescription_number: string | null;
  doctor_id: string;
  patient_id: string;
  pdf_storage_path: string | null;
  issued_at: string | null;
  status: "draft" | "issued" | "amended" | "cancelled";
  amends_prescription_id: string | null;
  status_reason: string | null;
}

export interface MedicineRow {
  id: string;
  prescription_id: string;
  medicine_name: string;
  strength: string | null;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string | null;
  sort_order: number;
}
