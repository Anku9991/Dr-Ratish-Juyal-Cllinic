import { route } from "@/lib/api";
import { z } from "zod";
import { videoStore, saveClinicVideo, type ClinicVideo } from "@/lib/firebase/videos";

const createVideoSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().trim().min(5, "Description must be at least 5 characters").max(2000),
  category: z.enum([
    "Clinic Information",
    "Doctor Introduction",
    "Patient Education",
    "Treatment Awareness",
    "Clinic Facilities",
    "Health Awareness",
    "Other",
  ]),
  videoUrl: z.string().trim().min(3, "Video URL or File URL is required"),
  speaker: z.string().trim().min(2, "Speaker / Presenter is required").max(100),
  duration: z.string().trim().default("3:00"),
  status: z.enum(["published", "draft"]).default("published"),
  isFeatured: z.boolean().optional(),
});

function extractYoutubeId(url: string): string | undefined {
  if (!url) return undefined;
  // If already an 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(url.trim())) return url.trim();

  // youtube.com/watch?v=... or youtu.be/... or embed/...
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/);
  return match ? match[1] : undefined;
}

export const GET = route({ roles: ["admin"] }, async () => {
  const videos = videoStore.list({ includeDrafts: true });
  return { videos };
});

export const POST = route(
  {
    roles: ["admin"],
    schema: createVideoSchema,
    limit: { name: "admin_video_post", max: 30, windowMs: 60_000, by: "user" },
  },
  async ({ body, user }) => {
    const id = `vid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const youtubeId = extractYoutubeId(body.videoUrl);

    const newVideo: ClinicVideo = {
      id,
      title: body.title,
      description: body.description,
      category: body.category,
      videoUrl: body.videoUrl,
      youtubeId,
      speaker: body.speaker,
      author: user?.fullName || "Staff Member",
      duration: body.duration || "4:00",
      status: body.status,
      uploadedAt: new Date().toISOString().slice(0, 10),
      isFeatured: Boolean(body.isFeatured),
      thumbnailUrl: youtubeId
        ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`
        : "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=400&q=80",
    };

    await saveClinicVideo(newVideo);
    return { ok: true, video: newVideo };
  }
);
