"use client";

import { useEffect, useState, useRef } from "react";
import { PageHeader, Alert } from "@/components/ui";
import {
  Video,
  Play,
  Upload,
  Search,
  Filter,
  Clock,
  User,
  Plus,
  Trash2,
  Edit2,
  X,
  FileVideo,
} from "lucide-react";
import type { ClinicVideo, VideoCategory } from "@/types/videos";
import { VIDEO_CATEGORIES } from "@/types/videos";

export default function AdminVideosPage() {
  const [videos, setVideos] = useState<ClinicVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "draft">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("All");

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingVideo, setEditingVideo] = useState<ClinicVideo | null>(null);
  const [playingVideo, setPlayingVideo] = useState<ClinicVideo | null>(null);

  // Form State
  const [videoSource, setVideoSource] = useState<"url" | "file">("url");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<VideoCategory>("Patient Education");
  const [videoUrl, setVideoUrl] = useState("");
  const [speaker, setSpeaker] = useState("Dr. Ratish Juyal");
  const [duration, setDuration] = useState("4:00");
  const [status, setStatus] = useState<"published" | "draft">("published");
  const [isFeatured, setIsFeatured] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [alertMsg, setAlertMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchVideos();
  }, []);

  async function fetchVideos() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/videos");
      const json = await res.json();
      if (json.videos && Array.isArray(json.videos)) {
        setVideos(json.videos);
      }
    } catch (err) {
      console.error("Failed to fetch videos:", err);
    }
    setLoading(false);
  }

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setCategory("Patient Education");
    setVideoUrl("");
    setSpeaker("Dr. Ratish Juyal");
    setDuration("4:00");
    setStatus("published");
    setIsFeatured(false);
    setSelectedFile(null);
    setEditingVideo(null);
    setUploadProgress(0);
    setAlertMsg(null);
  };

  const handleOpenEdit = (v: ClinicVideo) => {
    setEditingVideo(v);
    setTitle(v.title);
    setDescription(v.description);
    setCategory(v.category);
    setVideoUrl(v.videoUrl);
    setSpeaker(v.speaker);
    setDuration(v.duration);
    setStatus(v.status);
    setIsFeatured(Boolean(v.isFeatured));
    setVideoSource("url");
    setShowUploadModal(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.includes("mp4") && !file.type.includes("webm") && !file.type.includes("quicktime")) {
      alert("Please select a valid video file (MP4, WebM, or MOV).");
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      alert("File size exceeds 100MB. Please select a smaller video.");
      return;
    }

    setSelectedFile(file);
    if (!title) {
      setTitle(file.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) {
      alert("Please fill in Title and Description.");
      return;
    }

    let finalVideoUrl = videoUrl.trim();
    if (videoSource === "file") {
      if (!selectedFile && !editingVideo) {
        alert("Please select a video file to upload.");
        return;
      }
      if (selectedFile) {
        finalVideoUrl = URL.createObjectURL(selectedFile);
      }
    }

    if (!finalVideoUrl) {
      alert("Please provide a video URL or upload a video file.");
      return;
    }

    setUploading(true);
    setUploadProgress(40);

    try {
      setTimeout(() => setUploadProgress(80), 200);

      const payload = {
        title,
        description,
        category,
        videoUrl: finalVideoUrl,
        speaker,
        duration: duration || "3:30",
        status,
        isFeatured,
      };

      let res;
      if (editingVideo) {
        res = await fetch(`/api/admin/videos/${editingVideo.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/admin/videos", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      setUploading(false);

      if (json.ok) {
        setAlertMsg({
          type: "success",
          text: editingVideo ? "Video updated successfully!" : "Video published to clinic library!",
        });
        setTimeout(() => {
          setShowUploadModal(false);
          resetForm();
          fetchVideos();
        }, 1000);
      } else {
        setAlertMsg({ type: "error", text: json.message || "Failed to save video" });
      }
    } catch {
      setUploading(false);
      setAlertMsg({ type: "error", text: "Network error saving video." });
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to delete "${title}"?`)) return;

    try {
      const res = await fetch(`/api/admin/videos/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.ok) {
        setVideos((prev) => prev.filter((v) => v.id !== id));
      } else {
        alert(json.message || "Failed to delete video");
      }
    } catch {
      alert("Error deleting video.");
    }
  };

  const handleToggleStatus = async (v: ClinicVideo) => {
    const nextStatus = v.status === "published" ? "draft" : "published";
    try {
      const res = await fetch(`/api/admin/videos/${v.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const json = await res.json();
      if (json.ok) {
        setVideos((prev) =>
          prev.map((item) => (item.id === v.id ? { ...item, status: nextStatus } : item))
        );
      }
    } catch {
      alert("Failed to toggle status");
    }
  };

  // Filter Logic
  const filteredVideos = videos.filter((v) => {
    if (statusFilter !== "all" && v.status !== statusFilter) return false;
    if (categoryFilter !== "All" && v.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = v.title.toLowerCase().includes(q);
      const matchDesc = v.description.toLowerCase().includes(q);
      const matchSpeaker = v.speaker.toLowerCase().includes(q);
      const matchAuthor = v.author?.toLowerCase().includes(q);
      return matchTitle || matchDesc || matchSpeaker || matchAuthor;
    }
    return true;
  });

  const publishedCount = videos.filter((v) => v.status === "published").length;
  const draftCount = videos.filter((v) => v.status === "draft").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clinic Video Upload & Management"
        description="Upload MP4/MOV videos or embed medical talks, patient education guides, and clinic tour videos."
        actions={
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowUploadModal(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-brand-700 transition cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            + Upload / Embed Video
          </button>
        }
      />

      {/* Overview Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-line bg-white p-4 shadow-2xs">
          <p className="text-xs font-semibold text-muted">Total Videos</p>
          <p className="text-2xl font-bold text-ink mt-1">{videos.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-2xs">
          <p className="text-xs font-semibold text-emerald-800">Published (Live)</p>
          <p className="text-2xl font-bold text-emerald-950 mt-1">{publishedCount}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-2xs">
          <p className="text-xs font-semibold text-amber-800">Drafts (Hidden)</p>
          <p className="text-2xl font-bold text-amber-950 mt-1">{draftCount}</p>
        </div>
        <div className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-2xs">
          <p className="text-xs font-semibold text-blue-800">Healthcare Categories</p>
          <p className="text-2xl font-bold text-blue-950 mt-1">{VIDEO_CATEGORIES.length}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-line bg-white p-4 space-y-3 shadow-2xs">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search videos by title, speaker, author, or keyword..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-line bg-slate-50 pl-9 pr-4 py-2 text-xs text-ink focus:bg-white focus:border-brand-500 focus:outline-none"
            />
          </div>

          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 rounded-xl border border-line bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                statusFilter === "all" ? "bg-white text-brand-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              All ({videos.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("published")}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                statusFilter === "published" ? "bg-white text-emerald-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Published ({publishedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("draft")}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                statusFilter === "draft" ? "bg-white text-amber-700 shadow-2xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Drafts ({draftCount})
            </button>
          </div>
        </div>

        {/* Categories Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-line">
          <span className="text-[11px] font-bold text-slate-500 mr-1 flex items-center gap-1">
            <Filter className="h-3 w-3" /> Category:
          </span>
          <button
            type="button"
            onClick={() => setCategoryFilter("All")}
            className={`rounded-full px-3 py-1 text-[11px] font-semibold transition cursor-pointer ${
              categoryFilter === "All"
                ? "bg-brand-600 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            All Categories
          </button>
          {VIDEO_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition cursor-pointer ${
                categoryFilter === cat
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Videos List Grid */}
      {loading ? (
        <div className="p-8 text-center text-xs text-muted">Loading video library...</div>
      ) : filteredVideos.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-12 text-center space-y-3">
          <FileVideo className="h-10 w-10 text-slate-300 mx-auto" />
          <p className="font-bold text-ink">No videos match your criteria</p>
          <p className="text-xs text-muted">Try clearing the search or category filter, or upload a new clinic video.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredVideos.map((v) => {
            const isPub = v.status === "published";
            const thumb = v.youtubeId
              ? `https://img.youtube.com/vi/${v.youtubeId}/mqdefault.jpg`
              : v.thumbnailUrl || "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=400&q=80";

            return (
              <div
                key={v.id}
                className="group flex flex-col justify-between rounded-2xl border border-line bg-white overflow-hidden shadow-2xs hover:shadow-md hover:border-slate-300 transition"
              >
                <div>
                  {/* Thumbnail with overlay play trigger */}
                  <div
                    onClick={() => setPlayingVideo(v)}
                    className="relative aspect-video w-full bg-slate-900 cursor-pointer overflow-hidden"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumb}
                      alt={v.title}
                      className="h-full w-full object-cover group-hover:scale-105 transition duration-300"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition">
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-brand-700 shadow-lg group-hover:scale-110 transition">
                        <Play className="h-5 w-5 fill-current ml-0.5" />
                      </span>
                    </div>
                    <span className="absolute bottom-2 right-2 rounded bg-black/80 px-2 py-0.5 text-[11px] font-mono text-white">
                      {v.duration}
                    </span>
                    <span
                      className={`absolute top-2 left-2 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                        isPub ? "bg-emerald-600 text-white" : "bg-amber-500 text-white"
                      }`}
                    >
                      {v.status}
                    </span>
                  </div>

                  {/* Video Details */}
                  <div className="p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[10px] font-bold text-brand-700 border border-brand-200 truncate">
                        {v.category}
                      </span>
                      <span className="text-[11px] text-muted flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {v.uploadedAt}
                      </span>
                    </div>

                    <h3
                      onClick={() => setPlayingVideo(v)}
                      className="font-bold text-ink text-sm line-clamp-2 hover:text-brand-700 cursor-pointer"
                    >
                      {v.title}
                    </h3>

                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">{v.description}</p>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                      <span className="flex items-center gap-1 font-medium truncate">
                        <User className="h-3.5 w-3.5 text-brand-600 shrink-0" />
                        {v.speaker}
                      </span>
                      <span className="text-[11px] text-muted truncate">By {v.author || "Staff"}</span>
                    </div>
                  </div>
                </div>

                {/* Card Action Footer */}
                <div className="border-t border-line bg-slate-50/70 p-3 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(v)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold border transition cursor-pointer ${
                        isPub
                          ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                          : "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                      }`}
                    >
                      {isPub ? "Set Draft" : "Publish"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(v)}
                      className="rounded-lg border border-line bg-white p-1 text-slate-600 hover:bg-slate-100 cursor-pointer"
                      title="Edit video"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(v.id, v.title)}
                    className="rounded-lg p-1 text-rose-600 hover:bg-rose-50 cursor-pointer"
                    title="Delete video"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Video Player Modal */}
      {playingVideo ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-4xl rounded-2xl bg-white overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between border-b border-line px-5 py-3.5 bg-slate-50">
              <div>
                <h3 className="font-bold text-ink text-base">{playingVideo.title}</h3>
                <p className="text-xs text-muted">
                  {playingVideo.category} • Speaker: {playingVideo.speaker}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPlayingVideo(null)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="aspect-video w-full bg-black">
              {playingVideo.youtubeId ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${playingVideo.youtubeId}?autoplay=1`}
                  title={playingVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full border-0"
                />
              ) : (
                <video src={playingVideo.videoUrl} controls autoPlay className="h-full w-full object-contain" />
              )}
            </div>

            <div className="p-5 text-xs text-slate-700 bg-white leading-relaxed">
              <p className="font-bold text-sm text-ink mb-1">About this video:</p>
              <p>{playingVideo.description}</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Upload & Edit Video Modal */}
      {showUploadModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="flex max-h-[92vh] w-full max-w-2xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-2">
                <Video className="h-5 w-5 text-brand-600" />
                <h3 className="font-bold text-ink text-base">
                  {editingVideo ? "Edit Clinic Video" : "Upload / Embed Clinic Video"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  resetForm();
                }}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-200 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {alertMsg ? (
                <Alert tone={alertMsg.type === "success" ? "success" : "danger"}>{alertMsg.text}</Alert>
              ) : null}

              {/* Source Picker */}
              <div className="space-y-1.5">
                <label className="font-bold text-ink block">Video Source</label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setVideoSource("url")}
                    className={`flex-1 rounded-xl border p-2.5 text-center font-semibold transition cursor-pointer ${
                      videoSource === "url"
                        ? "border-brand-600 bg-brand-50 text-brand-700 ring-2 ring-brand-600/20"
                        : "border-line bg-white hover:bg-slate-50"
                    }`}
                  >
                    🔗 Embed Video URL (YouTube / Vimeo / MP4 Link)
                  </button>
                  <button
                    type="button"
                    onClick={() => setVideoSource("file")}
                    className={`flex-1 rounded-xl border p-2.5 text-center font-semibold transition cursor-pointer ${
                      videoSource === "file"
                        ? "border-brand-600 bg-brand-50 text-brand-700 ring-2 ring-brand-600/20"
                        : "border-line bg-white hover:bg-slate-50"
                    }`}
                  >
                    📁 Upload Local Video File (MP4, MOV, WebM)
                  </button>
                </div>
              </div>

              {videoSource === "url" ? (
                <div className="space-y-1">
                  <label className="font-bold text-ink block">Video URL or YouTube Link *</label>
                  <input
                    type="text"
                    required
                    placeholder="https://www.youtube.com/watch?v=... or direct MP4 link"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    className="w-full rounded-xl border border-line p-2.5 text-xs text-ink focus:border-brand-600 focus:outline-none"
                  />
                  <p className="text-[11px] text-muted">
                    Paste any YouTube video link (watch URL or short URL) or public MP4 streaming link.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <label className="font-bold text-ink block">Select Video File *</label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-brand-300 rounded-xl p-5 text-center bg-brand-50/30 hover:bg-brand-50 transition cursor-pointer"
                  >
                    <Upload className="h-6 w-6 text-brand-600 mx-auto mb-1" />
                    <p className="font-bold text-brand-700">
                      {selectedFile ? selectedFile.name : "Click to browse video file"}
                    </p>
                    <p className="text-[11px] text-muted mt-0.5">MP4, MOV, or WebM (Max 100MB)</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              )}

              {/* Title & Category */}
              <div className="space-y-1">
                <label className="font-bold text-ink block">Video Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Stroke Care & Emergency Neurological Golden Hour"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-line p-2.5 text-xs text-ink focus:border-brand-600 focus:outline-none"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="font-bold text-ink block">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as VideoCategory)}
                    className="w-full rounded-xl border border-line p-2.5 text-xs text-ink focus:border-brand-600 focus:outline-none bg-white"
                  >
                    {VIDEO_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-ink block">Speaker / Doctor *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Ratish Juyal / Dr. Amit K. Sharma PT"
                    value={speaker}
                    onChange={(e) => setSpeaker(e.target.value)}
                    className="w-full rounded-xl border border-line p-2.5 text-xs text-ink focus:border-brand-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="font-bold text-ink block">Video Duration</label>
                  <input
                    type="text"
                    placeholder="e.g. 5:20"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full rounded-xl border border-line p-2.5 text-xs text-ink focus:border-brand-600 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-ink block">Publication Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as "published" | "draft")}
                    className="w-full rounded-xl border border-line p-2.5 text-xs text-ink focus:border-brand-600 focus:outline-none bg-white"
                  >
                    <option value="published">Published (Visible on Patient Dashboard & Public /videos)</option>
                    <option value="draft">Draft (Saved for review, hidden from public)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-ink block">Description & Clinical Takeaways *</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Summarize key health advice, symptoms to watch, and doctor recommendations..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-line p-2.5 text-xs text-ink focus:border-brand-600 focus:outline-none"
                />
              </div>

              {uploading ? (
                <div className="space-y-1.5 py-2">
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>Uploading & processing video...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className="h-full bg-brand-600 transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              ) : null}

              <div className="pt-3 border-t border-line flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    resetForm();
                  }}
                  className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="rounded-xl bg-brand-600 px-5 py-2 text-xs font-bold text-white hover:bg-brand-700 disabled:opacity-50 cursor-pointer shadow-xs"
                >
                  {uploading ? "Saving..." : editingVideo ? "Update Video" : "Save & Publish"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
