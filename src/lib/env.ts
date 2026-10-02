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
  SITE_URL: z.string().url().default("http://localhost:3000"),
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
export function parseEnv(source: Record<string, unknown> = process.env): EnvSnapshot {
  const parsed = envSchema.safeParse(source);
  if (parsed.success) return { data: parsed.data, issues: [] };
  const issues = parsed.error.issues.map(
    (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
  );
  // Salvage the defaults so a single bad value cannot disable the whole site.
  const data = envSchema.safeParse({});
  return { data: data.success ? data.data : ({} as Env), issues };
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

export function siteName(): string {
  return env().SITE_NAME;
}

export function publishCap(): number {
  return env().DAILY_PUBLISH_CAP;
}

export function isProduction(): boolean {
  return env().NODE_ENV === "production";
}