import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Extract { bucket, path } from a Supabase storage URL (public or signed).
 * Returns null if the URL is external or unrecognized.
 */
export function parseStorageUrl(url: string | null | undefined): { bucket: string; path: string } | null {
  if (!url) return null;
  // Match /storage/v1/object/{public|sign}/{bucket}/{path...}
  const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/([^?]+)/);
  if (!m) return null;
  try {
    return { bucket: decodeURIComponent(m[1]), path: decodeURIComponent(m[2]) };
  } catch {
    return { bucket: m[1], path: m[2] };
  }
}

const SIGNED_TTL = 60 * 60; // 1h
const cache = new Map<string, { url: string; expiresAt: number }>();

/**
 * Returns a signed URL for a private bucket object, given a stored URL that
 * may be either the legacy public URL or a bucket path. External URLs are
 * returned unchanged.
 */
export async function resolveStoragePhotoUrl(stored: string | null | undefined): Promise<string> {
  if (!stored) return "";
  const parsed = parseStorageUrl(stored);
  if (!parsed) return stored; // external URL or unknown format

  const key = `${parsed.bucket}/${parsed.path}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now + 60_000) return hit.url;

  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, SIGNED_TTL);
  if (error || !data?.signedUrl) return "";
  cache.set(key, { url: data.signedUrl, expiresAt: now + SIGNED_TTL * 1000 });
  return data.signedUrl;
}

/** React hook variant. */
export function useSignedPhotoUrl(stored: string | null | undefined): string {
  const [url, setUrl] = useState<string>(() => {
    if (!stored) return "";
    return parseStorageUrl(stored) ? "" : stored;
  });
  useEffect(() => {
    let cancelled = false;
    if (!stored) {
      setUrl("");
      return;
    }
    resolveStoragePhotoUrl(stored).then((u) => {
      if (!cancelled) setUrl(u);
    });
    return () => {
      cancelled = true;
    };
  }, [stored]);
  return url;
}
