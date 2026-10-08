# Vercel deployment — env vars

Every value below goes in **Vercel → Project → Settings → Environment Variables**.
Mark all of them for **Production** *and* **Preview**, since the staging
deployment is the one being verified.

`deploy.yml` pushes these to the Worker with `wrangler secret put`. That is
Cloudflare-only — there is no automatic path to Vercel, so they are set by hand.

## Read-and-paste (values taken from repo variables, 2026-10-08)

| Variable | Value |
|---|---|
| `CANONICAL_URL` | `https://wokala.vip` |
| `DAILY_PUBLISH_CAP` | `10` |
| `IMAGE_BUCKET` | `article-images` |
| `MAX_IMAGE_BYTES` | `5242880` |
| `NEON_STORAGE_ENDPOINT` | `https://br-hidden-flower-b1raaq1l.storage.c-5.eu-central-1.aws.neon.tech` |
| `NEON_STORAGE_REGION` | `eu-central-1` |
| `SITE_URL` | `https://ai-agents-arabia.osotrad101.workers.dev` |
| `SITE_NAME` | `وكلاء` |
| `NODE_ENV` | leave unset — Vercel sets it |

## You must supply these

Their values are **write-only in GitHub and unrecoverable** — they cannot be
copied from anywhere. Take them from your own records or password manager.

| Variable | Notes |
|---|---|
| `DATABASE_URL` | the same **production** Neon pooler URL. Deliberately not a branch — one database, as agreed. |
| `AGENT_API_KEY` | same value as Cloudflare. Both deployments share one database, so a second key would need the same write access anyway. |
| `ADMIN_API_KEY` | same value as Cloudflare, or set a fresh one if you want to revoke admin on Vercel independently. |
| `INDEXNOW_KEY` | optional. Omit it and IndexNow submission is skipped; nothing else breaks. |
| `NEON_STORAGE_ACCESS_KEY_ID` | required for image upload. Without it `POST /api/v1/images` returns 503. |
| `NEON_STORAGE_SECRET_ACCESS_KEY` | as above. |

## Two to change before the first deploy

| Variable | Change to | Why |
|---|---|---|
| `EXTRA_ORIGINS` | `https://wokala.vip,https://www.wokala.vip,**https://<your-project>.vercel.app**` | `/api/mcp` rejects any `Origin` not on this list. Missing it returns 403. Note the check runs *after* auth, so a wrong key looks like a 401 and hides this. |
| `SITE_URL` | keep the workers.dev value during overlap | The MCP docs, sitemap and RSS derive from it. It is also the request origin the Worker validates, so changing it to the Vercel URL would break the Cloudflare deployment's own allowlist. Revisit at cutover. |

## Build settings

| Setting | Value |
|---|---|
| Framework preset | Next.js (auto-detected) |
| Install command | default — `packageManager: pnpm@12.6.0` is set, so Vercel uses pnpm |
| Build command | default — `pnpm build`, which is plain `next build` |
| Node version | 22 — pinned via `engines.node` |

There is **no** build-time database access: every content route is
`force-dynamic`, so the build does not need `DATABASE_URL` and cannot fail on
a cold Neon connection. Migrations are not run by Vercel — Cloudflare's
`deploy.yml` keeps doing that, and the schema is shared.

## Not needed on Vercel

`wrangler.jsonc`, `open-next.config.ts`, `CLOUDFLARE_API_TOKEN`,
`CLOUDFLARE_ACCOUNT_ID`. Vercel ignores the first two and has no use for the
last two.
