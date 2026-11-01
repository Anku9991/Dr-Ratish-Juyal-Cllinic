import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "admin") {
      return NextResponse.json({ ok: false, message: "Unauthorized. Staff login required." }, { status: 401 });
    }

    const formData = await req.formData();
    const file = (formData.get("file") || formData.get("video")) as File | null;

    if (!file) {
      return NextResponse.json({ ok: false, message: "No video file provided." }, { status: 400 });
    }

    // Validate video file type
    const isVideo =
      file.type.startsWith("video/") ||
      Boolean(file.name.match(/\.(mp4|webm|mov|m4v|ogg|mkv)$/i));

    if (!isVideo) {
      return NextResponse.json(
        { ok: false, message: "Invalid format. Please upload MP4, MOV, or WebM video file." },
        { status: 400 }
      );
    }

    // Limit to 100MB
    const MAX_SIZE = 100 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { ok: false, message: "File exceeds 100MB limit. Please upload a compressed MP4 video." },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Sanitize extension
    const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
    const sanitizedExt = ["mp4", "webm", "mov", "m4v"].includes(ext) ? ext : "mp4";
    const filename = `clinic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${sanitizedExt}`;

    // Target upload directory in public/uploads/videos/
    const uploadDir = path.join(process.cwd(), "public", "uploads", "videos");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, buffer);

    const videoUrl = `/uploads/videos/${filename}`;

    return NextResponse.json({
      ok: true,
      message: "Video uploaded successfully!",
      videoUrl,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || `video/${sanitizedExt}`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Video upload failed";
    console.error("Video upload error:", err);
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
