import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

export interface PdfImageInput {
  bytes: Uint8Array;
  kind: "png" | "jpg";
}

export interface PrescriptionPdfData {
  clinic: {
    name: string;
    address: string;
    phone: string;
    email?: string | null;
    footer?: string | null;
    logo?: PdfImageInput | null;
  };
  doctor: {
    name: string;
    qualification?: string | null;
    speciality?: string | null;
    registrationNumber?: string | null;
    signature?: PdfImageInput | null;
  };
  patient: {
    name: string;
    uhid: string;
    age?: number | null;
    gender?: string | null;
  };
  appointmentNumber: string;
  prescriptionNumber: string;
  issuedOn: string; // already formatted in the clinic timezone
  status: "issued" | "amended" | "cancelled";
  statusNote?: string | null;
  chiefComplaints?: string | null;
  clinicalExamination?: string | null;
  diagnosis?: string | null;
  investigationAdvised?: string | null;
  vitals?: {
    bloodPressure?: string | null;
    pulse?: number | null;
    temperature?: number | string | null;
    spo2?: number | null;
    respiratoryRate?: number | string | null;
    height?: number | string | null;
    weight?: number | string | null;
    bmi?: number | string | null;
    bloodSugar?: number | string | null;
  };
  medicines: Array<{
    medicineName: string;
    strength?: string | null;
    dosage: string;
    frequency: string;
    duration: string;
    instructions?: string | null;
  }>;
  advice?: string | null;
  handwrittenPad?: PdfImageInput | null;
  followUpDate?: string | null; // formatted
}

const A4 = { w: 595.28, h: 841.89 };
const M = { l: 40, r: 40, t: 40, b: 60 };
const INK = rgb(0.09, 0.1, 0.17);
const MUTED = rgb(0.4, 0.42, 0.5);
const ACCENT = rgb(0.18, 0.25, 0.7);
const RULE = rgb(0.83, 0.85, 0.9);
const TINT = rgb(0.95, 0.96, 0.99);

type Fonts = { regular: PDFFont; bold: PDFFont };

/** Standard PDF fonts only encode WinAnsi; anything else becomes "?" instead of crashing the render. */
function clean(text: string | number | null | undefined, font: PDFFont): string {
  if (text === null || text === undefined) return "";
  const normalized = String(text)
    .replace(/₹/g, "Rs. ")
    .replace(/[•●]/g, "- ")
    .replace(/°/g, " deg ")
    .replace(/[–—]/g, "-")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, "  ");
  const supported = new Set(font.getCharacterSet());
  let out = "";
  for (const ch of normalized) {
    const cp = ch.codePointAt(0) ?? 0;
    if (ch === "\n" || supported.has(cp)) out += ch;
    else out += "?";
  }
  return out;
}

