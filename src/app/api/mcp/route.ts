import {
  createMcpHandler,
  McpServer,
} from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { mcpAuthInfo } from "@/lib/auth";
import { siteUrl } from "@/lib/env";
import {
  createArticle,
  findSimilarArticles,
  getSiteContext,
  getHealth,
  listArticles,
  publishArticle,
  searchArticles,
  submitCorrection,
  updateArticle,
  upsertGlossary,
  validateArticleInput,
  GUIDELINES,
  type ContentError,
} from "@/lib/content";
import {
  articleInputSchema,
  articlePatchSchema,
  articleTypeSchema,
  correctionInputSchema,
  embeddingSchema,
  glossaryInputSchema,
  type ArticlePatch,
} from "@/lib/schemas";

export const dynamic = "force-dynamic";

// The MCP tools reuse the exact schemas the REST API validates with, so the two
// interfaces can never drift apart again.
const mcpUpdateArticleSchema = articlePatchSchema.extend({
  id: z.string().min(1, "article id is required"),
});
const listArticlesSchema = z.object({
  status: z
    .enum(["draft", "pending_review", "published", "needs_recheck", "archived"])
    .optional(),
  type: articleTypeSchema.optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
const similarSchema = z.object({
  embedding: embeddingSchema,
  limit: z.number().int().min(1).max(25).optional(),
  /** Minimum cosine similarity to report; 0.9 ≈ near-duplicate. */
  threshold: z.number().min(-1).max(1).optional(),
});
const searchSchema = z.object({
  q: z.string().min(1),
  type: articleTypeSchema.optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

function text(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

function toolError(err: unknown) {
  if (
    err &&
    typeof err === "object" &&
    "name" in err &&
    (err as ContentError).name === "ContentError"
  ) {
    const ce = err as ContentError;
    return {
      isError: true,
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ error: ce.message, details: ce.details }),
        },
      ],
    };
  }
  const message = err instanceof Error ? err.message : String(err);
  return { isError: true, content: [{ type: "text" as const, text: message }] };
}

/** Register the content-management tools the external agent can call. */
function registerTools(server: McpServer) {
  const actor = "agent" as const;

  server.registerTool(
    "get_context",
    {
      description:
        "Bootstrap payload: guidelines, counts, recent titles. Call before each run.",
    },
    async () => {
      try {
        return text(await getSiteContext());
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.registerTool(
    "get_guidelines",
    { description: "Editorial policy as markdown." },
    async () => text(GUIDELINES),
  );

  server.registerTool(
    "validate_article",
    {
      description: "Dry-run validation of an article (no write).",
      inputSchema: articleInputSchema,
    },
    async (args) => {
      try {
        return text(validateArticleInput(args));
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.registerTool(
    "create_article",
    {
      description:
        "Create an article. status defaults to pending_review; 'published' enforces the daily cap.",
      inputSchema: articleInputSchema,
    },
    async (args) => {
      try {
        const r = await createArticle(args, actor);
        return text({
          ok: true,
          warnings: r.warnings,
          article: {
            id: r.article.id,
            slug: r.article.slug,
            status: r.article.status,
            url: `/news/${r.article.slug}`,
          },
        });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.registerTool(
    "update_article",
    {
      description: "Patch an article by id; body edits create a revision.",
      inputSchema: mcpUpdateArticleSchema,
    },
    async ({ id, ...patch }) => {
      try {
        const a = await updateArticle(id, patch as ArticlePatch, actor);
        return text({ ok: true, id: a.id, slug: a.slug, version: a.version });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.registerTool(
    "publish_article",
    {
      description: "Publish a draft by id or slug (subject to the daily cap).",
      inputSchema: z.object({ idOrSlug: z.string().min(1) }),
    },
    async ({ idOrSlug }) => {
      try {
        const a = await publishArticle(idOrSlug, actor);
        return text({ ok: true, slug: a.slug, url: `/news/${a.slug}` });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.registerTool(
    "list_articles",
    {
      description: "List articles for dedupe/awareness.",
      inputSchema: listArticlesSchema,
    },
    async (args) => {
      try {
        return text({ articles: await listArticles(args) });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.registerTool(
    "search_articles",
    {
      description:
        "Keyword search over published titles and excerpts. Use before drafting to avoid duplicates.",
      inputSchema: searchSchema,
    },
    async (args) => {
      try {
        return text({ articles: await searchArticles(args) });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.registerTool(
    "find_similar_articles",
    {
      description:
        "Cosine nearest-neighbour search over article embeddings (semantic dedupe). Pass the candidate article's 1536-dim embedding; threshold 0.9 ≈ near-duplicate.",
      inputSchema: similarSchema,
    },
    async (args) => {
      try {
        return text({ articles: await findSimilarArticles(args) });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.registerTool(
    "upsert_glossary",
    {
      description: "Create or update a glossary term.",
      inputSchema: glossaryInputSchema,
    },
    async (args) => {
      try {
        const t = await upsertGlossary(args, actor);
        return text({ ok: true, id: t.id, slug: t.slug, termEn: t.termEn });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.registerTool(
    "submit_correction",
    {
      description: "Log a public correction against an article.",
      inputSchema: correctionInputSchema,
    },
    async (args) => {
      try {
        const c = await submitCorrection(args, actor);
        return text({ ok: true, correctionId: c.id });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.registerTool(
    "health",
    {
      description:
        "Article counts, config validation issues, and recent audit events.",
    },
    async () => {
      try {
        return text(await getHealth());
      } catch (e) {
        return toolError(e);
      }
    },
  );
}

const handler = createMcpHandler(() => {
  const server = new McpServer({ name: "ai-agents-arabia", version: "1.0.0" });
  registerTools(server);
  return server;
});

/** Allowed browser origins; non-browser clients (no Origin) always pass. */
function allowedOrigins(): string[] {
  const origins = [
    "http://localhost:3000",
    "http://localhost:8787",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8787",
  ];
  try {
    origins.push(new URL(siteUrl()).origin);
  } catch {
    /* unset or malformed SITE_URL — local origins only */
  }
  return origins;
}

async function serve(req: Request): Promise<Response> {
  const authInfo = mcpAuthInfo(req);
  if (!authInfo) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  const origin = req.headers.get("origin");
  if (origin && !allowedOrigins().includes(origin)) {
    return new Response(JSON.stringify({ error: "forbidden origin" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    });
  }
  return handler.fetch(req, { authInfo });
}

export async function POST(req: Request): Promise<Response> {
  return serve(req);
}

/** GET serves the SSE stream for clients that open one. */
export async function GET(req: Request): Promise<Response> {
  return serve(req);
}