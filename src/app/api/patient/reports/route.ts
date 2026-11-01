import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser, getPatientId } from "@/lib/auth";
import { reportsStore, type ReportCategory } from "@/lib/reports-store";
import { DR_RATISH_JUYAL_ID } from "@/lib/firebase/data";

const uploadSchema = z.object({
  title: z.string().trim().min(2, "Title is required").max(150),
  category: z.enum([
    "Blood Test / Pathology",
    "MRI Brain / Spine",
    "CT Scan",
    "X-Ray",
    "EEG / EMG / NCV",
    "Discharge Summary",
    "Prescription",
    "Other",
  ]),
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  description: z.string().trim().max(1000).optional().nullable(),
  fileName: z.string().trim().min(1, "File name is required"),
  fileType: z.string().refine(
    (type) =>
      [
        "application/pdf",
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
      ].includes(type),
    "Supported file types: PDF, JPG, JPEG, PNG"
  ),
  fileSize: z.number().max(15 * 1024 * 1024, "File size cannot exceed 15MB"),
  fileData: z.string().min(1, "File data is required"),
  doctorId: z.string().uuid().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const targetPatientId = searchParams.get("patientId");

    // If doctor/staff requests reports for a patient
    if (user.role === "doctor" || user.role === "admin") {
      if (targetPatientId) {
        return NextResponse.json({
          ok: true,
          data: reportsStore.listByPatient(targetPatientId),
        });
      }
      return NextResponse.json({
        ok: true,
        data: reportsStore.listByDoctor(user.id),
      });
    }

    // Patient requests their own reports
    const patientId = (await getPatientId(user.id)) || user.id;
    return NextResponse.json({
      ok: true,
      data: reportsStore.listByPatient(patientId),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to load reports";
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: "Unauthorized. Please sign in." }, { status: 401 });
    }

    const raw = await req.json();
    const parsed = uploadSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: parsed.error.issues[0]?.message || "Invalid report upload data" },
        { status: 400 }
      );
    }

    const patientId = (await getPatientId(user.id)) || user.id;
    const patientName = user.fullName || "Clinic Patient";
    const uhid = `UHID-${patientId.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase() || "1001"}`;

    const report = reportsStore.addReport({
      patient_id: patientId,
      patient_name: patientName,
      uhid,
      title: parsed.data.title,
      category: parsed.data.category as ReportCategory,
      report_date: parsed.data.reportDate,
      description: parsed.data.description || null,
      file_name: parsed.data.fileName,
      file_type: parsed.data.fileType,
      file_size: parsed.data.fileSize,
      file_url: parsed.data.fileData,
      doctor_id: parsed.data.doctorId || DR_RATISH_JUYAL_ID,
    });

    return NextResponse.json({
      ok: true,
      message: "Medical report uploaded and secured successfully!",
      data: report,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to upload medical report";
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
