import { z } from "zod";

/**
 * Runtime environment. Everything is optional so the public site can boot and
 * degrade gracefully before infra is configured; feature code checks for the
 * specific value it needs.
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

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment variables:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();

