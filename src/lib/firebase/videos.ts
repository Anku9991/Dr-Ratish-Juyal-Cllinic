import { db } from "./config";
import { collection, doc, getDocs, setDoc, deleteDoc } from "firebase/firestore";
import type { ClinicVideo } from "@/types/videos";
export type { ClinicVideo };

export const DEFAULT_CLINIC_VIDEOS: ClinicVideo[] = [
  {
    id: "dr-ratish-juyal-intro",
    title: "Meet Dr. Ratish Juyal — Senior Consultant Neurologist, Lucknow",
    description: "Overview of superspeciality clinical expertise (KGMU DM Neurology) in treating Brain, Spine, Stroke, Epilepsy, and Parkinson's disorders.",
    youtubeId: "v8ZpHj4C96c",
    speaker: "Dr. Ratish Juyal (MD, DM Neurology)",
    category: "Doctor Profile",
    duration: "4:15",
    isFeatured: true,
  },
  {
    id: "stroke-fast-signs",
    title: "Stroke Care & The Golden Hour: Emergency Neurological Treatment",
    description: "Learn how to spot early symptoms of brain paralysis (F.A.S.T. signs) and the crucial emergency steps to take within 4.5 hours.",
    youtubeId: "r2F_q_8l56o",
    speaker: "Dr. Ratish Juyal",
    category: "Neurology Care",
    duration: "6:20",
    isFeatured: true,
  },
  {
    id: "neuro-physiotherapy-rehab",
    title: "Post-Stroke & Spine Rehabilitation with Dr. Amit K. Sharma (PT)",
    description: "Neuro-physiotherapy techniques for motor recovery after paralysis, sciatica, slip disc, cervical spondylosis, and mobility restoration.",
    youtubeId: "J1Z16Kq-HnQ",
    speaker: "Dr. Amit K. Sharma (MPT Neuro)",
    category: "Rehabilitation",
    duration: "5:10",
  },
  {
    id: "migraine-epilepsy-care",
    title: "Chronic Migraine, Cluster Headaches & Seizure Management",
    description: "Comprehensive guidance on understanding headache triggers, modern prophylactic treatment, and seizure management.",
    youtubeId: "Hh1RZsWzL34",
    speaker: "Dr. Ratish Juyal",
    category: "Neurology Care",
    duration: "7:05",
  },
];

let cachedVideos: ClinicVideo[] | null = null;
let lastVideosFetch = 0;

/** Fetch clinic videos with instant in-memory cache */
export async function listClinicVideos(): Promise<ClinicVideo[]> {
  const now = Date.now();
  if (cachedVideos && now - lastVideosFetch < 60_000) {
    return cachedVideos;
  }

  const fetchPromise = async (): Promise<ClinicVideo[]> => {
    try {
      const snap = await getDocs(collection(db, "clinic_videos"));
      if (!snap.empty) {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) } as ClinicVideo));
        if (list.length > 0) {
          cachedVideos = list;
          lastVideosFetch = Date.now();
          return list;
        }
      }
    } catch {
      // Offline fallback
    }
    return DEFAULT_CLINIC_VIDEOS;
  };

  const timeoutPromise = new Promise<ClinicVideo[]>((resolve) => {
    setTimeout(() => resolve(cachedVideos || DEFAULT_CLINIC_VIDEOS), 250);
  });

  const result = await Promise.race([fetchPromise(), timeoutPromise]);
  cachedVideos = result;
  lastVideosFetch = now;
  return result;
}

/** Save or update a video in Firestore */
export async function saveClinicVideo(video: ClinicVideo): Promise<void> {
  const docRef = doc(db, "clinic_videos", video.id);
  await setDoc(docRef, video, { merge: true });
}

/** Delete a video */
export async function removeClinicVideo(id: string): Promise<void> {
  try {
    await deleteDoc(doc(db, "clinic_videos", id));
  } catch (err) {
    console.error("Error deleting video:", err);
  }
}