/** Wraps text to a pixel width, hard-breaking words that are wider than the column. */
export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph.trim() === "") {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      let w = word;
      while (font.widthOfTextAtSize(w, size) > maxWidth) {
        // break the long word
        let cut = w.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(w.slice(0, cut), size) > maxWidth) cut--;
        if (line) {
          lines.push(line);
          line = "";
        }
        lines.push(w.slice(0, cut));
        w = w.slice(cut);
      }
      const candidate = line ? `${line} ${w}` : w;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) line = candidate;
      else {
        if (line) lines.push(line);
        line = w;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

async function embed(doc: PDFDocument, img: PdfImageInput | null | undefined): Promise<PDFImage | null> {
  if (!img) return null;
  try {
    return img.kind === "png" ? await doc.embedPng(img.bytes) : await doc.embedJpg(img.bytes);
  } catch {
    return null; // a corrupt logo/signature must not block issuing a prescription
  }
}

export async function generatePrescriptionPdf(data: PrescriptionPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Prescription ${data.prescriptionNumber}`);
  doc.setProducer("Clinic Management System");
  const fonts: Fonts = { regular: await doc.embedFont(StandardFonts.Helvetica), bold: await doc.embedFont(StandardFonts.HelveticaBold) };
  const logo = await embed(doc, data.clinic.logo);
  const signature = await embed(doc, data.doctor.signature);
  const padImage = await embed(doc, data.handwrittenPad);

  const contentW = A4.w - M.l - M.r;
  let page: PDFPage = doc.addPage([A4.w, A4.h]);
  let y = A4.h - M.t;

  const text = (s: string, x: number, yy: number, size: number, bold = false, color = INK) => {
    page.drawText(clean(s, fonts.regular), { x, y: yy, size, font: bold ? fonts.bold : fonts.regular, color });
  };
  const rule = (yy: number) => page.drawLine({ start: { x: M.l, y: yy }, end: { x: A4.w - M.r, y: yy }, thickness: 0.7, color: RULE });

  const drawWrapped = (s: string, x: number, width: number, size: number, opts: { bold?: boolean; color?: ReturnType<typeof rgb>; lead?: number } = {}): void => {
    const lead = opts.lead ?? size * 1.35;
    for (const ln of wrapText(clean(s, fonts.regular), opts.bold ? fonts.bold : fonts.regular, size, width)) {
      ensureSpace(lead);
      text(ln, x, y - size, size, opts.bold, opts.color);
      y -= lead;
    }
  };

  function drawHeader(compact: boolean) {
    y = A4.h - M.t;
    let textX = M.l;
    if (!compact && logo) {
      const h = 46;
      const w = Math.min((logo.width / logo.height) * h, 120);
      page.drawImage(logo, { x: M.l, y: y - h, width: w, height: h });
      textX = M.l + w + 12;
    }
    const name = data.clinic.name || "Clinic";
    if (compact) {
      text(name, M.l, y - 12, 11, true, ACCENT);
      text(`Prescription ${data.prescriptionNumber}`, A4.w - M.r - fonts.regular.widthOfTextAtSize(clean(`Prescription ${data.prescriptionNumber}`, fonts.regular), 9), y - 12, 9, false, MUTED);
      y -= 24;
      rule(y);
      y -= 14;
      return;
    }
    text(name, textX, y - 16, 17, true, ACCENT);
    let ly = y - 30;
    const info = [data.clinic.address, [data.clinic.phone, data.clinic.email].filter(Boolean).join("   ")].filter(Boolean);
    for (const raw of info) {
      for (const ln of wrapText(clean(raw, fonts.regular), fonts.regular, 9, A4.w - M.r - textX)) {
        text(ln, textX, ly, 9, false, MUTED);
        ly -= 12;
      }
    }
    y = Math.min(ly, y - 52) - 6;
    rule(y);
    y -= 14;
  }

  function newPage() {
    page = doc.addPage([A4.w, A4.h]);
    drawHeader(true);
  }

  function ensureSpace(needed: number) {
    if (y - needed < M.b) newPage();
  }

  drawHeader(false);

  // status banner for amended / cancelled copies
  if (data.status !== "issued") {
    const label = data.status === "amended" ? "AMENDED - SUPERSEDED BY A NEWER PRESCRIPTION" : "CANCELLED - NOT VALID";
    page.drawRectangle({ x: M.l, y: y - 22, width: contentW, height: 22, color: rgb(0.99, 0.93, 0.93) });
    text(label, M.l + 8, y - 15, 9.5, true, rgb(0.7, 0.1, 0.1));
    y -= 30;
    if (data.statusNote) drawWrapped(`Reason: ${data.statusNote}`, M.l, contentW, 9, { color: MUTED });
  }

  // doctor + prescription meta
  const colW = contentW / 2 - 8;
  const top = y;
  let leftY = top;
  const leftLines: Array<[string, boolean, number]> = [[data.doctor.name, true, 12]];
  if (data.doctor.qualification) leftLines.push([data.doctor.qualification, false, 9.5]);
  if (data.doctor.speciality) leftLines.push([data.doctor.speciality, false, 9.5]);
  if (data.doctor.registrationNumber) leftLines.push([`Reg. No. ${data.doctor.registrationNumber}`, false, 9.5]);
  for (const [s, bold, size] of leftLines) {
    for (const ln of wrapText(clean(s, fonts.regular), bold ? fonts.bold : fonts.regular, size, colW)) {
      text(ln, M.l, leftY - size, size, bold, bold ? INK : MUTED);
      leftY -= size * 1.4;
    }
  }
  let rightY = top;
  const meta: Array<[string, string]> = [
    ["Prescription no.", data.prescriptionNumber],
    ["Appointment no.", data.appointmentNumber],
    ["Date", data.issuedOn],
  ];
  for (const [k, v] of meta) {
    text(k, M.l + contentW / 2 + 8, rightY - 9.5, 9, false, MUTED);
    const val = clean(v, fonts.bold);
    text(val, A4.w - M.r - fonts.bold.widthOfTextAtSize(val, 9.5), rightY - 9.5, 9.5, true);
    rightY -= 14;
  }
  y = Math.min(leftY, rightY) - 8;

  // patient box
  const boxH = 40;
  ensureSpace(boxH + 10);
  page.drawRectangle({ x: M.l, y: y - boxH, width: contentW, height: boxH, color: TINT });
  const pCols: Array<[string, string, number]> = [
    ["Patient", data.patient.name, 0],
    ["UHID", data.patient.uhid, 0.5],
    ["Age", data.patient.age !== null && data.patient.age !== undefined ? `${data.patient.age} yrs` : "-", 0.72],
    ["Gender", data.patient.gender ? data.patient.gender.charAt(0).toUpperCase() + data.patient.gender.slice(1) : "-", 0.86],
  ];
  for (const [k, v, frac] of pCols) {
    const x = M.l + 10 + contentW * frac;
    const maxW = (frac === 0 ? 0.5 : frac === 0.5 ? 0.22 : 0.14) * contentW - 12;
    text(k, x, y - 14, 8.5, false, MUTED);
    const line = wrapText(clean(v, fonts.bold), fonts.bold, 10.5, maxW)[0] ?? "";
    text(line, x, y - 29, 10.5, true);
  }
  y -= boxH + 14;

  // vitals
  const v = data.vitals ?? {};
  const vitalParts = [
    v.bloodPressure ? `BP ${v.bloodPressure} mmHg` : null,
    v.pulse ? `Pulse ${v.pulse} bpm` : null,
    v.temperature ? `Temp ${v.temperature} F` : null,
    v.spo2 ? `SpO2 ${v.spo2}%` : null,
    v.respiratoryRate ? `RR ${v.respiratoryRate}/min` : null,
    v.height ? `Ht ${v.height} cm` : null,
    v.weight ? `Wt ${v.weight} kg` : null,
    v.bmi ? `BMI ${v.bmi} kg/m2` : null,
    v.bloodSugar ? `Sugar ${v.bloodSugar} mg/dL` : null,
  ].filter(Boolean) as string[];
  if (vitalParts.length) {
    ensureSpace(30);
    text("Vitals", M.l, y - 9, 9, true, ACCENT);
    y -= 14;
    drawWrapped(vitalParts.join("   |   "), M.l, contentW, 9.5);
    y -= 6;
  }

  if (data.chiefComplaints) {
    ensureSpace(32);
    text("Chief Complaints", M.l, y - 9, 9, true, ACCENT);
    y -= 14;
    drawWrapped(data.chiefComplaints, M.l, contentW, 9.5);
    y -= 6;
  }

  if (data.diagnosis) {
    ensureSpace(34);
    text("Diagnosis", M.l, y - 9, 9, true, ACCENT);
    y -= 14;
    drawWrapped(data.diagnosis, M.l, contentW, 10.5);
    y -= 6;
  }

  // medicines table
  if (data.medicines.length > 0) {
    ensureSpace(60);
    text("Rx", M.l, y - 16, 18, true, ACCENT);
    y -= 26;
    const cols = [
      { key: "no", title: "#", w: 22 },
      { key: "med", title: "Medicine", w: 170 },
      { key: "dose", title: "Dosage", w: 70 },
      { key: "freq", title: "Frequency", w: 85 },
      { key: "dur", title: "Duration", w: 65 },
    ];
    const usedW = cols.reduce((s, c) => s + c.w, 0);
    cols.push({ key: "ins", title: "Instructions", w: contentW - usedW });
    const pad = 4;
    const drawTableHead = () => {
      ensureSpace(24);
      page.drawRectangle({ x: M.l, y: y - 18, width: contentW, height: 18, color: TINT });
      let x = M.l;
      for (const c of cols) {
        text(c.title, x + pad, y - 12.5, 8.5, true, MUTED);
        x += c.w;
      }
      y -= 20;
    };
    drawTableHead();
    data.medicines.forEach((m, i) => {
      const cells: Record<string, string[]> = {
        no: [String(i + 1)],
        med: wrapText(clean([m.medicineName, m.strength].filter(Boolean).join(" "), fonts.bold), fonts.bold, 9.5, (cols[1]?.w ?? 100) - pad * 2),
        dose: wrapText(clean(m.dosage, fonts.regular), fonts.regular, 9.5, (cols[2]?.w ?? 60) - pad * 2),
        freq: wrapText(clean(m.frequency, fonts.regular), fonts.regular, 9.5, (cols[3]?.w ?? 60) - pad * 2),
        dur: wrapText(clean(m.duration, fonts.regular), fonts.regular, 9.5, (cols[4]?.w ?? 60) - pad * 2),
        ins: wrapText(clean(m.instructions ?? "", fonts.regular), fonts.regular, 9, (cols[5]?.w ?? 60) - pad * 2),
      };
      const lineH = 12.5;
      const rowH = Math.max(...Object.values(cells).map((c) => c.length), 1) * lineH + 8;
      if (y - rowH < M.b) {
        newPage();
        drawTableHead();
      }
      let x = M.l;
      for (const c of cols) {
        const lines = cells[c.key] ?? [];
        lines.forEach((ln, li) => {
          text(ln, x + pad, y - 13 - li * lineH, c.key === "ins" ? 9 : 9.5, c.key === "med");
        });
        x += c.w;
      }
      y -= rowH;
      rule(y);
    });
    y -= 12;
  }

  if (padImage) {
    ensureSpace(220);
    text("Handwritten Prescription Notes", M.l, y - 9, 9, true, ACCENT);
    y -= 14;
    page.drawImage(padImage, { x: M.l, y: y - 200, width: contentW, height: 200 });
    y -= 210;
  }

  if (data.investigationAdvised) {
    ensureSpace(32);
    text("Investigation Advised", M.l, y - 9, 9, true, ACCENT);
    y -= 14;
    drawWrapped(data.investigationAdvised, M.l, contentW, 9.5);
    y -= 6;
  }

  if (data.advice) {
    ensureSpace(34);
    text("Advice", M.l, y - 9, 9, true, ACCENT);
    y -= 14;
    drawWrapped(data.advice, M.l, contentW, 10);
    y -= 6;
  }
  if (data.followUpDate) {
    ensureSpace(24);
    text("Follow-up", M.l, y - 9, 9, true, ACCENT);
    text(clean(data.followUpDate, fonts.bold), M.l + 60, y - 9.5, 10, true);
    y -= 22;
  }

  // signature block (kept together)
  const sigH = 78;
  ensureSpace(sigH);
  const sigX = A4.w - M.r - 170;
  if (signature) {
    const h = 40;
    const w = Math.min((signature.width / signature.height) * h, 150);
    page.drawImage(signature, { x: sigX, y: y - h - 4, width: w, height: h });
  }
  page.drawLine({ start: { x: sigX, y: y - 50 }, end: { x: A4.w - M.r, y: y - 50 }, thickness: 0.7, color: MUTED });
  text(data.doctor.name, sigX, y - 63, 9.5, true);
  if (data.doctor.registrationNumber) text(`Reg. No. ${data.doctor.registrationNumber}`, sigX, y - 75, 8.5, false, MUTED);
  y -= sigH;

  // footer + page numbers on every page
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    const footer = clean(data.clinic.footer ?? "", fonts.regular);
    p.drawLine({ start: { x: M.l, y: 46 }, end: { x: A4.w - M.r, y: 46 }, thickness: 0.5, color: RULE });
    if (footer) {
      wrapText(footer, fonts.regular, 8, contentW - 70)
        .slice(0, 2)
        .forEach((ln, li) => p.drawText(ln, { x: M.l, y: 34 - li * 10, size: 8, font: fonts.regular, color: MUTED }));
    }
    const label = `Page ${i + 1} of ${pages.length}`;
    p.drawText(label, { x: A4.w - M.r - fonts.regular.widthOfTextAtSize(label, 8), y: 34, size: 8, font: fonts.regular, color: MUTED });
  });

  return doc.save();
}
