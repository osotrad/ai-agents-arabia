import { describe, it, expect } from "vitest";
import { assessClaimSupport } from "@/lib/content";

const EN = "Argon will launch at an introductory price of $2 per million input tokens and $10 per million output tokens, with the output limit raised to 1M tokens from 64K.";

describe("assessClaimSupport — same script", () => {
  it("grounds an English claim that shares vocabulary with the excerpt", () => {
    const r = assessClaimSupport(
      "Argon launches at $2 per million input tokens",
      EN,
    );
    expect(r.verdict).toBe("grounded");
    expect(r.ratio).toBeGreaterThan(0.2);
  });

  it("flags an English claim with no vocabulary in common", () => {
    const r = assessClaimSupport(
      "Regulators opened an inquiry into pricing practices",
      EN,
    );
    expect(r.verdict).toBe("weak");
    expect(r.reason).toBe("no-lexical-overlap");
  });

  it("grounds an Arabic claim against an Arabic excerpt", () => {
    const r = assessClaimSupport(
      "رفعت جوجل حد الإخراج إلى مليون رمز من الوحدة السابقة",
      "ذكرت جوجل أن حد الإخراج صار مليون رمز، مقابل 64K في الجيل السابق",
    );
    expect(r.verdict).toBe("grounded");
  });

  it("ignores tashkel and alef/ta-marbuta variants when matching Arabic", () => {
    const withMarks = assessClaimSupport(
      "اَلْمَصَادِر المُوثَّقَة تُسجَّل فِي الْقَاعِدَة",
      "المصادر الموثقة تسجل في القاعدة",
    );
    expect(withMarks.verdict).toBe("grounded");
  });

  it("treats a missing excerpt as unverifiable, not weak", () => {
    expect(assessClaimSupport("أي ادعاء هنا", "").verdict).toBe("unverifiable");
  });
});

describe("assessClaimSupport — cross script", () => {
  it("does not flag an Arabic claim citing an English excerpt", () => {
    // This is the false positive the old substring check produced on every claim.
    const r = assessClaimSupport(
      "أرغون غير متاح على نطاق واسع، والوصول يبدأ مع دفاعي الأمن السيبراني",
      EN,
    );
    expect(r.verdict).not.toBe("weak");
  });

  it("grounds a cross-language claim whose figures all appear", () => {
    const r = assessClaimSupport(
      "رفعت جوجل حد الإخراج إلى 1M رمز مقابل 64K سابقًا",
      EN,
    );
    expect(r.verdict).toBe("grounded");
    expect(r.ratio).toBe(1);
  });

  it("flags a cross-language claim whose figure is absent from the excerpt", () => {
    const r = assessClaimSupport("انخفضت التكلفة بنسبة 70% حسب التقرير", EN);
    expect(r.verdict).toBe("weak");
    expect(r.reason).toBe("all-figures-missing");
  });

  it("flags when only some figures are missing", () => {
    const r = assessClaimSupport("السعر 2 دولار والنمو 70%", EN);
    expect(r.verdict).toBe("weak");
    expect(r.reason).toBe("figure-not-in-excerpt");
    expect(r.ratio).toBeCloseTo(0.5);
  });

  it("handles currency and percentage figures", () => {
    const r = assessClaimSupport("announced at $2 and $10 per million", EN);
    expect(r.verdict).toBe("grounded");
  });
});
