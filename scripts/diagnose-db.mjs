#!/usr/bin/env node
/**
 * Diagnose a Postgres URL for a serverless deployment.
 *
 * Usage: node diagnose-db.mjs /path/to/url-file
 *
 * Never prints a password. Compares the candidate against the known-good
 * production URL so the difference is visible rather than guessed at.
 *
 * The connection is attempted with @neondatabase/serverless — the same driver
 * the app uses — because a URL can satisfy `psql` and still fail over HTTP,
 * which is the only path a Vercel function has.
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const file = process.argv[2] ?? "/tmp/dburl.txt";
const raw = readFileSync(file, "utf8").trim();

function redact(u) {
  try {
    const p = new URL(u);
    const h = createHash("sha256").update(p.password || "").digest("hex").slice(0, 8);
    return `${p.protocol}//${p.username}${p.password ? `:***(${h})` : ":<no-password>"}@${p.host}${p.pathname}${p.search}`;
  } catch {
    return "<unparseable>";
  }
}

function describe(label, u) {
  console.log(`\n── ${label}`);
  let p;
  try {
    p = new URL(u);
  } catch {
    console.log("   UNPARSEABLE — this is not a valid URL");
    return null;
  }
  const checks = {
    "has password": Boolean(p.password),
    "has username": Boolean(p.username),
    "sslmode present": p.searchParams.has("sslmode"),
    "sslmode=require": p.searchParams.get("sslmode") === "require",
    "is -pooler- host": p.hostname.includes("-pooler-"),
    "sslmode absent": !p.searchParams.has("sslmode"),
    "channel_binding": p.searchParams.get("channel_binding") ?? "(none)",
  };
  for (const [k, v] of Object.entries(checks)) console.log(`   ${k.padEnd(20)} ${v}`);
  console.log(`   redacted           ${redact(u)}`);
  return p;
}

const cand = raw;
const prod = (() => {
  try {
    const env = readFileSync(".env.local", "utf8");
    const m = env.match(/^DATABASE_URL=(.*)$/m);
    return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
  } catch {
    return null;
  }
})();

console.log("=".repeat(66));
console.log("CANDIDATE");
describe("the URL under test", cand);
if (prod) describe("production (known good)", prod);
else console.log("\n(production URL unavailable for comparison)");

// Live test against the candidate, using the app's own driver.
// @neondatabase/serverless exposes the factory as the default export; the
// dynamic-import namespace object needs unwrapping before it is callable.
let neon;
try {
  const mod = await import("@neondatabase/serverless");
  neon = mod.default ?? mod.neon;
  if (typeof neon !== "function") {
    console.log("\ncould not resolve a callable `neon`; exports:", Object.keys(mod).join(", "));
    process.exit(0);
  }
} catch (e) {
  console.log(`\n@neondatabase/serverless not usable here (${e.message}) — skipping live test.`);
  process.exit(0);
}

console.log(`\n── live query against the candidate`);
try {
  const sql = neon(cand);
  const rows = await sql`SELECT current_database() AS db, count(*)::int AS n FROM articles`;
  const db = rows[0]?.db ?? "?";
  const n = rows[0]?.n ?? "?";
  console.log(`   CONNECTED  database=${db}  articles=${n}`);
  if (n === 0) {
    console.log("\n   >>> This URL reaches the database but it has no articles.");
    console.log("       It is not the production database.");
  }
} catch (err) {
  const e = err;
  console.log(`   FAILED  ${e?.code || e?.name || "Error"}: ${e?.message || String(e)}`);
  if (/ENOTFOUND|ETIMEDOUT|ECONNREFUSED|fetch failed/i.test(e?.message || "")) {
    console.log("\n   >>> Network-level failure. Neon is reached over HTTP, so this");
    console.log("       is DNS, egress or TLS — not the password.");
  } else if (/password|auth|authentication|role/i.test(e?.message || "")) {
    console.log("\n   >>> Authentication failure. The password or username is wrong.");
  }
}

// Same test against production, to show what success looks like.
if (prod) {
  console.log(`\n── live query against production (control)`);
  try {
    const sql = neon(prod);
    const rows = await sql`SELECT count(*)::int AS n FROM articles`;
    console.log(`   CONNECTED  articles=${rows[0]?.n}`);
  } catch (err) {
    console.log(`   FAILED  ${err?.code || "Error"}: ${err?.message || String(err)}`);
  }
}
console.log("=".repeat(66));
