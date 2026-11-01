import "server-only";
import { supabaseAdmin } from "./supabase/admin";

export const BUCKET_PRESCRIPTIONS = "prescriptions";
export const BUCKET_ASSETS = "clinic-assets";

export async function uploadBytes(bucket: string, path: string, bytes: Uint8Array | Buffer, contentType: string): Promise<void> {
  const { error } = await supabaseAdmin().storage.from(bucket).upload(path, bytes, { contentType, upsert: true });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
}

export async function downloadBytes(bucket: string, path: string): Promise<Uint8Array | null> {
  const { data, error } = await supabaseAdmin().storage.from(bucket).download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

export async function signedUrl(bucket: string, path: string | null | undefined, seconds = 3600): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabaseAdmin().storage.from(bucket).createSignedUrl(path, seconds);
  if (error) return null;
  return data.signedUrl;
}

export function imageKind(bytes: Uint8Array): "png" | "jpg" | null {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  return null;
}
