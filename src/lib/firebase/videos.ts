import { db } from "./config";
import { doc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import type { ClinicVideo, VideoCategory } from "@/types/videos";
export type { ClinicVideo, VideoCategory };

export const DEFAULT_CLINIC_VIDEOS: ClinicVideo[] = [
  {
    id: "dr-ratish-juyal-intro",
    title: "Meet Dr. Ratish Juyal — Senior Consultant Neurologist, Lucknow",
    description: "Overview of superspeciality clinical expertise (KGMU DM Neurology) in treating Brain, Spine, Stroke, Epilepsy, and Parkinson's disorders.",
    category: "Doctor Introduction",
    videoUrl: "https://www.youtube.com/watch?v=v8ZpHj4C96c",
    youtubeId: "v8ZpHj4C96c",
    speaker: "Dr. Ratish Juyal (MD, DM Neurology)",
    author: "Clinic Media Team",
    duration: "4:15",
    status: "published",
    uploadedAt: "2026-10-01",
    isFeatured: true,
  },
  {
    id: "stroke-fast-signs",
    title: "Stroke Care & The Golden Hour: Emergency Neurological Treatment",
    description: "Learn how to spot early symptoms of brain paralysis (F.A.S.T. signs) and the crucial emergency steps to take within 4.5 hours.",
    category: "Health Awareness",
    videoUrl: "https://www.youtube.com/watch?v=r2F_q_8l56o",
    youtubeId: "r2F_q_8l56o",
    speaker: "Dr. Ratish Juyal",
    author: "Staff Reception",
    duration: "6:20",
    status: "published",
    uploadedAt: "2026-10-05",
    isFeatured: true,
  },
  {
    id: "neuro-physiotherapy-rehab",
    title: "Post-Stroke & Spine Rehabilitation with Dr. Amit K. Sharma (PT)",
    description: "Neuro-physiotherapy techniques for motor recovery after paralysis, sciatica, slip disc, cervical spondylosis, and mobility restoration.",
    category: "Treatment Awareness",
    videoUrl: "https://www.youtube.com/watch?v=J1Z16Kq-HnQ",
    youtubeId: "J1Z16Kq-HnQ",
    speaker: "Dr. Amit K. Sharma (MPT Neuro)",
    author: "Rehab Dept",
    duration: "5:10",
    status: "published",
    uploadedAt: "2026-10-10",
  },
  {
    id: "migraine-epilepsy-care",
    title: "Chronic Migraine, Cluster Headaches & Seizure Management",
    description: "Comprehensive guidance on understanding headache triggers, modern prophylactic treatment, and seizure management.",
    category: "Patient Education",
    videoUrl: "https://www.youtube.com/watch?v=Hh1RZsWzL34",
    youtubeId: "Hh1RZsWzL34",
    speaker: "Dr. Ratish Juyal",
    author: "Neurology OPD",
    duration: "7:05",
    status: "published",
    uploadedAt: "2026-10-12",
  },
  {
    id: "clinic-facilities-tour",
    title: "State-of-the-Art Neuro-Diagnostic & Rehabilitation Facilities",
    description: "A walkthrough of our computerized EMG/NCV lab, physiotherapy gait training studio, and specialized stroke recovery cabins.",
    category: "Clinic Facilities",
    videoUrl: "https://www.youtube.com/watch?v=v8ZpHj4C96c",
    youtubeId: "v8ZpHj4C96c",
    speaker: "Clinic Tour Team",
    author: "Clinic Operations",
    duration: "3:45",
    status: "published",
    uploadedAt: "2026-10-18",
  },
  {
    id: "clinic-information-opd-guidelines",
    title: "OPD Consultation Guidelines & Token Procedure (12 PM - 5 PM)",
    description: "Important patient instructions on arrival, token collection, cash at counter payment, and consultation cabin allocation.",
    category: "Clinic Information",
    videoUrl: "https://www.youtube.com/watch?v=r2F_q_8l56o",
    youtubeId: "r2F_q_8l56o",
    speaker: "Reception Staff",
    author: "Staff Reception",
    duration: "2:30",
    status: "published",
    uploadedAt: "2026-10-20",
  },
];

// In-memory store
class ClinicVideosStore {
  private videos: ClinicVideo[] = [...DEFAULT_CLINIC_VIDEOS];

  public list(options?: { includeDrafts?: boolean }): ClinicVideo[] {
    if (options?.includeDrafts) {
      return [...this.videos];
    }
    return this.videos.filter((v) => v.status === "published");
  }

  public getById(id: string): ClinicVideo | null {
    return this.videos.find((v) => v.id === id) || null;
  }

  public add(video: ClinicVideo): ClinicVideo {
    this.videos.unshift(video);
    return video;
  }

  public update(id: string, updates: Partial<ClinicVideo>): ClinicVideo | null {
    const idx = this.videos.findIndex((v) => v.id === id);
    if (idx === -1) return null;
    this.videos[idx] = { ...this.videos[idx]!, ...updates };
    return this.videos[idx]!;
  }

  public delete(id: string): boolean {
    const idx = this.videos.findIndex((v) => v.id === id);
    if (idx === -1) return false;
    this.videos.splice(idx, 1);
    return true;
  }
}

const globalVideoStore =
  (globalThis as unknown as { __clinicVideoStore?: ClinicVideosStore }).__clinicVideoStore ??
  new ClinicVideosStore();
(globalThis as unknown as { __clinicVideoStore?: ClinicVideosStore }).__clinicVideoStore = globalVideoStore;

export const videoStore = globalVideoStore;

/** Fetch clinic videos */
export async function listClinicVideos(options?: { includeDrafts?: boolean }): Promise<ClinicVideo[]> {
  try {
    const snap = await getDocs(collection(db, "clinic_videos"));
    if (!snap.empty) {
      for (const d of snap.docs) {
        const item = { id: d.id, ...(d.data() as object) } as ClinicVideo;
        if (!videoStore.getById(item.id)) {
          videoStore.add(item);
        } else {
          videoStore.update(item.id, item);
        }
      }
    }
  } catch (err) {
    console.warn("Error reading videos from Firestore:", err);
  }
  return videoStore.list(options);
}

/** Save or update a video */
export async function saveClinicVideo(video: ClinicVideo): Promise<void> {
  const existing = videoStore.getById(video.id);
  if (existing) {
    videoStore.update(video.id, video);
  } else {
    videoStore.add(video);
  }

  try {
    const docRef = doc(db, "clinic_videos", video.id);
    await setDoc(docRef, video, { merge: true });
  } catch (err) {
    console.warn("Firestore save video fallback:", err);
  }
}

/** Delete a video */
export async function removeClinicVideo(id: string): Promise<void> {
  videoStore.delete(id);
  try {
    await deleteDoc(doc(db, "clinic_videos", id));
  } catch (err) {
    console.warn("Firestore delete video fallback:", err);
  }
}
