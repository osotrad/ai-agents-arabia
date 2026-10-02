# Operations runbook

Everything needed to configure, diagnose and publish to a deployment of this
site. Written while taking a production instance from "no content API at all"
to "one published article".

- [1. What the deployment is made of](#1-what-the-deployment-is-made-of)
- [2. Credentials](#2-credentials)
- [3. Database migrations](#3-database-migrations)
- [4. Diagnostics ladder](#4-diagnostics-ladder)
- [5. Publishing](#5-publishing)
- [6. The `*.workers.dev` reachability problem](#6-the-workersdev-reachability-problem)
- [7. Article images](#7-article-images)
- [8. Claim validation semantics](#8-claim-validation-semantics)
- [9. Human review](#9-human-review)
- [10. CI workflows](#10-ci-workflows)
- [11. Editorial decisions that are not obvious](#11-editorial-decisions-that-are-not-obvious)

---

## 1. What the deployment is made of

| Piece | Where it lives | Who controls it |
| --- | --- | --- |
| GitHub repository | `osotrad/ai-agents-arabia` | you |
| GitHub **secrets** | `AGENT_API_KEY`, `ADMIN_API_KEY`, `DATABASE_URL`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` | write-only after being set |
| GitHub **variable** | `SITE_URL` = the workers.dev origin | readable |
| Cloudflare Worker | name `ai-agents-arabia` | `.github/workflows/deploy.yml` |
| Worker **secrets** | copy of the GitHub secrets, pushed by the deploy | write-only |
| Neon Postgres | pointed at by `DATABASE_URL` | schema via Drizzle migrations |

Two facts that cause most of the trouble in this setup:

1. **GitHub secret values cannot be read back.** `gh secret list` shows names
   and timestamps only. Once you `gh secret set AGENT_API_KEY`, you cannot
   retrieve the value from GitHub — which means **you must record it
   yourself** if a machine is going to call the API directly.
2. **The deploy copies secrets to the Worker one at a time and silently skips
   the unset ones.** A secret missing from the repository is *not* an error;
   the deploy prints `skip (unset): NAME` and finishes green. That is exactly
   how an instance ended up serving a closed API while every deployment
   reported success.

## 2. Credentials

### Generate a key

```bash
# 48 hex chars of CSPRNG entropy — comfortably above the 16-char minimum the
# env schema enforces for AGENT_API_KEY / ADMIN_API_KEY.
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

### Store it and deploy

```bash
printf '%s' "$KEY" | gh secret set AGENT_API_KEY
printf '%s' "$KEY" > /tmp/agent_key.txt && chmod 600 /tmp/agent_key.txt  # you will need it again
gh variable set SITE_URL --body "https://ai-agents-arabia.osotrad101.workers.dev"
gh workflow run deploy.yml
```

Store the value somewhere durable (a password manager) at the same time. After
this, GitHub holds it and you hold it; neither will ever show it again.

### Verify the deploy actually set it

```bash
gh run view <run-id> --log | sed 's/\x1b\[[0-9;]*m//g' | grep -E "set secret:|skip \(unset\):"
```

Every line should read `set secret:`. Anything reading `skip (unset):` is a
credential that does not exist on the Worker. A green deploy does **not**
imply every secret was set — check this line specifically.

### What each key unlocks

| Key | Unlocks | Consequence of it being unset |
| --- | --- | --- |
| `AGENT_API_KEY` | all of `/api/v1/*` and `/api/mcp` | the content API is closed; the public site still works |
| `ADMIN_API_KEY` | `/admin/review` and `/api/admin/*` | the review queue is unreachable, so nothing can move out of `pending_review` |
| `INDEXNOW_KEY` | the IndexNow ping on publish | publishing still works; the ping is skipped |
| `DATABASE_URL` | everything dynamic | pages degrade to their empty states (by design, see `src/app/page.tsx`) |

The API is **fail-closed**: with no `AGENT_API_KEY`, every content route
returns `401`. That is the correct posture, but it means a missing secret
looks exactly like a wrong key from the outside.

### To close the API again

```bash
gh secret delete AGENT_API_KEY
gh workflow run deploy.yml
```

## 3. Database migrations

**Migrations now run on every deploy**, before the Worker is updated:

```yaml
- name: Apply database migrations
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
  run: pnpm db:migrate
```

`drizzle-kit migrate` is tracked in `drizzle.__drizzle_migrations`, so it is a
no-op once the schema is current. Running it before the deploy means code can
never ship against a schema that is behind it.

The failure this prevents is nasty to diagnose, because the site looks
perfectly healthy: reads are wrapped in `try/catch` and degrade to empty
states, so a database with **no tables at all** still renders the homepage, the
news index and the feed — all empty. The first write then fails with:

```
42P01  relation "sources" does not exist
```

To see the real schema state at any time:

```bash
curl -H "Authorization: Bearer $AGENT_API_KEY" "$SITE_URL/api/v1/health" | jq .schema
# { "missing": [], "ok": true }
```

`GET /health` performs a read-only `pg_tables` check and lists any expected
table that is absent. Check this first whenever writes fail.

Applying migrations by hand (local shell, against a real Neon URL):

```bash
DATABASE_URL='postgres://…' pnpm db:migrate
```

The first migration creates the `vector` extension. On Neon this generally just
works; on a plain local Postgres you must install pgvector first, otherwise
migrate stops on that statement and creates nothing (the file runs as one
transaction).

## 4. Diagnostics ladder

Work top-down. Each step is cheap and rules out a whole class of cause.

| Symptom | Meaning | Action |
| --- | --- | --- |
| `401` on every `/api/v1/*` and `/api/mcp` | the Worker has no `AGENT_API_KEY`, or the bearer is wrong | check the deploy log line (§2); confirm the key you hold matches |
| `422` `validation failed` | schema or editorial gate rejected the payload | read `issues[]` / `errors[]`; they name the field and the limit |
| `429` `daily publish cap reached` | 5 publishes in the last rolling 24h | wait, or review and archive something |
| `500` `internal error`, `42P01` | the database is missing a table | `GET /health` → `.schema.missing`; re-run the deploy to migrate |
| `500` on any write, `relation … does not exist` | migrations were never applied to this Neon instance | `gh workflow run deploy.yml` |
| TLS reset / `status 000` from `curl` | your network is filtering `*.workers.dev` | use the CI workflows (§5, §6) |

### Reading database errors

Two layers of wrapping sit between you and Postgres:

- Drizzle throws `Failed query: <sql>\nparams: …` and puts the real error in
  `error.cause`.
- The Worker console log is **not visible to the caller**, so anything only
  written there is invisible to whoever is publishing.

Both are now handled:

- `errorResponse()` (`src/lib/api.ts`) unwraps the `cause` chain and logs the
  driver code and message next to the query, so the Worker log explains itself.
- MCP `toolError()` (`src/app/api/mcp/route.ts`) returns the driver's `code`
  and `message` **to the caller** as `{"driver": {...}}`. The query text and
  parameters are deliberately kept server-side. This is why an MCP write that
  fails now tells you `42P01 relation "sources" does not exist` instead of a
  bare `Failed query`.

## 5. Publishing

### Directly, with the key

```bash
SITE=https://ai-agents-arabia.osotrad101.workers.dev
KEY=$(cat /tmp/agent_key.txt)

# 1. see the state before writing anything
curl -sH "Authorization: Bearer $KEY" "$SITE/api/v1/health" | jq '{articles, schema, config}'

# 2. dedupe against what is already published
curl -sH "Authorization: Bearer $KEY" "$SITE/api/v1/search?q=gemini" | jq '.articles[].slug'

# 3. dry run
curl -s -X POST "$SITE/api/v1/articles/validate" \
  -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \
  --data-binary @article.json | jq

# 4. create, then publish
curl -s -X POST "$SITE/api/v1/articles" \
  -H "Authorization: Bearer $KEY" -H 'content-type: application/json' \
  --data-binary @article.json | jq
curl -s -X POST "$SITE/api/v1/articles/gemini-4-argon-launch/publish" \
  -H "Authorization: Bearer $KEY" | jq
```

Use `mode` equivalents over MCP if you prefer: `validate_article`,
`create_article`, `publish_article`.

### Through CI, when the machine cannot reach the site

`gh workflow run publish-article.yml` takes the article as a base64 payload:

```bash
base64 -w0 article.json > article.b64
gh workflow run publish-article.yml \
  -f payload_b64="$(cat article.b64)" \
  -f mode=publish          # validate | create | publish

gh run watch
```

`mode: validate` runs `validate_article` only. `create` leaves the article in
`pending_review`. `publish` creates it, calls `publish_article`, then curls
`/news/{slug}` and fails the job if it is not `200`.

The payload is never written to the job log — only the tool response is.

## 6. The `*.workers.dev` reachability problem

On some networks (including the machine this repo is usually edited on),
`*.workers.dev` resets the TLS connection immediately after `Client hello`,
while `workers.dev` (apex), `blog.cloudflare.com`, `github.com` and everything
else work:

```
$ curl -v https://ai-agents-arabia.osotrad101.workers.dev/
* TLSv1.3 (OUT), TLS handshake, Client hello (1):
* Recv failure: Connection reset by peer
```

GitHub runners reach it fine — the deploy job's own smoke check curls the
deployed URL. So when this happens, **do not** route a content key through a
third-party proxy. Use the workflows in §9 instead: `publish-article.yml`,
`agent-probe.yml`, `fetch-page.yml`, `admin-session-check.yml`.

Quick triage:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://workers.dev/            # apex: 301
curl -s -o /dev/null -w '%{http_code}\n' https://blog.cloudflare.com/   # 200
curl -s -o /dev/null -w '%{http_code}\n' "$SITE/"                       # 000 => filtered
```

## 7. Article images

Header images are stored in **Neon Object Storage** (beta) and served from a
`public_read` bucket. Six settings are required; with any of them unset,
`POST /api/v1/images` returns `503` and the rest of the site is unaffected.

| Variable | Source |
| --- | --- |
| `NEON_STORAGE_ENDPOINT` | branch S3 endpoint from `neon deploy` |
| `NEON_STORAGE_REGION` | same |
| `NEON_STORAGE_ACCESS_KEY_ID` | same |
| `NEON_STORAGE_SECRET_ACCESS_KEY` | same |
| `IMAGE_BUCKET` | your bucket name |
| `IMAGE_PUBLIC_BASE` | optional; only if the bucket has its own public origin |

```
bucket must be public_read:  visible in images as <img>, usable as og:image
bucket private:              403 in the browser; upload still succeeds
```

Pass them to the Worker as secrets — they are credentials:

```bash
printf '%s' "$NEON_STORAGE_ACCESS_KEY_ID" | gh secret set NEON_STORAGE_ACCESS_KEY_ID
printf '%s' "$NEON_STORAGE_SECRET_ACCESS_KEY" | gh secret set NEON_STORAGE_SECRET_ACCESS_KEY
gh variable set NEON_STORAGE_ENDPOINT --body "$ENDPOINT"
gh variable set NEON_STORAGE_REGION  --body "$REGION"
gh variable set IMAGE_BUCKET         --body "article-images"
gh workflow run deploy.yml
```

Then extend the deploy's `put()` list so the credentials reach the Worker.

**The signer is hand-rolled** (`src/lib/storage.ts`) rather than pulling in the
AWS SDK, because a Worker cold-starts and the request shape is fixed. It was
cross-validated byte-for-byte against `aws4fetch` for GET on a bucket root,
GET with a `Range` header, and a path-style PUT — identical signatures in all
three. Two notes:

- Neon needs **path-style** addressing, so keys are appended to the endpoint
  path rather than the host, and `forcePathStyle` behaviour is built in.
- Our signer percent-encodes `+` (correct per SigV4: only `A-Z a-z 0-9 - . _ ~`
  are unreserved); `aws4fetch` leaves it literal. Object keys are therefore
  constrained to a safe ASCII set so the difference can never matter.

## 8. Claim validation semantics

`POST /api/v1/articles/validate` (MCP `validate_article`) returns
`{ok, errors, warnings}`. **Errors block the write; warnings do not.**

### Errors

- `type: "news"` with fewer than 2 sources
- claims supplied with no sources attached
- a `claim.sourceIndex` beyond the end of `sources`

### Warnings

1. **A number in the body that appears in no excerpt.** The regex is
   `[$€£]?\d[\d,]*(?:\.\d+)?[%$€£]?|\b20\d\d\b`, so currency, percentages,
   counts and years all count. Put every figure verbatim in an excerpt.
2. **A claim its excerpt does not support**, assessed by `assessClaimSupport()`
   in `src/lib/content.ts`. It has two regimes, because one rule cannot serve
   both:

   - **Same script** → normalized word-set overlap, threshold `0.2`.
     Normalization folds case, Arabic tashkēl (`U+064B–U+0652`), tatweel,
     the alef variants (`أ إ آ ٱ → ا`), `ة → ه`, `ى → ي`, and strips a leading
     definite article, so `المصادر` matches `مصادر` and `اَلْمَصَادِر` matches
     `المصادر`.
   - **Different script** → an Arabic claim citing an English excerpt has *zero*
     lexical overlap by construction. Comparing strings there produced a
     "weakly supported" warning on **every single claim** — pure noise. So
     lexical comparison is skipped and the check moves to the figures the
     claim asserts: a claim saying `70%` must find `70%` in its excerpt. A
     cross-language claim with no figures at all returns `unverifiable`, which
     produces no warning.

   Failure reasons in the warning text: `no-lexical-overlap`,
   `figure-not-in-excerpt`, `all-figures-missing`.

Live example of the current behaviour (one Arabic claim citing an English
excerpt):

```
"أرغون غير متاح على نطاق واسع…"                    → no warning (nothing checkable)
"رفعت جوجل حد الإخراج إلى 1M رمز مقابل 64K… $2"    → no warning (figures found)
"انخفضت التكلفة بنسبة 70% بحسب التقرير"             → all-figures-missing
```

## 9. Human review

The queue at `/admin/review` is auth-gated and `noindex`. It does not take the
key from the URL — a `?key=` value lands in browser history, referrer headers
and access logs.

```bash
# exchange the key for an HttpOnly session cookie (8h, SameSite=Strict)
curl -X POST "$SITE/api/admin/session" \
  -H 'content-type: application/json' -d "{\"key\":\"$ADMIN_KEY\"}" -D -
# → set-cookie: woklaa_admin_session=…; HttpOnly; SameSite=strict

curl -H "Cookie: woklaa_admin_session=$ADMIN_KEY" "$SITE/api/admin/review?status=pending_review"
curl -X DELETE "$SITE/api/admin/session"     # end the session
```

`GET /api/admin/review` accepts `status` from `pending_review`, `draft`,
`needs_recheck`, `published`, `archived` (anything else → `400`) and
`limit` (1–100).

Approving **publishes**, so it is subject to `DAILY_PUBLISH_CAP` exactly like
every other publish path — it returns `429` at the cap and the article stays in
`pending_review`. Rejecting archives and is not capped.

## 10. CI workflows

| Workflow | Trigger | Purpose |
| --- | --- | --- |
| `ci.yml` | push, PR | lint + typecheck + test + build |
| `deploy.yml` | push to `main`, dispatch | migrate → build → set Worker secrets → deploy → smoke check |
| `publish-article.yml` | dispatch | publish one article over MCP (`validate` / `create` / `publish`) |
| `agent-probe.yml` | dispatch | read-only MCP call — `health`, `context`, anything |
| `fetch-page.yml` | dispatch | fetch a live path and print its text |
| `admin-session-check.yml` | dispatch | verify the review session flow end to end |

The last four exist because of §6: they are the supported way to drive a
deployed instance from a host that cannot reach `*.workers.dev`.

```bash
gh workflow run agent-probe.yml -f tool=health -f arguments='{}'
gh workflow run fetch-page.yml  -f path=/news
gh workflow run admin-session-check.yml
```

None of them print a secret. `admin-session-check.yml` asserts the cookie is
`HttpOnly` and never writes the key to a file in the workspace.

## 11. Editorial decisions that are not obvious

**The public website does not say it is written by an AI agent, or reviewed by
a human.** The site presents as a straightforward Arabic publication about AI
agents. The automation lives entirely behind the API and the admin surface.

Concretely, these were removed from every rendered page and must not come back:

- "run by an agent" / "reviewed by a human" in the header bar, hero, footer
- the word `واجهة برمجية` (content API) in reader-facing copy
- links from the footer into `/api/v1/context`
- `/how-it-works` (an agent pipeline diagram) → replaced by `/standards`,
  written as ordinary editorial standards
- `/editor` (a page about a human editor being accountable for AI output) →
  replaced by `/about`, a plain about page

Reader-facing copy may still describe ordinary editorial practice — sources,
verification, scheduled re-checking, public corrections. What it must not do is
describe *who or what produces the text*.

The automation documentation is unaffected and stays in `AGENTS.md`,
`SKILL.md` and `docs/AGENT-INTEGRATION.md`.
