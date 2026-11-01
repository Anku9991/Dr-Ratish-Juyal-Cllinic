export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

interface Mapped {
  status: number;
  code: string;
  message: string;
}

/** Maps the RAISE EXCEPTION tokens from the SQL functions to safe, user-facing API errors. */
const DB_ERRORS: Record<string, Mapped> = {
  SLOT_TAKEN: { status: 409, code: "slot_taken", message: "That slot was just taken. Please choose another time." },
  SLOT_INVALID: { status: 422, code: "slot_invalid", message: "That is not a bookable time for this doctor." },
  SLOT_PAST: { status: 422, code: "slot_past", message: "That time has already passed." },
  SLOT_OUT_OF_RANGE: { status: 422, code: "slot_out_of_range", message: "That date is too far ahead to book." },
  DOCTOR_ON_LEAVE: { status: 409, code: "doctor_on_leave", message: "The doctor is not available on that date." },
  CLINIC_HOLIDAY: { status: 409, code: "clinic_holiday", message: "The clinic is closed on that date." },
  DOCTOR_UNAVAILABLE: { status: 404, code: "doctor_unavailable", message: "This doctor is not available for booking." },
  PATIENT_INVALID: { status: 403, code: "patient_invalid", message: "Your account cannot book appointments." },
  HOLD_NOT_FOUND: { status: 404, code: "hold_not_found", message: "Slot reservation not found. Please pick a slot again." },
  HOLD_EXPIRED: { status: 410, code: "hold_expired", message: "Your slot reservation expired. Please pick a slot again." },
  PAYMENT_NOT_FOUND: { status: 404, code: "payment_not_found", message: "Payment not found." },
  PAYMENT_NOT_REFUNDABLE: { status: 409, code: "payment_not_refundable", message: "This payment cannot be refunded." },
  REFUND_AMOUNT_INVALID: { status: 422, code: "refund_amount_invalid", message: "Refund amount exceeds the refundable balance." },
  CANNOT_CANCEL: { status: 409, code: "cannot_cancel", message: "This appointment can no longer be cancelled." },
  APPOINTMENT_NOT_FOUND: { status: 404, code: "appointment_not_found", message: "Appointment not found." },
  APPOINTMENT_NOT_READY: { status: 409, code: "appointment_not_ready", message: "This appointment is not open for consultation." },
  CONSULTATION_LOCKED: { status: 409, code: "consultation_locked", message: "This consultation is finalized. Use the amendment process to change it." },
  CONSULTATION_NOT_FOUND: { status: 404, code: "consultation_not_found", message: "Consultation not found." },
  ALREADY_FINALIZED: { status: 409, code: "already_finalized", message: "This prescription is already finalized." },
  NO_DRAFT: { status: 409, code: "no_draft", message: "Save the consultation before finalizing." },
  DIAGNOSIS_REQUIRED: { status: 422, code: "diagnosis_required", message: "A diagnosis is required to finalize the prescription." },
  MEDICINES_REQUIRED: { status: 422, code: "medicines_required", message: "Add at least one medicine to finalize the prescription." },
  REASON_REQUIRED: { status: 422, code: "reason_required", message: "Please give a reason (at least 5 characters)." },
  NOT_ISSUED: { status: 409, code: "not_issued", message: "Only an issued prescription can be amended or cancelled." },
  PRESCRIPTION_IMMUTABLE: { status: 409, code: "prescription_immutable", message: "Issued prescriptions cannot be edited." },
};

export function mapDbError(err: { message?: string; code?: string } | null | undefined): HttpError {
  const text = err?.message ?? "";
  for (const token of Object.keys(DB_ERRORS)) {
    if (text.includes(token)) {
      const m = DB_ERRORS[token] as Mapped;
      return new HttpError(m.status, m.code, m.message);
    }
  }
  if (err?.code === "23505") return new HttpError(409, "conflict", "That record already exists.");
  if (err?.code === "23503") return new HttpError(409, "reference_error", "A related record is missing or still in use.");
  if (err?.code === "23514" || err?.code === "22P02" || err?.code === "22007") {
    return new HttpError(422, "invalid_value", "One of the values is not valid.");
  }
  return new HttpError(500, "database_error", "Something went wrong. Please try again.");
}
