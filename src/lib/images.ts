import { maxImageBytes } from "./env";
import { isStorageConfigured, putObject, StorageError } from "./storage";

/** Only formats an article header realistically needs. */
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type AllowedImageType = (typeof ALLOWED_TYPES)[number];

const EXTENSIONS: Record<AllowedImageType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Magic bytes, so a mislabelled or hostile payload is rejected before upload. */
function sniff(bytes: Uint8Array): AllowedImageType | null {
  if (bytes.length < 12) return null;
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if ([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => bytes[i] === b)) {
    return "image/png";
  }
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  // WebP: "RIFF" .... "WEBP"
  if (
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

/**
 * Object keys stay in a conservative ASCII set. Besides keeping URLs tidy, it
 * sidesteps SigV4 canonical-URI encoding differences for exotic characters —
 * implementations disagree on whether `+` needs escaping, so the key never
 * contains anything that would make the request ambiguous.
 */
export function buildImageKey(slug: string, contentType: AllowedImageType): string {
  const safe = slug
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const unique = crypto.randomUUID().slice(0, 8);
  return `articles/${safe || "image"}-${unique}.${EXTENSIONS[contentType]}`;
}

export class ImageError extends Error {
  constructor(
    message: string,
    readonly status = 422,
  ) {
    super(message);
    this.name = "ImageError";
  }
}

/** Decode base64 strictly — `atob` tolerates junk we do not want to store. */
function decodeBase64(data: string): Uint8Array {
  const cleaned = data.replace(/\s+/g, "");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cleaned) || cleaned.length % 4 !== 0) {
    throw new ImageError("dataBase64 is not valid base64");
  }
  let binary: string;
  try {
    binary = atob(cleaned);
  } catch {
    throw new ImageError("dataBase64 is not valid base64");
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export interface UploadedImage {
  key: string;
  url: string;
  contentType: AllowedImageType;
  bytes: number;
}

/**
 * Store an image for use as an article header.
 *
 * `dataBase64` is used rather than multipart so an agent can post plain JSON
 * over the same endpoint it already uses for everything else.
 */
export async function uploadArticleImage(input: {
  slug: string;
  dataBase64: string;
  contentType?: string;
  alt?: string;
}): Promise<UploadedImage> {
  if (!isStorageConfigured()) {
    throw new ImageError(
      "object storage is not configured (NEON_STORAGE_* and IMAGE_BUCKET are unset)",
      503,
    );
  }

  const limit = maxImageBytes();
  const bytes = decodeBase64(input.dataBase64);
  if (bytes.byteLength === 0) throw new ImageError("image is empty");
  if (bytes.byteLength > limit) {
    throw new ImageError(
      `image is ${bytes.byteLength} bytes, over the ${limit} byte limit`,
      413,
    );
  }

  // The declared type is a hint only; the bytes decide.
  const sniffed = sniff(bytes);
  if (!sniffed) {
    throw new ImageError(
      `unsupported image data — expected ${ALLOWED_TYPES.join(", ")}`,
    );
  }
  if (input.contentType && input.contentType !== sniffed) {
    throw new ImageError(
      `declared contentType "${input.contentType}" does not match the actual data (${sniffed})`,
    );
  }

  const key = buildImageKey(input.slug || "article", sniffed);
  const stored = await putObject({
    key,
    body: bytes,
    contentType: sniffed,
    cacheControl: "public, max-age=31536000, immutable",
  });

  return {
    key: stored.key,
    url: stored.url,
    contentType: sniffed,
    bytes: stored.bytes,
  };
}

export { StorageError, ALLOWED_TYPES };