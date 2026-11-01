"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Pen,
  Eraser,
  Undo2,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Maximize2,
  Minimize2,
  Tablet,
} from "lucide-react";

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

export function ExternalPadClient({ appointmentId }: { appointmentId: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [tool, setTool] = useState<"pen" | "eraser">("pen");
  const [penColor, setPenColor] = useState<string>("#1e293b");
  const [penWidth] = useState<number>(3);
  const [template, setTemplate] = useState<"ruled" | "neuro" | "blank">("ruled");

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const currentStroke = useRef<Stroke | null>(null);

  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const [lastSaved, setLastSaved] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    try {
      const channel = new BroadcastChannel(`dr_pad_${appointmentId}`);
      broadcastRef.current = channel;
    } catch {}

    return () => {
      broadcastRef.current?.close();
    };
  }, [appointmentId]);

  // Load existing strokes
  useEffect(() => {
    fetch(`/api/doctor/pad/${appointmentId}`)
      .then((res) => res.json())
      .then((res) => {
        if (res?.data?.strokes && Array.isArray(res.data.strokes)) {
          setStrokes(res.data.strokes);
          if (res.data.template) setTemplate(res.data.template);
          setLastSaved(new Date(res.data.updatedAt || Date.now()).toLocaleTimeString());
        }
      })
      .catch(() => {});
  }, [appointmentId]);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
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

      ctx.font = "italic bold 42px serif";
      ctx.fillStyle = "#cbd5e1";
      ctx.fillText("℞", 40, 125);
    } else if (template === "neuro") {
      ctx.strokeStyle = "#e2e8f0";
      ctx.lineWidth = 1;
      ctx.strokeRect(30, 110, width - 60, height - 160);

      ctx.font = "bold 13px sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText("NEUROLOGICAL EXAMINATION & RX PAD", 40, 130);
      ctx.font = "11px sans-serif";
      ctx.fillStyle = "#cbd5e1";
      ctx.fillText("• Higher Mental • Cranial Nerves • Motor Power • Sensory • Reflexes • Cerebellar Signs", 40, 150);

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
    ctx.font = "bold 16px sans-serif";
    ctx.fillText("DR. RATISH JUYAL, DM (NEUROLOGY, KGMU)", 30, 35);
    ctx.fillStyle = "#64748b";
    ctx.font = "11px sans-serif";
    ctx.fillText("CONSULTANT NEUROLOGIST | BRAIN & SPINE CLINIC, LUCKNOW", 30, 52);

    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(30, 75);
    ctx.lineTo(width - 30, 75);
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
  }, [strokes, template]);

  // Handle Resize
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const targetWidth = rect.width;
    const targetHeight = rect.height;

    canvas.width = targetWidth * dpr;
    canvas.height = targetHeight * dpr;
    canvas.style.width = `${targetWidth}px`;
    canvas.style.height = `${targetHeight}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(dpr, dpr);
    }

    redrawCanvas();
  }, [redrawCanvas]);

  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  const triggerAutoSave = (newStrokes: Stroke[]) => {
    setSaveStatus("saving");
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        const canvas = canvasRef.current;
        const imageData = canvas ? canvas.toDataURL("image/png") : null;

        broadcastRef.current?.postMessage({
          type: "PAD_STROKES_UPDATE",
          strokes: newStrokes,
        });

        await fetch(`/api/doctor/pad/${appointmentId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageData,
            strokes: newStrokes,
            template,
          }),
        });

        setSaveStatus("saved");
        setLastSaved(new Date().toLocaleTimeString());
      } catch (err) {
        console.error("Auto-save error:", err);
      }
    }, 1000);
  };

  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      pressure: e.pressure && e.pressure > 0 ? e.pressure : 0.5,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    canvasRef.current?.setPointerCapture(e.pointerId);
    setIsDrawing(true);
    setSaveStatus("unsaved");

    const pt = getCoordinates(e);
    const strokeWidth = tool === "eraser" ? 24 : penWidth;
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

    triggerAutoSave(strokes);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-slate-900 text-slate-100 select-none">
      {/* Top Header & Controls */}
      <header className="h-14 bg-slate-800 border-b border-slate-700 px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-700/60 px-3 py-1 rounded-lg">
            <Tablet className="h-4 w-4 text-brand-400" />
            <span className="font-semibold text-xs sm:text-sm">External Writing Pad</span>
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
          </div>

          {/* Tools */}
          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-lg border border-slate-700">
            <button
              type="button"
              onClick={() => setTool("pen")}
              className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition ${
                tool === "pen" ? "bg-brand-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              <Pen className="h-3.5 w-3.5" />
              Pen
            </button>
            <button
              type="button"
              onClick={() => setTool("eraser")}
              className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium transition ${
                tool === "eraser" ? "bg-brand-600 text-white" : "text-slate-400 hover:text-white"
              }`}
            >
              <Eraser className="h-3.5 w-3.5" />
              Eraser
            </button>
          </div>

          {/* Colors */}
          {tool === "pen" ? (
            <div className="hidden sm:flex items-center gap-1.5 bg-slate-900/80 px-2 py-1 rounded-lg border border-slate-700">
              {[
                { name: "Black", color: "#1e293b" },
                { name: "Doctor Blue", color: "#1d4ed8" },
                { name: "Alert Red", color: "#dc2626" },
                { name: "Green", color: "#15803d" },
              ].map((c) => (
                <button
                  key={c.color}
                  type="button"
                  onClick={() => setPenColor(c.color)}
                  className={`h-5 w-5 rounded-full border border-slate-600 transition-transform ${
                    penColor === c.color ? "scale-125 ring-2 ring-brand-400" : ""
                  }`}
                  style={{ backgroundColor: c.color }}
                />
              ))}
            </div>
          ) : null}

          {/* Templates */}
          <div className="hidden md:flex items-center gap-1 text-xs">
            <button
              type="button"
              onClick={() => setTemplate("ruled")}
              className={`px-2.5 py-1 rounded ${template === "ruled" ? "bg-slate-700 font-medium" : "text-slate-400"}`}
            >
              Ruled
            </button>
            <button
              type="button"
              onClick={() => setTemplate("neuro")}
              className={`px-2.5 py-1 rounded ${template === "neuro" ? "bg-slate-700 font-medium" : "text-slate-400"}`}
            >
              Neuro Exam
            </button>
            <button
              type="button"
              onClick={() => setTemplate("blank")}
              className={`px-2.5 py-1 rounded ${template === "blank" ? "bg-slate-700 font-medium" : "text-slate-400"}`}
            >
              Blank
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              if (strokes.length > 0) {
                const next = strokes.slice(0, -1);
                setStrokes(next);
                triggerAutoSave(next);
              }
            }}
            className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300"
            title="Undo"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm("Clear all strokes?")) {
                setStrokes([]);
                triggerAutoSave([]);
              }
            }}
            className="p-1.5 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-400"
            title="Clear"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Right Status */}
        <div className="flex items-center gap-3 text-xs">
          {saveStatus === "saving" ? (
            <span className="flex items-center gap-1 text-amber-400 font-medium">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Auto-Saving...
            </span>
          ) : (
            <span className="flex items-center gap-1 text-emerald-400 font-medium">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Firebase Auto-Saved {lastSaved ? `(${lastSaved})` : ""}
            </span>
          )}

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200"
            title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Main Drawing Surface */}
      <div
        ref={containerRef}
        className="flex-1 bg-white relative overflow-hidden cursor-crosshair touch-none"
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full h-full block touch-none"
        />
      </div>
    </div>
  );
}
