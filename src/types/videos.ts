export interface ClinicVideo {
  id: string;
  title: string;
  description: string;
  youtubeId: string;
  speaker: string;
  category: "Doctor Profile" | "Neurology Care" | "Rehabilitation" | "Clinic Tour";
  duration: string;
  isFeatured?: boolean;
}
