"use client";

import { useState } from "react";
import { Play, Sparkles, X, Clock, User } from "lucide-react";
import type { ClinicVideo } from "@/types/videos";
import { resolveVideoSource } from "@/lib/video-helpers";

export function ClinicVideosSection({ initialVideos }: { initialVideos: ClinicVideo[] }) {
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [selectedVideo, setSelectedVideo] = useState<ClinicVideo | null>(initialVideos[0] ?? null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const categories = ["All", ...Array.from(new Set(initialVideos.map((v) => v.category)))];

  const filteredVideos =
    activeCategory === "All"
      ? initialVideos
      : initialVideos.filter((v) => v.category === activeCategory);

  const mainSource = selectedVideo
    ? resolveVideoSource(selectedVideo.videoUrl, selectedVideo.youtubeId, selectedVideo.thumbnailUrl)
    : null;

  return (
    <div className="space-y-6">
      {/* Category Filter Pills */}
      <div className="flex flex-wrap items-center gap-2">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
              activeCategory === cat
                ? "bg-brand-600 text-white shadow-2xs"
                : "bg-white border border-line text-slate-700 hover:bg-slate-50"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Featured Video Player & Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Main Video Highlight Player */}
        {selectedVideo && mainSource ? (
          <div className="lg:col-span-7 rounded-2xl border border-line bg-white overflow-hidden shadow-2xs">
            <div className="relative aspect-video w-full bg-slate-900">
              {mainSource.type === "youtube" || mainSource.type === "vimeo" ? (
                <iframe
                  src={mainSource.embedUrl}
                  title={selectedVideo.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full border-0"
                />
              ) : (
                <video
                  src={mainSource.embedUrl}
                  controls
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-contain"
                  poster={mainSource.thumbnailUrl}
                />
              )}
            </div>
            <div className="p-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-brand-50 text-brand-700 border border-brand-200">
                  <Sparkles className="h-3 w-3" />
                  {selectedVideo.category}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted">
                  <Clock className="h-3.5 w-3.5" />
                  {selectedVideo.duration}
                </span>
              </div>
              <h3 className="text-lg font-bold text-ink">{selectedVideo.title}</h3>
              <p className="mt-2 text-xs sm:text-sm text-muted leading-relaxed">
                {selectedVideo.description}
              </p>
              <div className="mt-3 flex items-center gap-2 text-xs font-medium text-slate-600">
                <User className="h-3.5 w-3.5 text-brand-600" />
                <span>Speaker: <strong>{selectedVideo.speaker}</strong></span>
              </div>
            </div>
          </div>
        ) : null}

        {/* Video Playlist Cards */}
        <div className="lg:col-span-5 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            More Patient Guides & Updates ({filteredVideos.length})
          </h4>
          <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
            {filteredVideos.map((video) => {
              const isCurrent = selectedVideo?.id === video.id;
              return (
                <div
                  key={video.id}
                  onClick={() => {
                    setSelectedVideo(video);
                  }}
                  className={`flex gap-3 p-3 rounded-xl border transition-all cursor-pointer text-left ${
                    isCurrent
                      ? "border-brand-500 bg-brand-50/50 shadow-2xs"
                      : "border-line bg-white hover:bg-slate-50 hover:border-slate-300"
                  }`}
                >
                  {/* Video Thumbnail Preview */}
                  <div className="relative w-28 shrink-0 aspect-video rounded-lg overflow-hidden bg-slate-900 border border-line">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolveVideoSource(video.videoUrl, video.youtubeId, video.thumbnailUrl).thumbnailUrl}
                      alt={video.title}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/10 transition-colors">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-brand-700 shadow-sm">
                        <Play className="h-3 w-3 fill-current ml-0.5" />
                      </span>
                    </div>
                    <span className="absolute bottom-1 right-1 px-1 rounded bg-black/75 text-[10px] font-mono text-white">
                      {video.duration}
                    </span>
                  </div>

                  {/* Title & Metadata */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-ink line-clamp-2 leading-snug">
                      {video.title}
                    </p>
                    <p className="text-[11px] text-muted mt-1 truncate">{video.speaker}</p>
                    <span className="inline-block mt-1 text-[10px] font-medium text-brand-700">
                      {video.category}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Video Modal Player (if user pops out video) */}
      {isModalOpen && selectedVideo ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative w-full max-w-3xl rounded-2xl bg-white p-2 shadow-2xl">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute -top-10 right-0 p-1 text-white hover:text-slate-200 cursor-pointer"
            >
              <X className="h-6 w-6" />
            </button>
            <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
              {(() => {
                const modalSource = resolveVideoSource(selectedVideo.videoUrl, selectedVideo.youtubeId, selectedVideo.thumbnailUrl);
                if (modalSource.type === "youtube" || modalSource.type === "vimeo") {
                  return (
                    <iframe
                      src={modalSource.embedUrl}
                      title={selectedVideo.title}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      className="h-full w-full border-0"
                    />
                  );
                }
                return (
                  <video
                    src={modalSource.embedUrl}
                    controls
                    autoPlay
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-contain"
                  />
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
