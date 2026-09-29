import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const url =
  process.env.DATABASE_URL ??
  "postgres://user:pass@localhost:5432/placeholder";

export const db = drizzle(neon(url), { schema });
export * from "./schema";
