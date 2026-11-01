"use client";

import { useEffect, useState, useRef } from "react";
import { PageHeader, Alert } from "@/components/ui";
import {
  FileText,
  Upload,
  Eye,
  Download,
  Trash2,
  Calendar,
  CheckCircle2,
  X,
  FileCheck,
} from "lucide-react";
import type { PatientMedicalReport, ReportCategory } from "@/lib/reports-store";

const CATEGORIES: ReportCategory[] = [
  "Blood Test / Pathology",
  "MRI Brain / Spine",
  "CT Scan",
  "X-Ray",
  "EEG / EMG / NCV",
  "Discharge Summary",
  "Prescription",
  "Other",
];

export default function PatientReportsPage() {
  const [reports, setReports] = useState<PatientMedicalReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [previewReport, setPreviewReport] = useState<PatientMedicalReport | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ReportCategory>("MRI Brain / Spine");
  const [reportDate, setReportDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports() {
    setLoading(true);
    try {
      const res = await fetch("/api/patient/reports");
      const json = await res.json();
      if (json.ok && Array.isArray(json.data)) {
        setReports(json.data);
      }
    } catch (err) {
      console.error("Error loading reports:", err);
    }
    setLoading(false);
  }

  const handleFileSelect = (selectedFile: File) => {
    if (selectedFile.size > 15 * 1024 * 1024) {
      alert("File size exceeds 15MB limit. Please upload a smaller file.");
      return;
    }

    setFile(selectedFile);
    if (!title) {
      const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
      setTitle(nameWithoutExt);
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFileData(reader.result as string);
    };
    reader.readAsDataURL(selectedFile);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !fileData || !title.trim()) {
      alert("Please select a file and provide a report title.");
      return;
    }

    setUploading(true);
    setUploadProgress(30);

    try {
      setTimeout(() => setUploadProgress(70), 200);

      const res = await fetch("/api/patient/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          category,
          reportDate,
          description: description.trim() || undefined,
          fileName: file.name,
          fileType: file.type || "application/pdf",
          fileSize: file.size,
          fileData,
        }),
      });

      const json = await res.json();
      setUploadProgress(100);

      if (json.ok && json.data) {
        setReports((prev) => [json.data, ...prev]);
        setStatusMessage({ type: "success", text: "Medical report uploaded and secured successfully!" });
        setShowUploadModal(false);
        // Reset form
        setTitle("");
        setDescription("");
        setFile(null);
        setFileData("");
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        setStatusMessage({ type: "error", text: json.message || "Failed to upload report" });
      }
    } catch {
      setStatusMessage({ type: "error", text: "Upload failed. Please try again." });
    }
    setUploading(false);
    setUploadProgress(0);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this medical report?")) return;
    try {
      const res = await fetch(`/api/patient/reports/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        setReports((prev) => prev.filter((r) => r.id !== id));
        setStatusMessage({ type: "success", text: "Report removed successfully." });
      }
    } catch {
      alert("Failed to delete report.");
    }
  };

  const filteredReports = reports.filter((r) => {
    const matchesCat = selectedCategory === "All" || r.category === selectedCategory;
    const matchesSearch =
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.file_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageHeader
          title="Medical Reports"
          description="Upload and view your diagnostic reports, MRI/CT scans, blood tests, and medical summaries."
        />
        <button
          type="button"
          onClick={() => {
            setShowUploadModal(true);
            setStatusMessage(null);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition cursor-pointer"
        >
          <Upload className="h-4 w-4" />
          <span>Upload Medical Report</span>
        </button>
      </div>

      {statusMessage ? (
        <Alert tone={statusMessage.type === "success" ? "success" : "danger"}>
          {statusMessage.text}
        </Alert>
      ) : null}

      {/* Category Pills & Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedCategory("All")}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
              selectedCategory === "All"
                ? "bg-brand-600 text-white shadow-2xs"
                : "bg-white border border-line text-slate-700 hover:bg-slate-50"
            }`}
          >
            All Reports ({reports.length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = reports.filter((r) => r.category === cat).length;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-brand-600 text-white shadow-2xs"
                    : "bg-white border border-line text-slate-700 hover:bg-slate-50"
                }`}
              >
                {cat} {count > 0 ? `(${count})` : ""}
              </button>
            );
          })}
        </div>

        <div className="relative max-w-md">
          <input
            type="text"
            placeholder="Search reports by title, scan type or notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-line bg-white px-3.5 py-2 text-sm text-ink placeholder:text-muted focus:border-brand-500 focus:outline-hidden"
          />
        </div>
      </div>

      {/* Reports Grid */}
      {loading ? (
        <div className="rounded-2xl border border-line bg-white p-12 text-center text-sm text-muted">
          Loading your medical records...
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center">
          <FileText className="mx-auto h-12 w-12 text-muted" />
          <h3 className="mt-3 text-base font-semibold text-ink">No medical reports found</h3>
          <p className="mt-1 text-sm text-muted">
            Upload your MRI scans, blood test reports, and past summaries to keep them accessible to your doctor.
          </p>
          <button
            type="button"
            onClick={() => setShowUploadModal(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 transition"
          >
            <Upload className="h-4 w-4" />
            <span>Upload Your First Report</span>
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredReports.map((report) => {
            const isPdf = report.file_type.includes("pdf") || report.file_name.endsWith(".pdf");
            return (
              <div
                key={report.id}
                className="flex flex-col justify-between rounded-xl border border-line bg-white p-5 shadow-xs transition hover:shadow-sm hover:border-brand-200"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-block rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 border border-brand-100">
                      {report.category}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDelete(report.id)}
                      title="Delete Report"
                      className="text-slate-400 hover:text-red-600 transition p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <h4 className="mt-3 text-base font-semibold text-ink line-clamp-1">{report.title}</h4>

                  {report.description ? (
                    <p className="mt-1.5 text-xs text-muted line-clamp-2 leading-relaxed">{report.description}</p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>{report.report_date}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <FileCheck className="h-3.5 w-3.5 text-slate-400" />
                      <span>{(report.file_size / 1024).toFixed(0)} KB • {isPdf ? "PDF" : "Image"}</span>
                    </span>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-2 border-t border-line pt-3">
                  <button
                    type="button"
                    onClick={() => setPreviewReport(report)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-line bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                  >
                    <Eye className="h-3.5 w-3.5 text-brand-600" />
                    <span>Preview</span>
                  </button>

                  <a
                    href={report.file_url}
                    download={report.file_name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition cursor-pointer"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Download</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="text-lg font-bold text-ink">Upload Medical Report</h3>
                <p className="text-xs text-muted">Supports PDF, JPG, JPEG, and PNG files up to 15MB.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              {/* File Drop Area */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Report File (PDF or Image)</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition ${
                    file ? "border-emerald-500 bg-emerald-50/40" : "border-line hover:border-brand-400 bg-slate-50/60"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,image/png,image/jpeg,image/jpg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) handleFileSelect(e.target.files[0]);
                    }}
                  />
                  {file ? (
                    <div className="flex items-center justify-center gap-2 text-emerald-800">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                      <span className="font-semibold text-xs truncate max-w-xs">{file.name}</span>
                      <span className="text-[11px] text-muted">({(file.size / 1024).toFixed(0)} KB)</span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="mx-auto h-7 w-7 text-muted" />
                      <p className="text-xs font-medium text-ink">Click or drag file here to upload</p>
                      <p className="text-[11px] text-muted">PDF, JPG, JPEG, PNG (Max 15MB)</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Report Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Brain MRI Scan (1.5T), Complete Blood Count..."
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-line px-3.5 py-2 text-sm text-ink focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              {/* Category & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as ReportCategory)}
                    className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink focus:border-brand-500 focus:outline-hidden"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Report Date *</label>
                  <input
                    type="date"
                    required
                    value={reportDate}
                    onChange={(e) => setReportDate(e.target.value)}
                    className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink focus:border-brand-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Notes / Findings */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Findings / Clinical Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Any specific observations, impression, or lab values you'd like Dr. Ratish Juyal to review..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-line px-3.5 py-2 text-sm text-ink focus:border-brand-500 focus:outline-hidden"
                />
              </div>

              {uploading ? (
                <div className="space-y-1.5 pt-2">
                  <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-brand-600 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <p className="text-center text-xs text-muted">Securing and uploading report... {uploadProgress}%</p>
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="rounded-xl border border-line px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !file || !title.trim()}
                  className="rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition cursor-pointer"
                >
                  {uploading ? "Uploading..." : "Save & Secure Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Preview Modal */}
      {previewReport ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative flex flex-col w-full max-w-3xl h-[85vh] rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5 bg-slate-50">
              <div>
                <h3 className="font-bold text-ink text-base truncate max-w-lg">{previewReport.title}</h3>
                <p className="text-xs text-muted">
                  {previewReport.category} • {previewReport.report_date}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={previewReport.file_url}
                  download={previewReport.file_name}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewReport(null)}
                  className="rounded-lg p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-100 p-2 overflow-auto flex items-center justify-center">
              {previewReport.file_type.includes("pdf") ? (
                <iframe
                  src={previewReport.file_url}
                  title={previewReport.title}
                  className="w-full h-full rounded-lg border border-line bg-white"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewReport.file_url}
                  alt={previewReport.title}
                  className="max-h-full max-w-full rounded-lg object-contain shadow-sm"
                />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
