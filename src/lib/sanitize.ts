import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

marked.setOptions({ gfm: true, breaks: false });

/**
 * Elements an agent-authored article may contain. Everything else is
 * stripped — this is the trust boundary between LLM output and the DOM.
 */
const ALLOWED_TAGS = [
  "h2",
  "h3",
  "h4",
  "p",
  "a",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "blockquote",
  "code",
  "pre",
  "br",
  "hr",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
];

/** Sanitize an HTML string produced from markdown. */
export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ["href", "title", "rel", "target"],
      code: ["class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    // Force safe link behaviour on every anchor.
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer nofollow",
        target: "_blank",
      }),
    },
    disallowedTagsMode: "discard",
  });
}

/**
 * Render untrusted markdown to sanitized HTML. Raw HTML embedded in the
 * markdown survives `marked`, so sanitization is mandatory, not optional.
 */
export async function renderMarkdown(md: string): Promise<string> {
  const raw = String(await marked.parse(md));
  return sanitizeArticleHtml(raw);
}

/** Strip all markup — used for excerpts / plain-text previews. */
export function toPlainText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} });
}

/** URL-safe latin slug from any string (Arabic falls back to a hash). */
export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
  if (base.length >= 3) return base;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return `a${(hash >>> 0).toString(36)}`;
}
