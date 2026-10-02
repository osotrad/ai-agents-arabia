import { describe, it, expect } from "vitest";
import { slugify, sanitizeArticleHtml, renderMarkdown } from "@/lib/sanitize";

describe("slugify", () => {
  it("produces a lowercase hyphenated latin slug", () => {
    expect(slugify("OpenAI Agent Update!")).toBe("openai-agent-update");
  });

  it("falls back to a generated id for non-latin input", () => {
    expect(slugify("وكلاء")).toMatch(/^a[0-9a-z]+$/);
  });
});

describe("sanitizeArticleHtml", () => {
  it("removes <script>", () => {
    expect(sanitizeArticleHtml("<p>hi</p><script>alert(1)</script>")).not.toContain(
      "<script",
    );
  });

  it("removes event handlers", () => {
    expect(sanitizeArticleHtml('<img src="x" onerror="alert(1)">')).not.toContain(
      "onerror",
    );
  });

  it("forces safe rel/target on links", () => {
    const out = sanitizeArticleHtml('<a href="https://example.com">x</a>');
    expect(out).toContain("noopener");
    expect(out).toContain('target="_blank"');
  });

  it("drops javascript: URLs", () => {
    expect(sanitizeArticleHtml('<a href="javascript:alert(1)">x</a>')).not.toContain(
      "javascript:",
    );
  });
});

describe("renderMarkdown", () => {
  it("renders markdown and sanitizes embedded HTML", async () => {
    const html = await renderMarkdown("## العنوان\n\nنص <script>bad()</script>");
    expect(html).toContain("<h2");
    expect(html).not.toContain("<script");
  });
});
