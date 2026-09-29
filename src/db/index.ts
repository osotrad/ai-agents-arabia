import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";
import { env } from "@/lib/env";

/**
 * Serverless HTTP client — safe for Cloudflare Workers/Pages.
 * Only instantiated when DATABASE_URL is present; importing this module
 * without a configured database throws a clear error.
 */
function createDb() {
  if (!env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. Create a Neon project and add the connection string to .env",
    );
  }
  const sql = neon(env.DATABASE_URL);
  return drizzle(sql, { schema });
}

export type Db = ReturnType<typeof createDb>;

let cached: Db | null = null;

export function getDb(): Db {
  if (!cached) cached = createDb();
  return cached;
}
