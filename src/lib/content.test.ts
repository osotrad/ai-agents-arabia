import { describe, it, expect } from "vitest";
import { validateArticleInput } from "@/lib/content";
import type { ArticleInput } from "@/lib/schemas";

const base: ArticleInput = {
  titleAr: "خبر تجريبي عن الوكلاء",
  bodyMd: "نص تجريبي طويل ".repeat(20),
  type: "news",
  status: "pending_review",
  sources: [],
  claims: [],
};

describe("validateArticleInput", () => {
  it("requires at least two sources for news", () => {
    const { errors } = validateArticleInput({
      ...base,
      sources: [{ url: "https://a.com/1" }],
    });
    expect(errors.some((e) => e.includes("at least 2 sources"))).toBe(true);
  });

  it("passes with two sources and no claims", () => {
    const { errors } = validateArticleInput({
      ...base,
      sources: [{ url: "https://a.com/1" }, { url: "https://b.com/2" }],
    });
    expect(errors).toHaveLength(0);
  });

  it("flags a claim whose sourceIndex is out of range", () => {
    const { errors } = validateArticleInput({
      ...base,
      sources: [{ url: "https://a.com/1" }, { url: "https://b.com/2" }],
      claims: [{ claim: "ادعاء مهم جدًا", sourceIndex: 5 }],
    });
    expect(errors.some((e) => e.includes("sourceIndex"))).toBe(true);
  });

  it("warns when a number is absent from every excerpt", () => {
    const { warnings } = validateArticleInput({
      ...base,
      bodyMd: "ارتفعت النسبة بنسبة 42% هذا العام ".repeat(10),
      sources: [{ url: "https://a.com/1" }, { url: "https://b.com/2" }],
    });
    expect(warnings.some((w) => w.includes("42"))).toBe(true);
  });
});
