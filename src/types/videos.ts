export type VideoCategory =
  | "Clinic Information"
  | "Doctor Introduction"
  | "Patient Education"
  | "Treatment Awareness"
  | "Clinic Facilities"
  | "Health Awareness"
  | "Other";

export const VIDEO_CATEGORIES: VideoCategory[] = [
  "Clinic Information",
  "Doctor Introduction",
  "Patient Education",
  "Treatment Awareness",
  "Clinic Facilities",
  "Health Awareness",
  "Other",
];

export interface ClinicVideo {
  id: string;
  title: string;
  description: string;
  category: VideoCategory;
  videoUrl: string;
  youtubeId?: string;
  speaker: string;
  author: string;
  duration: string;
  status: "published" | "draft";
  uploadedAt: string;
  isFeatured?: boolean;
  thumbnailUrl?: string;
}
