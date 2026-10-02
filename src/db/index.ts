import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { databaseUrl } from "@/lib/env";
import * as schema from "./schema";

const url =
  databaseUrl() ?? "postgres://user:pass@localhost:5432/placeholder";

export const db = drizzle(neon(url), { schema });
export * from "./schema";
