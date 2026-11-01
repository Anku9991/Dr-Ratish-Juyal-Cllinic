"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { db } from "@/lib/firebase/config";
import { doc, onSnapshot, type DocumentSnapshot } from "firebase/firestore";
import {
  Pen,
  Eraser,
  Undo2,
  Trash2,
  Tablet,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Copy,
  Download,
} from "lucide-react";

export interface DigitalPrescriptionPadProps {
  appointmentId: string;
  patientName?: string;
  uhid?: string;
  doctorName?: string;
  onImageChange?: (dataUrl: string | null) => void;
  compact?: boolean;
}

interface Point {
  x: number;
  y: number;
  pressure?: number;
}

interface Stroke {
  points: Point[];
  color: string;
  width: number;
  isEraser: boolean;
}

export function DigitalPrescriptionPad({
  appointmentId,
  patientName,
  uhid,
  doctorName = "Dr. Ratish Juyal (DM Neurology)",
  onImageChange,
  compact = false,
}: DigitalPrescriptionPadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [penColor, setPenColor] = useState<string>("#1e293b"); // default dark ink
  const [penWidth, setPenWidth] = useState<number>(3);
  const [template, setTemplate] = useState<"ruled" | "neuro" | "blank">("ruled");

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const strokesRef = useRef<Stroke[]>([]);
  strokesRef.current = strokes;
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStroke = useRef<Stroke | null>(null);

  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved" | "error">("saved");
  const [lastSavedTime, setLastSavedTime] = useState<string>("");
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [companionConnected, setCompanionConnected] = useState(false);

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  // Setup broadcast channel for instant multi-monitor / tab sync
  useEffect(() => {
    try {
      const channel = new BroadcastChannel(`dr_pad_${appointmentId}`);
      broadcastRef.current = channel;
      channel.onmessage = (event) => {
        if (event.data?.type === "PAD_STROKES_UPDATE") {
          setStrokes(event.data.strokes);
          setCompanionConnected(true);
          setSaveStatus("saved");
          setLastSavedTime(new Date().toLocaleTimeString());
        }
      };
    } catch {
      // BroadcastChannel fallback
    }

    return () => {
      broadcastRef.current?.close();
    };
  }, [appointmentId]);

  // Setup Firebase Firestore Real-Time Listener for Remote Pad Sync
  useEffect(() => {
    if (!appointmentId) return;

    // Load initial from API/Firestore
    fetch(`/api/doctor/pad/${appointmentId}`)
      .then((res) => res.json())
      .then((res) => {
        if (res?.data?.strokes && Array.isArray(res.data.strokes)) {
          setStrokes(res.data.strokes);
          if (res.data.template) setTemplate(res.data.template);
          setLastSavedTime(new Date(res.data.updatedAt || Date.now()).toLocaleTimeString());
          if (res.data.imageData && onImageChange) onImageChange(res.data.imageData);
        }
      })
      .catch(() => {});

    // Listen to live updates from Firebase
    try {
      const unsub = onSnapshot(doc(db, "prescription_pads", appointmentId), (docSnap: DocumentSnapshot) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as { strokes?: Stroke[]; template?: "ruled" | "neuro" | "blank"; updatedAt?: string } | undefined;
          if (data?.strokes && Array.isArray(data.strokes)) {
            // Only update if strokes count or updated time differs
            setStrokes(data.strokes);
            if (data.template) setTemplate(data.template);
            setSaveStatus("saved");
            setCompanionConnected(true);
            setLastSavedTime(new Date(data.updatedAt || Date.now()).toLocaleTimeString());
          }
        }
      });
      return () => unsub();
    } catch (err) {
      console.warn("Firestore snapshot listener:", err);
    }
  }, [appointmentId]);

  // Redraw canvas whenever strokes or template changes
  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;

    ctx.clearRect(0, 0, width, height);

    // Draw Template Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    if (template === "ruled") {
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      const lineSpacing = 36;
      for (let y = 140; y < height - 40; y += lineSpacing) {
        ctx.beginPath();
        ctx.moveTo(30, y);
        ctx.lineTo(width - 30, y);
        ctx.stroke();
      }

      // Rx Symbol Watermark
      ctx.font = "italic bold 38px serif";
      ctx.fillStyle = "#cbd5e1";
      ctx.fillText("℞", 40, 125);
    } else if (template === "neuro") {
      // Neurology Exam Guidelines Overlay
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.strokeRect(30, 110, width - 60, height - 160);

      // Watermark Text
      ctx.font = "bold 13px sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("NEUROLOGICAL EXAMINATION & RX PAD", 40, 130);
      ctx.font = "11px sans-serif";
      ctx.fillStyle = "#cbd5e1";
      ctx.fillText("• Higher Mental • Cranial Nerves • Motor Power • Sensory • Reflexes • Cerebellar • Meningeal Signs", 40, 150);

      // Section divider
      ctx.beginPath();
      ctx.moveTo(30, 165);
      ctx.lineTo(width - 30, 165);
      ctx.stroke();

      ctx.font = "italic bold 32px serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("℞", 40, 200);
    }

    // Header branding
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 15px sans-serif";
    ctx.fillText(doctorName.toUpperCase(), 30, 35);
    ctx.fillStyle = "#64748b";
    ctx.font = "11px sans-serif";
    ctx.fillText("CONSULTANT NEUROLOGIST | BRAIN & SPINE CLINIC, LUCKNOW", 30, 52);

    if (patientName) {
      ctx.fillStyle = "#1e293b";
      ctx.font = "12px sans-serif";
      ctx.fillText(`Patient: ${patientName} ${uhid ? `| UHID: ${uhid}` : ""}`, 30, 75);
    }

    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(30, 88);
    ctx.lineTo(width - 30, 88);
    ctx.stroke();

    // Render Strokes
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const stroke of strokes) {
      if (stroke.points.length === 0) continue;
      ctx.strokeStyle = stroke.isEraser ? "#ffffff" : stroke.color;
      ctx.lineWidth = stroke.width;

      const firstPoint = stroke.points[0];
      if (!firstPoint) continue;

      if (stroke.points.length === 1) {
        ctx.beginPath();
        ctx.arc(firstPoint.x, firstPoint.y, stroke.width / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke.isEraser ? "#ffffff" : stroke.color;
        ctx.fill();
        continue;
      }

      ctx.beginPath();
      ctx.moveTo(firstPoint.x, firstPoint.y);
      for (let i = 1; i < stroke.points.length; i++) {
        const p1 = stroke.points[i - 1];
        const p2 = stroke.points[i];
        if (!p1 || !p2) continue;
        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;
        ctx.quadraticCurveTo(p1.x, p1.y, midX, midY);
      }
      ctx.stroke();
    }
  }, [strokes, template, patientName, uhid, doctorName]);

  // Adjust canvas size to container resolution
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const targetWidth = rect.width > 200 ? rect.width : 800;
    const targetHeight = compact ? 500 : 700;

    canvas.width = targetWidth * dpr;
    canvas.height = targetHeight * dpr;
    canvas.style.width = `${targetWidth}px`;
    canvas.style.height = `${targetHeight}px`;

    redrawCanvas();
  }, [compact]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Debounced auto-save function to Firebase & Local
  const triggerAutoSave = (newStrokes: Stroke[]) => {
    setSaveStatus("saving");
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        const canvas = canvasRef.current;
        const imageData = canvas ? canvas.toDataURL("image/png") : null;

        if (onImageChange && imageData) {
          onImageChange(imageData);
        }

        // Broadcast to companion screens / windows
        broadcastRef.current?.postMessage({
          type: "PAD_STROKES_UPDATE",
          strokes: newStrokes,
        });

        // Save to Firebase backend API
        const res = await fetch(`/api/doctor/pad/${appointmentId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageData,
            strokes: newStrokes,
            template,
          }),
        });

        if (res.ok) {
          setSaveStatus("saved");
          setLastSavedTime(new Date().toLocaleTimeString());
        } else {
          setSaveStatus("error");
        }
      } catch (err) {
        console.error("Auto-save error:", err);
        setSaveStatus("error");
      }
    }, 1200);
  };

  // Pointer drawing handlers (supports Apple Pencil, S-Pen, Stylus, Mouse, Touch)
  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = e.pressure && e.pressure > 0 ? e.pressure : 0.5;
    return { x, y, pressure };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    setSaveStatus("unsaved");

    const pt = getCoordinates(e);
    const strokeWidth = tool === "eraser" ? 22 : penWidth;
    const newStroke: Stroke = {
      points: [pt],
      color: penColor,
      width: strokeWidth,
      isEraser: tool === "eraser",
    };
    currentStroke.current = newStroke;

    setStrokes((prev) => [...prev, newStroke]);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentStroke.current) return;
    e.preventDefault();
    const pt = getCoordinates(e);
    currentStroke.current.points.push(pt);

    setStrokes((prev) => {
      const copy = [...prev];
      copy[copy.length - 1] = { ...currentStroke.current! };
      strokesRef.current = copy;
      return copy;
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();
    try {
      canvasRef.current?.releasePointerCapture(e.pointerId);
    } catch {}
    setIsDrawing(false);
    currentStroke.current = null;

    triggerAutoSave(strokesRef.current);
  };

  const handleUndo = () => {
    if (strokes.length === 0) return;
    const newStrokes = strokes.slice(0, -1);
    setStrokes(newStrokes);
    triggerAutoSave(newStrokes);
  };

  const handleClear = () => {
    if (strokes.length === 0) return;
    if (confirm("Clear this entire prescription pad?")) {
      setStrokes([]);
      triggerAutoSave([]);
    }
  };

  const companionPadUrl = typeof window !== "undefined"
    ? `${window.location.origin}/pad/${appointmentId}`
    : `/pad/${appointmentId}`;

  const copyPadUrl = () => {
    navigator.clipboard.writeText(companionPadUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const openPopout = () => {
    window.open(
      companionPadUrl,
      `pad_${appointmentId}`,
      "width=900,height=800,menubar=no,toolbar=no,location=no,status=no"
    );
  };

  return (
    <div className="rounded-[16px] border border-line bg-white shadow-sm overflow-hidden flex flex-col">
      {/* Top Toolbar */}
      <div className="border-b border-line bg-slate-50 p-3 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Tools */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Tool switch */}
          <div className="inline-flex rounded-lg border border-line bg-white p-0.5">
            <button
              type="button"
              onClick={() => setTool("pen")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                tool === "pen" ? "bg-brand-600 text-white shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              <Pen className="h-3.5 w-3.5" />
              Doctor Pen
            </button>
            <button
              type="button"
              onClick={() => setTool("eraser")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition ${
                tool === "eraser" ? "bg-brand-600 text-white shadow-sm" : "text-muted hover:text-ink"
              }`}
            >
              <Eraser className="h-3.5 w-3.5" />
              Eraser
            </button>
          </div>

          {/* Color Palette (Active when Pen) */}
          {tool === "pen" ? (
            <div className="flex items-center gap-1.5 bg-white border border-line rounded-lg px-2 py-1">
              {[
                { name: "Black Ink", color: "#1e293b" },
                { name: "Doctor Blue", color: "#1d4ed8" },
                { name: "Alert Red", color: "#dc2626" },
                { name: "Green", color: "#15803d" },
              ].map((c) => (
                <button
                  key={c.color}
                  type="button"
                  title={c.name}
                  onClick={() => setPenColor(c.color)}
                  className={`h-5 w-5 rounded-full border border-slate-300 transition-transform ${
                    penColor === c.color ? "scale-125 ring-2 ring-brand-500 ring-offset-1" : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: c.color }}
                />
              ))}
            </div>
          ) : null}

          {/* Pen Size */}
          {tool === "pen" ? (
            <select
              value={penWidth}
              onChange={(e) => setPenWidth(Number(e.target.value))}
              className="text-xs bg-white border border-line rounded-lg px-2 py-1.5 text-muted hover:text-ink"
            >
              <option value={2}>Fine (2px)</option>
              <option value={3}>Medium (3px)</option>
              <option value={5}>Thick (5px)</option>
              <option value={12}>Highlighter (12px)</option>
            </select>
          ) : null}

          {/* Template Choice */}
          <div className="flex items-center gap-1 bg-white border border-line rounded-lg p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setTemplate("ruled")}
              className={`px-2 py-1 rounded transition ${template === "ruled" ? "bg-slate-200 font-semibold" : "text-muted"}`}
              title="Ruled prescription paper"
            >
              Ruled Rx
            </button>
            <button
              type="button"
              onClick={() => setTemplate("neuro")}
              className={`px-2 py-1 rounded transition ${template === "neuro" ? "bg-slate-200 font-semibold" : "text-muted"}`}
              title="Neurological exam template"
            >
              Neuro Exam
            </button>
            <button
              type="button"
              onClick={() => setTemplate("blank")}
              className={`px-2 py-1 rounded transition ${template === "blank" ? "bg-slate-200 font-semibold" : "text-muted"}`}
              title="Plain paper"
            >
              Blank
            </button>
          </div>

          {/* Undo & Clear */}
          <button
            type="button"
            onClick={handleUndo}
            disabled={strokes.length === 0}
            className="p-1.5 rounded-lg border border-line bg-white text-muted hover:text-ink disabled:opacity-40"
            title="Undo stroke"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={strokes.length === 0}
            className="p-1.5 rounded-lg border border-line bg-white text-red-600 hover:bg-red-50 disabled:opacity-40"
            title="Clear canvas"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              const canvas = canvasRef.current;
              if (!canvas) return;
              const link = document.createElement("a");
              link.download = `Prescription-${appointmentId || "notes"}-${new Date().toISOString().slice(0, 10)}.png`;
              link.href = canvas.toDataURL("image/png");
              link.click();
            }}
            disabled={strokes.length === 0}
            className="p-1.5 rounded-lg border border-line bg-white text-brand-700 hover:bg-brand-50 disabled:opacity-40 cursor-pointer"
            title="Download Prescription PNG"
          >
            <Download className="h-4 w-4" />
          </button>
        </div>

        {/* Right: Cloud Auto-save Status & Connect Separate Tablet */}
        <div className="flex items-center gap-3">
          {/* Status Badge */}
          <div className="flex items-center gap-1.5 text-xs">
            {saveStatus === "saving" ? (
              <span className="flex items-center gap-1 text-amber-600 font-medium">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                Auto-saving to Firebase...
              </span>
            ) : saveStatus === "saved" ? (
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Firebase Auto-Saved {lastSavedTime ? `(${lastSavedTime})` : ""}
              </span>
            ) : (
              <span className="text-muted">Unsaved strokes</span>
            )}
          </div>

          {/* External Pad Connect Button */}
          <button
            type="button"
            onClick={() => setShowConnectModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 border border-brand-200 text-brand-700 text-xs font-semibold hover:bg-brand-100 transition shadow-sm"
          >
            <Tablet className="h-4 w-4" />
            Connect External Pad / Tablet
            {companionConnected ? (
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse ml-0.5" />
            ) : null}
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div
        ref={containerRef}
        className="relative bg-white flex-1 min-h-[500px] cursor-crosshair overflow-hidden touch-none select-none"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full h-full block touch-none"
        />

        {strokes.length === 0 ? (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="rounded-xl bg-white/80 backdrop-blur-xs border border-line p-4 text-center max-w-sm">
              <Pen className="h-8 w-8 text-brand-500 mx-auto mb-2 opacity-75" />
              <p className="text-sm font-medium text-ink">Doctor Digital Prescription Pad</p>
              <p className="text-xs text-muted mt-1">
                Use your mouse, stylus pen, Apple Pencil, or connect an external tablet to write or draw notes.
                Everything auto-saves to Firebase in real-time.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Footer Info */}
      <div className="border-t border-line bg-slate-50 px-4 py-2 flex items-center justify-between text-xs text-muted">
        <span>Dr. Ratish Juyal Clinic • Digital Handwriting & Prescription Pad</span>
        <span>Stylus pressure & multi-screen sync enabled</span>
      </div>

      {/* External Pad Modal */}
      {showConnectModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-line space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center gap-2">
                <Tablet className="h-5 w-5 text-brand-600" />
                <h3 className="font-semibold text-ink text-base">Connect External Writing Pad</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConnectModal(false)}
                className="text-muted hover:text-ink text-sm px-2 py-1 rounded"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-muted">
              Connect your iPad, Android tablet, touchscreen laptop, or secondary stylus device. Whatever you
              write on that device will instantly sync and auto-save right here.
            </p>

            <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-line text-xs">
              <p className="font-semibold text-slate-700">Option 1: Open on Secondary Screen / Popout Window</p>
              <button
                type="button"
                onClick={openPopout}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-brand-600 text-white font-medium rounded-lg hover:bg-brand-700 transition"
              >
                <ExternalLink className="h-4 w-4" />
                Open Pad in Popout Window
              </button>
            </div>

            <div className="space-y-2 bg-slate-50 p-3 rounded-xl border border-line text-xs">
              <p className="font-semibold text-slate-700">Option 2: Open on iPad / Tablet</p>
              <p className="text-muted">Copy this link and open it in Safari or Chrome on your tablet device:</p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={companionPadUrl}
                  className="flex-1 bg-white border border-line px-2.5 py-1.5 rounded-lg text-xs font-mono select-all text-slate-800"
                />
                <button
                  type="button"
                  onClick={copyPadUrl}
                  className="flex items-center gap-1 bg-slate-200 hover:bg-slate-300 px-3 py-1.5 rounded-lg font-medium text-slate-700 transition"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copiedLink ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowConnectModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
