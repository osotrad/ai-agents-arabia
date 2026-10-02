import { describe, it, expect } from "vitest";
import { buildImageKey } from "@/lib/images";
import { articleInputSchema, articlePatchSchema } from "@/lib/schemas";

const PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

describe("buildImageKey", () => {
  it("keeps a safe slug and adds the extension and a unique suffix", () => {
    const key = buildImageKey("gemini-4-argon-launch", "image/png");
    expect(key).toMatch(/^articles\/gemini-4-argon-launch-[0-9a-f]{8}\.png$/);
  });

  it("never emits characters that are ambiguous under SigV4 URI encoding", () => {
    // Implementations disagree on whether '+' and '&' must be escaped, so the
    // key must never contain them.
    for (const slug of ["a b", "a+b", "a&b=c", "Gemini 4/Argon", "../escape", "  "]) {
      const key = buildImageKey(slug, "image/jpeg");
      expect(key).toMatch(/^articles\/[a-z0-9./-]*-[0-9a-f]{8}\.jpg$/);
      expect(key).not.toMatch(/[ +&?=]/);
      expect(key.startsWith("articles/articles/")).toBe(false);
    }
  });

  it("collapses separators and strips leading/trailing dashes", () => {
    const key = buildImageKey("--A__B--", "image/webp");
    expect(key).toMatch(/^articles\/a-b-[0-9a-f]{8}\.webp$/);
  });

  it("falls back to a default when the slug reduces to nothing", () => {
    expect(buildImageKey("!!!", "image/png")).toMatch(
      /^articles\/image-[0-9a-f]{8}\.png$/,
    );
  });

  it("does not produce path traversal", () => {
    for (const slug of ["../../etc/passwd", "..%2f..%2fsecret"]) {
      const key = buildImageKey(slug, "image/png");
      expect(key.split("/")).toHaveLength(2); // ["articles", "<name>.png"]
    }
  });
});

describe("article image fields", () => {
  const base = {
    titleAr: "عنوان كافٍ للاختبار",
    bodyMd:
      "نص طويل بما يكفي لتجاوز الحد الأدنى للطول المطلوب في مخطط التحقق، ويتضمن أرقامًا للاختبار.",
  };

  it("accepts an https image url with alt text", () => {
    const r = articleInputSchema.safeParse({
      ...base,
      imageUrl: "https://x.storage.neon.build/b/articles/a-1234abcd.png",
      imageAlt: "صورة توضيحية",
    });
    expect(r.success).toBe(true);
  });

  it("rejects a non-http scheme", () => {
    for (const url of [
      "javascript:alert(1)",
      "data:image/png;base64,AAAA",
      "file:///etc/passwd",
    ]) {
      const r = articleInputSchema.safeParse({ ...base, imageUrl: url });
      expect(r.success).toBe(false);
    }
  });

  it("rejects an http url that is not a url at all", () => {
    expect(articleInputSchema.safeParse({ ...base, imageUrl: "not a url" }).success).toBe(
      false,
    );
  });

  it("treats the image as optional", () => {
    const r = articleInputSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.imageUrl).toBeUndefined();
      expect(r.data.imageAlt).toBeUndefined();
    }
  });

  it("requires alt text to be meaningful when present", () => {
    expect(articleInputSchema.safeParse({ ...base, imageAlt: "ab" }).success).toBe(false);
  });

  it("carries the image fields through PATCH", () => {
    const r = articlePatchSchema.safeParse({
      imageUrl: "https://cdn.example.com/a.png",
      imageAlt: "وصف الصورة",
    });
    expect(r.success).toBe(true);
  });

  it("still rejects a PATCH with only a reason", () => {
    expect(articlePatchSchema.safeParse({ reason: "typo fix" }).success).toBe(false);
  });
});

// The image is stored, never placed in the markdown body, so the sanitizer's
// tag allowlist is irrelevant to it. This guards that separation.
describe("sanitizer stays out of the image path", () => {
  it("keeps <img> out of rendered article markdown", async () => {
    const { renderMarkdown } = await import("@/lib/sanitize");
    const html = await renderMarkdown(
      "![صورة](https://x.example.com/a.png)\n\n<img src='https://x.example.com/b.png'>",
    );
    // Both markdown image syntax and a raw <img> are discarded entirely, so an
    // image can never reach a reader except through articles.imageUrl.
    expect(html).not.toContain("<img");
    expect(html).not.toContain("a.png");
    expect(html).not.toContain("b.png");
  });
  it("keeps the PNG magic bytes recognisable for sniffing", () => {
    expect(PNG[0]).toBe(0x89);
    expect([...PNG.slice(1, 4)]).toEqual([0x50, 0x4e, 0x47]);
  });
});