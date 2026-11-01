import type { Metadata } from "next";
import { listClinicVideos } from "@/lib/firebase/videos";
import { ClinicVideosSection } from "@/components/client/ClinicVideosSection";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Clinical Videos & Patient Guidance",
  description: "Neurological health education, stroke awareness, and rehabilitation videos from Dr. Ratish Juyal Clinic Lucknow.",
};

export default async function VideosPage() {
  const videos = await listClinicVideos();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clinical Videos & Patient Education"
        description="Watch informative medical talks, stroke symptoms guides, and physiotherapy routines by Dr. Ratish Juyal and our neurology team."
      />

      <ClinicVideosSection initialVideos={videos} />
    </div>
  );
}
