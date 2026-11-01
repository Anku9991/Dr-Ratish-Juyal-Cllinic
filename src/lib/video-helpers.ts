/**
 * Robust video source extractor and resolver for YouTube, Vimeo, and direct MP4/WebM videos.
 */

export function extractYoutubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();

  // Pure 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  // Matches youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID, youtube.com/shorts/ID, etc.
  const regExp = /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{11})/;
  const match = trimmed.match(regExp);
  if (match && match[1]) {
    return match[1];
  }

  // Fallback: parse URL parameters
  try {
    const fullUrl = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    const parsed = new URL(fullUrl);
    if (parsed.searchParams.has("v")) {
      const v = parsed.searchParams.get("v");
      if (v && v.length === 11) return v;
    }
    // Check path for /shorts/ID or /embed/ID
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length >= 2 && (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "v")) {
      if (parts[1] && parts[1].length === 11) return parts[1];
    }
  } catch {
    // Ignore URL parse error
  }

  return null;
}

export function extractVimeoId(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.trim().match(/(?:vimeo\.com\/)(\d+)/);
  return match && match[1] ? match[1] : null;
}

export interface ResolvedVideoSource {
  type: "youtube" | "vimeo" | "native";
  embedUrl: string;
  thumbnailUrl: string;
}

export function resolveVideoSource(videoUrl: string, youtubeId?: string, customThumbnail?: string): ResolvedVideoSource {
  // 1. YouTube check
  const ytId = youtubeId || extractYoutubeId(videoUrl);
  if (ytId) {
    return {
      type: "youtube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${ytId}?autoplay=1&rel=0&modestbranding=1`,
      thumbnailUrl: customThumbnail || `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`,
    };
  }

  // 2. Vimeo check
  const vimeoId = extractVimeoId(videoUrl);
  if (vimeoId) {
    return {
      type: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${vimeoId}?autoplay=1`,
      thumbnailUrl: customThumbnail || "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=400&q=80",
    };
  }

  // 3. Native MP4, WebM, MOV, or local upload
  return {
    type: "native",
    embedUrl: videoUrl,
    thumbnailUrl: customThumbnail || "https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=400&q=80",
  };
}
