/**
 * Neon Object Storage client (beta) — S3-compatible, same Neon credential as
 * the database.
 *
 * Implemented directly against the S3 REST API with SigV4 rather than pulling in
 * the AWS SDK: the Worker already runs on Web Crypto, and this is one fixed
 * request shape (PUT object), so a ~100-line signer beats a large dependency
 * tree in a cold-starting edge function.
 *
 * Neon requires path-style addressing, so keys are appended to the endpoint
 * path rather than going in the host.
 */

import {
  imageBucket,
  storageAccessKeyId,
  storageEndpoint,
  storagePublicBase,
  storageRegion,
  storageSecretAccessKey,
} from "./env";

const enc = new TextEncoder();

function hex(bytes: ArrayBuffer | Uint8Array): string {
  return [...new Uint8Array(bytes as ArrayBuffer)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Copy into a plain `ArrayBuffer`. TypeScript's `BufferSource` excludes
 * views whose backing buffer could be a `SharedArrayBuffer`, and the
 * `TextEncoder`/`Uint8Array` return types are not narrow enough to satisfy it.
 * A copy is cheap here and keeps the crypto calls free of casts.
 */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

/** HMAC returning raw bytes — the derived-key chain needs bytes, not hex. */
async function hmacBytes(key: ArrayBuffer, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message)));
}

/** AWS requires these five URI-encoded twice, everything else once. */
function encodeRfc3986(s: string): string {
  return s.replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

/** Canonical URI: path segments encoded, slashes preserved. */
function canonicalUri(pathname: string): string {
  return pathname
    .split("/")
    .map((seg) => encodeRfc3986(encodeURIComponent(seg)))
    .join("/");
}

/** `20260102T000000Z` */
function amzDate(d: Date): { full: string; short: string } {
  const full = d.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { full, short: full.slice(0, 8) };
}

export interface SignedRequest {
  url: string;
  headers: Record<string, string>;
}

/**
 * Sign a request with SigV4 (`AWS4-HMAC-SHA256`, `UNSIGNED-PAYLOAD`).
 *
 * `payloadHash` is supplied by the caller so it can be the real SHA-256 of the
 * body; `UNSIGNED-PAYLOAD` is passed through untouched when it is.
 */
export async function signRequest(opts: {
  method: string;
  pathname: string;
  host: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  payloadHash: string;
  contentType?: string;
  now?: Date;
}): Promise<SignedRequest> {
  const { method, region, accessKeyId, secretAccessKey } = opts;
  const { full: amzFull, short: amzShort } = amzDate(opts.now ?? new Date());
  const uri = canonicalUri(opts.pathname);

  const headers: Record<string, string> = {
    host: opts.host,
    "x-amz-content-sha256": opts.payloadHash,
    "x-amz-date": amzFull,
  };
  if (opts.contentType) headers["content-type"] = opts.contentType;

  // Headers must be lowercased and sorted for the canonical request.
  const sortedKeys = Object.keys(headers).sort();
  const canonicalHeaders = sortedKeys.map((k) => `${k}:${headers[k]}\n`).join("");
  const signedHeaders = sortedKeys.join(";");

  const canonicalRequest = [
    method,
    uri,
    "", // no query string on PUT object
    canonicalHeaders,
    signedHeaders,
    opts.payloadHash,
  ].join("\n");

  const scope = `${amzShort}/${region}/s3/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzFull,
    scope,
    hex(await crypto.subtle.digest("SHA-256", enc.encode(canonicalRequest))),
  ].join("\n");

  const kDate = await hmacBytes(
  toArrayBuffer(enc.encode(`AWS4${secretAccessKey}`)),
  amzShort,
);
  const kRegion = await hmacBytes(toArrayBuffer(kDate), region);
  const kService = await hmacBytes(toArrayBuffer(kRegion), "s3");
  const kSigning = await hmacBytes(toArrayBuffer(kService), "aws4_request");
  const signature = hex(await hmacBytes(toArrayBuffer(kSigning), stringToSign));

  headers.authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { url: `https://${opts.host}${uri}`, headers };
}

export function isStorageConfigured(): boolean {
  return Boolean(
    storageEndpoint() &&
      storageRegion() &&
      storageAccessKeyId() &&
      storageSecretAccessKey() &&
      imageBucket(),
  );
}

export interface PutResult {
  key: string;
  url: string;
  bytes: number;
}

export class StorageError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

/** Split an S3 endpoint into host + base path (Neon mounts it under a path). */
function splitEndpoint(endpoint: string): { host: string; basePath: string } {
  const url = new URL(endpoint);
  return {
    host: url.host,
    basePath: url.pathname.replace(/\/$/, ""),
  };
}

/** All storage settings in one object, narrowed so callers cannot see `undefined`. */
function requireConfig() {
  const endpoint = storageEndpoint();
  const region = storageRegion();
  const accessKeyId = storageAccessKeyId();
  const secretAccessKey = storageSecretAccessKey();
  const bucket = imageBucket();
  const publicBase = storagePublicBase();
  if (!endpoint || !region || !accessKeyId || !secretAccessKey || !bucket) {
    throw new StorageError(
      "object storage is not configured (see NEON_STORAGE_* and IMAGE_BUCKET)",
    );
  }
  return { endpoint, region, accessKeyId, secretAccessKey, bucket, publicBase };
}

/**
 * Public URL for a stored object.
 *
 * Prefers an explicit public base (a bucket served over its own domain); falls
 * back to the S3 endpoint, which only resolves for `public_read` buckets.
 * Private buckets need a presigned GET instead — not implemented here.
 */
export function publicUrlForKey(key: string): string {
  const { endpoint, bucket, publicBase } = requireConfig();
  if (publicBase) return `${publicBase.replace(/\/$/, "")}/${key}`;
  const { host, basePath } = splitEndpoint(endpoint);
  return `https://${host}${basePath}/${bucket}/${key}`;
}

/** Upload bytes as an object. Returns the key and its public URL. */
export async function putObject(opts: {
  key: string;
  body: Uint8Array;
  contentType: string;
  cacheControl?: string;
}): Promise<PutResult> {
  const cfg = requireConfig();
  const { host, basePath } = splitEndpoint(cfg.endpoint);
  const pathname = `${basePath}/${cfg.bucket}/${opts.key}`;

  const payloadHash = hex(
    await crypto.subtle.digest("SHA-256", toArrayBuffer(opts.body)),
  );

  const signed = await signRequest({
    method: "PUT",
    pathname,
    host,
    region: cfg.region,
    accessKeyId: cfg.accessKeyId,
    secretAccessKey: cfg.secretAccessKey,
    payloadHash,
    contentType: opts.contentType,
  });

  const headers: Record<string, string> = {
    ...signed.headers,
    "content-length": String(opts.body.byteLength),
  };
  if (opts.cacheControl) headers["cache-control"] = opts.cacheControl;

  const res = await fetch(signed.url, {
    method: "PUT",
    headers,
    // ArrayBuffer rather than the Uint8Array: BodyInit excludes views that
    // could be SharedArrayBuffer-backed.
    body: toArrayBuffer(opts.body),
  });
  if (!res.ok) {
    const detail = (await res.text().catch(() => "")).slice(0, 300);
    throw new StorageError(`object storage rejected the upload: ${detail}`, res.status);
  }

  return {
    key: opts.key,
    url: publicUrlForKey(opts.key),
    bytes: opts.body.byteLength,
  };
}