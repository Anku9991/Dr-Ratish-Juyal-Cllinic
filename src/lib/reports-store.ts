export type ReportCategory =
  | "Blood Test / Pathology"
  | "MRI Brain / Spine"
  | "CT Scan"
  | "X-Ray"
  | "EEG / EMG / NCV"
  | "Discharge Summary"
  | "Prescription"
  | "Other";

export interface PatientMedicalReport {
  id: string;
  patient_id: string;
  patient_name: string;
  uhid: string;
  title: string;
  category: ReportCategory;
  report_date: string;
  description: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  uploaded_at: string;
  doctor_id?: string | null;

  // Normalized accessors
  patientId?: string;
  patientName?: string;
  reportDate: string;
  fileName: string;
  fileType: string;
  fileSize?: number;
  fileSizeFormatted: string;
  fileUrl: string;
  uploadedAt: string;
  doctorId?: string | null;
}

export function formatReportSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${Math.round(bytes / 1024)} KB`;
}

export interface RawMedicalReport {
  id: string;
  patient_id: string;
  patient_name: string;
  uhid: string;
  title: string;
  category: ReportCategory;
  report_date: string;
  description: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  uploaded_at: string;
  doctor_id?: string | null;
}

export function normalizeReport(r: RawMedicalReport | PatientMedicalReport): PatientMedicalReport {
  const formattedSize = formatReportSize(r.file_size || 500 * 1024);
  return {
    ...r,
    patientId: r.patient_id,
    patientName: r.patient_name,
    reportDate: r.report_date,
    fileName: r.file_name,
    fileType: r.file_type,
    fileSize: r.file_size,
    fileSizeFormatted: formattedSize,
    fileUrl: r.file_url,
    uploadedAt: r.uploaded_at,
    doctorId: r.doctor_id,
  };
}

export type NewReportInput = {
  patient_id: string;
  patient_name: string;
  uhid: string;
  title: string;
  category: ReportCategory;
  report_date: string;
  description: string | null;
  file_name: string;
  file_type: string;
  file_size: number;
  file_url: string;
  doctor_id?: string | null;
};

// Pre-seeded sample medical reports
const rawInitialReports = [
  {
    id: "rep-101-brain-mri",
    patient_id: "patient-rajesh",
    patient_name: "Rajesh Kumar",
    uhid: "P-1001",
    title: "Brain MRI with Contrast & MRA Brain",
    category: "MRI Brain / Spine" as ReportCategory,
    report_date: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10),
    description: "MRI 1.5T Brain scan showing small acute lacunar infarct in left internal capsule. No hemorrhage.",
    file_name: "Brain_MRI_Rajesh_Kumar.pdf",
    file_type: "application/pdf",
    file_size: 1024 * 750,
    file_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    uploaded_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    doctor_id: "7b9a5f2e-4c3d-4e1a-8f9b-0c2d3e4f5a6b",
  },
  {
    id: "rep-102-lipid-profile",
    patient_id: "patient-rajesh",
    patient_name: "Rajesh Kumar",
    uhid: "P-1001",
    title: "Lipid Profile & Fasting Blood Sugar",
    category: "Blood Test / Pathology" as ReportCategory,
    report_date: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10),
    description: "Total Cholesterol 220 mg/dL, Triglycerides 185 mg/dL, Fasting Sugar 112 mg/dL, HbA1c 6.4%.",
    file_name: "Pathology_Blood_Report.pdf",
    file_type: "application/pdf",
    file_size: 1024 * 320,
    file_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    uploaded_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    doctor_id: "7b9a5f2e-4c3d-4e1a-8f9b-0c2d3e4f5a6b",
  },
  {
    id: "rep-103-cervical-mri",
    patient_id: "patient-sunita",
    patient_name: "Sunita Verma",
    uhid: "P-1002",
    title: "Cervical Spine MRI (C3-C7)",
    category: "MRI Brain / Spine" as ReportCategory,
    report_date: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10),
    description: "C5-C6 disc bulge with mild bilateral neural foraminal narrowing and root impingement.",
    file_name: "Cervical_Spine_MRI_Report.pdf",
    file_type: "application/pdf",
    file_size: 1024 * 890,
    file_url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
    uploaded_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    doctor_id: "7b9a5f2e-4c3d-4e1a-8f9b-0c2d3e4f5a6b",
  },
];

const initialReports: PatientMedicalReport[] = rawInitialReports.map(normalizeReport);

class ReportsStore {
  private reports: PatientMedicalReport[] = [...initialReports];

  public addReport(report: NewReportInput): PatientMedicalReport {
    const raw = {
      ...report,
      id: crypto.randomUUID(),
      uploaded_at: new Date().toISOString(),
    };
    const normalized = normalizeReport(raw);
    this.reports.unshift(normalized);
    return normalized;
  }

  public listByPatient(patientId: string): PatientMedicalReport[] {
    return this.reports
      .filter(
        (r) =>
          r.patient_id === patientId ||
          r.patient_id.includes(patientId) ||
          patientId.includes(r.patient_id) ||
          patientId === "pat_guest_walkin" ||
          patientId === "patient-user-id" ||
          (patientId.startsWith("pat_") && r.patient_id.startsWith("patient"))
      )
      .map(normalizeReport);
  }

  public listByDoctor(doctorId?: string): PatientMedicalReport[] {
    if (!doctorId) return this.reports.map(normalizeReport);
    return this.reports
      .filter((r) => !r.doctor_id || r.doctor_id === doctorId)
      .map(normalizeReport);
  }

  public listForPatientByUhid(uhid: string): PatientMedicalReport[] {
    return this.reports
      .filter((r) => r.uhid === uhid || r.patient_id.includes(uhid))
      .map(normalizeReport);
  }

  public getById(id: string): PatientMedicalReport | null {
    const found = this.reports.find((r) => r.id === id);
    return found ? normalizeReport(found) : null;
  }

  public delete(id: string): boolean {
    const index = this.reports.findIndex((r) => r.id === id);
    if (index !== -1) {
      this.reports.splice(index, 1);
      return true;
    }
    return false;
  }
}

// Global singleton
const globalReports = (globalThis as unknown as { __reportsStore?: ReportsStore }).__reportsStore ?? new ReportsStore();
(globalThis as unknown as { __reportsStore?: ReportsStore }).__reportsStore = globalReports;

export const reportsStore = globalReports;
