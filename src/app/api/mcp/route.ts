import {
  createMcpHandler,
  McpServer,
} from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import { mcpAuthInfo } from "@/lib/auth";
import {
  createArticle,
  getSiteContext,
  getHealth,
  listArticles,
  publishArticle,
  submitCorrection,
  updateArticle,
  upsertGlossary,
  validateArticleInput,
  GUIDELINES,
  type ContentError,
} from "@/lib/content";
import type {
  ArticleInput,
  GlossaryInput,
  CorrectionInput,
} from "@/lib/schemas";

export const dynamic = "force-dynamic";

// ---------- tool input schemas ----------
const sourceSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  excerpt: z.string().optional(),
});
const claimSchema = z.object({
  claim: z.string(),
  sourceIndex: z.number().int().min(0),
});
const createArticleSchema = z.object({
  titleAr: z.string().min(5),
  excerptAr: z.string().optional(),
  bodyMd: z.string().min(80),
  type: z.enum(["news", "summary", "explainer", "review", "glossary"]).default("news"),
  slug: z.string().optional(),
  status: z.enum(["draft", "pending_review", "published"]).default("pending_review"),
  sources: z.array(sourceSchema).default([]),
  claims: z.array(claimSchema).default([]),
  confidenceScore: z.number().min(0).max(1).optional(),
  embedding: z.array(z.number()).length(1536).optional(),
});
const updateArticleSchema = z.object({
  id: z.string(),
  titleAr: z.string().min(5).optional(),
  excerptAr: z.string().optional(),
  bodyMd: z.string().min(80).optional(),
  reason: z.string().optional(),
});
const glossarySchema = z.object({
  termAr: z.string().min(2),
  termEn: z.string().min(2),
  slug: z.string().optional(),
  definitionAr: z.string().min(20),
  sourceUrl: z.string().url().optional(),
  embedding: z.array(z.number()).length(1536).optional(),
});
const correctionSchema = z.object({
  articleId: z.string().uuid().optional(),
  slug: z.string().optional(),
  whatChanged: z.string().min(5),
  publishedNote: z.string().optional(),
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
  if (err && typeof err === "object" && "name" in err && (err as ContentError).name === "ContentError") {
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
    { description: "Bootstrap payload: guidelines, counts, recent titles. Call before each run." },
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
    { description: "Dry-run validation of an article (no write).", inputSchema: createArticleSchema },
    async (args) => {
      try {
        return text(validateArticleInput(args as unknown as ArticleInput));
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
      inputSchema: createArticleSchema,
    },
    async (args) => {
      try {
        const r = await createArticle(args as unknown as ArticleInput, actor);
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
    { description: "Patch an article by id; body edits create a revision.", inputSchema: updateArticleSchema },
    async (args) => {
      try {
        const { id, ...patch } = args;
        const a = await updateArticle(id, patch, actor);
        return text({ ok: true, id: a.id, slug: a.slug, version: a.version });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.registerTool(
    "publish_article",
    { description: "Publish a draft by id or slug.", inputSchema: z.object({ idOrSlug: z.string() }) },
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
      inputSchema: z.object({
        status: z.string().optional(),
        type: z.string().optional(),
        limit: z.number().int().min(1).max(100).optional(),
      }),
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
    "upsert_glossary",
    { description: "Create or update a glossary term.", inputSchema: glossarySchema },
    async (args) => {
      try {
        const t = await upsertGlossary(args as unknown as GlossaryInput, actor);
        return text({ ok: true, slug: t.slug });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.registerTool(
    "submit_correction",
    { description: "Log a public correction against an article.", inputSchema: correctionSchema },
    async (args) => {
      try {
        const c = await submitCorrection(args as unknown as CorrectionInput, actor);
        return text({ ok: true, correctionId: c.id });
      } catch (e) {
        return toolError(e);
      }
    },
  );

  server.registerTool(
    "health",
    { description: "Article counts + recent audit events." },
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
  const site = process.env.SITE_URL;
  if (site) {
    try {
      origins.push(new URL(site).origin);
    } catch {
      /* ignore malformed SITE_URL */
    }
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

