import "server-only";
import { HttpError } from "./errors";
import { imageKind } from "./storage";

const MAX_BYTES = 1024 * 1024;

/** Reads a PNG/JPEG upload from multipart form data, checking the real bytes rather than the file name. */
export async function readImageUpload(req: Request): Promise<{ bytes: Uint8Array; kind: "png" | "jpg" }> {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) throw new HttpError(422, "file_required", "Choose an image to upload.");
  if (file.size > MAX_BYTES) throw new HttpError(413, "file_too_large", "The image must be smaller than 1 MB.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = imageKind(bytes);
  if (!kind) throw new HttpError(415, "unsupported_type", "Upload a PNG or JPEG image.");
  return { bytes, kind };
}
