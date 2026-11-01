import { route } from "@/lib/api";
import { z } from "zod";
import { videoStore, saveClinicVideo, removeClinicVideo } from "@/lib/firebase/videos";
import { HttpError } from "@/lib/errors";

const updateVideoSchema = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().min(5).max(2000).optional(),
  category: z
    .enum([
      "Clinic Information",
      "Doctor Introduction",
      "Patient Education",
      "Treatment Awareness",
      "Clinic Facilities",
      "Health Awareness",
      "Other",
    ])
    .optional(),
  videoUrl: z.string().trim().min(3).optional(),
  speaker: z.string().trim().min(2).max(100).optional(),
  duration: z.string().trim().optional(),
  status: z.enum(["published", "draft"]).optional(),
  isFeatured: z.boolean().optional(),
});

function extractYoutubeId(url: string): string | undefined {
  if (!url) return undefined;
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : undefined;
}

export const PUT = route(
  {
    roles: ["admin"],
    schema: updateVideoSchema,
    limit: { name: "admin_video_put", max: 30, windowMs: 60_000, by: "user" },
  },
  async ({ params, body }) => {
    const id = params.id ?? "";
    const existing = videoStore.getById(id);
    if (!existing) throw new HttpError(404, "not_found", "Video not found.");

    const youtubeId = body.videoUrl ? extractYoutubeId(body.videoUrl) : existing.youtubeId;

    const updated = {
      ...existing,
      ...body,
      youtubeId,
      thumbnailUrl: youtubeId
        ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`
        : existing.thumbnailUrl,
    };

    await saveClinicVideo(updated);
    return { ok: true, video: updated };
  }
);

export const DELETE = route(
  {
    roles: ["admin"],
    limit: { name: "admin_video_del", max: 30, windowMs: 60_000, by: "user" },
  },
  async ({ params }) => {
    const id = params.id ?? "";
    const existing = videoStore.getById(id);
    if (!existing) throw new HttpError(404, "not_found", "Video not found.");

    await removeClinicVideo(id);
    return { ok: true, deletedId: id };
  }
);
