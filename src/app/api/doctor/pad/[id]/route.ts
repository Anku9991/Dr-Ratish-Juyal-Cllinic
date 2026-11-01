import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/firebase/config";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { z } from "zod";

const idSchema = z.string().min(3).max(100).regex(/^[a-zA-Z0-9_-]+$/);

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== "doctor" && user.role !== "admin")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid appointment ID" }, { status: 400 });
    }

    const padRef = doc(db, "prescription_pads", parsed.data);
    const snap = await getDoc(padRef);

    if (snap.exists()) {
      return NextResponse.json({ ok: true, data: snap.data() });
    }

    return NextResponse.json({ ok: true, data: null });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch pad";
    console.error("Error reading pad:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getSessionUser();
    if (!user || (user.role !== "doctor" && user.role !== "admin")) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const parsed = idSchema.safeParse(id);
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: "Invalid appointment ID" }, { status: 400 });
    }

    const body = (await req.json()) as {
      imageData?: string;
      strokes?: unknown[];
      template?: string;
      notes?: string;
    };
    const { imageData, strokes, template, notes } = body;

    const padRef = doc(db, "prescription_pads", parsed.data);
    const padData = {
      appointmentId: parsed.data,
      imageData: imageData || null,
      strokes: strokes || [],
      template: template || "ruled",
      notes: notes || "",
      updatedAt: new Date().toISOString(),
      savedToFirebase: true,
    };

    await setDoc(padRef, padData, { merge: true });

    return NextResponse.json({ ok: true, message: "Prescription pad auto-saved to Firebase", data: padData });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to save pad";
    console.error("Error saving pad:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
