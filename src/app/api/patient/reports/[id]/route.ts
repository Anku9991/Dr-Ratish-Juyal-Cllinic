import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { reportsStore } from "@/lib/reports-store";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const report = reportsStore.getById(id);

    if (!report) {
      return NextResponse.json({ ok: false, message: "Report not found" }, { status: 404 });
    }

    // Role check: patients can only delete their own reports, admins can delete any
    if (user.role === "patient" && report.patient_id !== user.id && !report.patient_id.includes(user.id)) {
      return NextResponse.json({ ok: false, message: "Permission denied" }, { status: 403 });
    }

    const deleted = reportsStore.delete(id);
    if (!deleted) {
      return NextResponse.json({ ok: false, message: "Failed to delete report" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, message: "Report deleted successfully" });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete report";
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
