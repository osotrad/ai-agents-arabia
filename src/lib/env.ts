import { z } from "zod";

/**
 * Runtime environment — the single source of truth for configuration.
 *
 * Every value is optional so the public site can still boot and degrade
 * gracefully before infra is configured; feature code asks for the specific
 * value it needs through the accessors below instead of touching
 * `process.env` directly. Validation never throws at import time — a broken
 * value must not take the whole site down — problems are collected and
 * surfaced through `envIssues()` on the health endpoints instead.
 */
const envSchema = z.object({
  DATABASE_URL: z.string().url().optional(),
  /** Human reviewer key — approves/rejects drafts. */
  ADMIN_API_KEY: z.string().min(16).optional(),
  /** Bearer token the external agent uses against /api/v1 and /api/mcp. */
  AGENT_API_KEY: z.string().min(16).optional(),
  INDEXNOW_KEY: z.string().min(8).optional(),
  // --- Neon Object Storage (S3-compatible) ---
  /** Branch endpoint, e.g. https://<id>.storage.<region>.neon.build/<bucket-path> */
  NEON_STORAGE_ENDPOINT: z.string().url().optional(),
  NEON_STORAGE_REGION: z.string().min(1).optional(),
  NEON_STORAGE_ACCESS_KEY_ID: z.string().min(8).optional(),
  NEON_STORAGE_SECRET_ACCESS_KEY: z.string().min(8).optional(),
  /** Bucket that holds generated images. Must be public_read to serve <img>. */
  IMAGE_BUCKET: z.string().min(3).max(63).optional(),
  /** Public origin serving IMAGE_BUCKET, if it has one; else the S3 endpoint is used. */
  IMAGE_PUBLIC_BASE: z.string().url().optional(),
  /** Max bytes accepted per image upload (default 5 MB). */
  MAX_IMAGE_BYTES: z.coerce.number().int().positive().default(5_242_880),
  SITE_URL: z.string().url().default("http://localhost:3000"),
  /**
   * Canonical origin, used for canonical tags, sitemap and RSS. May differ
   * from SITE_URL when a vanity domain fronts the Worker — see
   * EXTRA_ORIGINS for every additional origin that is allowed to call /api/mcp.
   */
  CANONICAL_URL: z.string().url().optional(),
  /**
   * Extra browser origins permitted to call /api/mcp, comma-separated.
   * Required when the site is reachable on more than one host: the MCP route
   * rejects any `Origin` header that is not localhost or SITE_URL's origin, so
   * a second domain fails with 403 even with a valid bearer token.
   */
  EXTRA_ORIGINS: z.string().optional(),
  SITE_NAME: z.string().default("وكلاء"),
  /** Max articles the agent may auto-publish per rolling 24h. */
  DAILY_PUBLISH_CAP: z.coerce.number().int().positive().default(5),
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
});

export type Env = z.infer<typeof envSchema>;

export interface EnvSnapshot {
  data: Env;
  issues: string[];
}

/** Parse + validate without throwing; invalid keys fall back to defaults. */
export function parseEnv(
  source: Record<string, unknown> = process.env,
): EnvSnapshot {
  const parsed = envSchema.safeParse(source);
  if (parsed.success) return { data: parsed.data, issues: [] };

  const issues = parsed.error.issues.map(
    (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
  );

  // Salvage per key rather than discarding the lot: one malformed value (a short
  // INDEXNOW_KEY, say) must not silently drop DATABASE_URL and leave the whole
  // site reading from a placeholder and rendering empty pages.
  const salvaged: Record<string, unknown> = {};
  for (const [key, schema] of Object.entries(envSchema.shape)) {
    const single = schema.safeParse(source[key]);
    if (single.success) salvaged[key] = single.data;
  }

  const merged = envSchema.safeParse(salvaged);
  return {
    data: merged.success ? merged.data : ({} as Env),
    issues,
  };
}

let cached: EnvSnapshot | null = null;

function snapshot(): EnvSnapshot {
  if (!cached) cached = parseEnv(process.env);
  return cached;
}

/** Drop the memoised snapshot — tests mutate `process.env` between cases. */
export function resetEnv(): void {
  cached = null;
}

export function env(): Env {
  return snapshot().data;
}

/** Human-readable configuration problems; empty when everything is valid. */
export function envIssues(): string[] {
  return snapshot().issues;
}

export function databaseUrl(): string | undefined {
  return env().DATABASE_URL;
}

export function agentApiKey(): string | undefined {
  return env().AGENT_API_KEY;
}

export function adminApiKey(): string | undefined {
  return env().ADMIN_API_KEY;
}

export function indexNowKey(): string | undefined {
  return env().INDEXNOW_KEY;
}

export function siteUrl(): string {
  return env().SITE_URL;
}

/** Canonical origin for metadata. Falls back to SITE_URL when unset. */
export function canonicalUrl(): string {
  return env().CANONICAL_URL ?? env().SITE_URL;
}

/**
 * Comma-separated extra origins allowed to call /api/mcp. Empty when unset,
 * which is the correct state for a single-domain deployment.
 */
export function extraOrigins(): string | undefined {
  return env().EXTRA_ORIGINS;
}

export function siteName(): string {
  return env().SITE_NAME;
}

export function publishCap(): number {
  return env().DAILY_PUBLISH_CAP;
}

export function storageEndpoint(): string | undefined {
  return env().NEON_STORAGE_ENDPOINT;
}

export function storageRegion(): string | undefined {
  return env().NEON_STORAGE_REGION;
}

export function storageAccessKeyId(): string | undefined {
  return env().NEON_STORAGE_ACCESS_KEY_ID;
}

export function storageSecretAccessKey(): string | undefined {
  return env().NEON_STORAGE_SECRET_ACCESS_KEY;
}

export function imageBucket(): string | undefined {
  return env().IMAGE_BUCKET;
}

export function storagePublicBase(): string | undefined {
  return env().IMAGE_PUBLIC_BASE;
}

export function maxImageBytes(): number {
  return env().MAX_IMAGE_BYTES;
}

export function isProduction(): boolean {
  return env().NODE_ENV === "production";
}