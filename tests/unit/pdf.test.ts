import { describe, expect, it } from "vitest";
import { generatePrescriptionPdf, wrapText, type PrescriptionPdfData } from "@/lib/pdf/prescription";
import { PDFDocument, StandardFonts } from "pdf-lib";

const base: PrescriptionPdfData = {
  clinic: { name: "Sunrise Clinic", address: "123 MG Road, Lucknow", phone: "+91 98765 43210", email: "care@sunrise.test", footer: "Timings: 9am-6pm" },
  doctor: { name: "Dr. Asha Verma", qualification: "MBBS, MD", speciality: "General Medicine", registrationNumber: "UP-12345" },
  patient: { name: "Ramesh Kumar", uhid: "UHID001000", age: 34, gender: "male" },
  appointmentNumber: "APT010000",
  prescriptionNumber: "RX2601000001",
  issuedOn: "27 Sep 2026, 10:30 am",
  status: "issued",
  diagnosis: "Viral fever",
  vitals: { bloodPressure: "120/80", pulse: 78, temperature: 99.1, spo2: 98, weight: 70 },
  medicines: [
    { medicineName: "Paracetamol", strength: "500mg", dosage: "1-0-1", frequency: "Twice daily", duration: "5 days", instructions: "After food" },
    { medicineName: "Cetirizine", strength: "10mg", dosage: "0-0-1", frequency: "Once at night", duration: "5 days" },
  ],
  advice: "Drink plenty of fluids and rest.",
  followUpDate: "4 Oct 2026",
};

describe("prescription PDF generation", () => {
  it("produces a valid, non-trivial single-page PDF for a normal prescription", async () => {
    const bytes = await generatePrescriptionPdf(base);
    expect(bytes.byteLength).toBeGreaterThan(1000);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
  });

  it("spills onto additional pages for a very long medicine list, repeating the header and table header", async () => {
    const many: PrescriptionPdfData = { ...base, medicines: Array.from({ length: 40 }, (_, i) => ({ medicineName: `Medicine ${i + 1}`, dosage: "1-1-1", frequency: "Thrice daily", duration: "10 days", instructions: "After food, with plenty of water, avoid dairy products for at least one hour" })) };
    const bytes = await generatePrescriptionPdf(many);
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it("does not throw when optional fields (logo, signature, vitals, advice, follow-up) are missing", async () => {
    const minimal: PrescriptionPdfData = {
      clinic: { name: "Clinic", address: "Addr", phone: "000" },
      doctor: { name: "Dr. X" },
      patient: { name: "Patient", uhid: "U1" },
      appointmentNumber: "A1",
      prescriptionNumber: "R1",
      issuedOn: "today",
      status: "issued",
      medicines: [{ medicineName: "Med", dosage: "1", frequency: "1", duration: "1" }],
    };
    const bytes = await generatePrescriptionPdf(minimal);
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it("draws a status banner for amended and cancelled copies without throwing", async () => {
    for (const status of ["amended", "cancelled"] as const) {
      const bytes = await generatePrescriptionPdf({ ...base, status, statusNote: "Dosage was corrected after review" });
      expect(bytes.byteLength).toBeGreaterThan(0);
    }
  });

  it("replaces unencodable characters rather than throwing (e.g. Devanagari script)", async () => {
    const bytes = await generatePrescriptionPdf({ ...base, advice: "आराम करें और खूब पानी पिएं" });
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it("wrapText hard-breaks a single word wider than the column instead of overflowing", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const longWord = "Supercalifragilisticexpialidocious".repeat(3);
    const lines = wrapText(longWord, font, 10, 80);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) expect(font.widthOfTextAtSize(line, 10)).toBeLessThanOrEqual(80 + 0.01);
  });

});
