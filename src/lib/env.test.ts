import { describe, it, expect, afterEach } from "vitest";
import { parseEnv, resetEnv } from "@/lib/env";
import { isAdminKey, ADMIN_SESSION_COOKIE } from "@/lib/auth";
import { toVectorLiteral } from "@/lib/content";

afterEach(() => {
  delete process.env.ADMIN_API_KEY;
  delete process.env.AGENT_API_KEY;
  resetEnv();
});

describe("parseEnv", () => {
  it("returns validated values and no issues for a good config", () => {
    const { data, issues } = parseEnv({
      DATABASE_URL: "postgres://u:p@h/db",
      AGENT_API_KEY: "a".repeat(24),
      SITE_URL: "https://example.com",
    });
    expect(issues).toEqual([]);
    expect(data.AGENT_API_KEY).toBe("a".repeat(24));
    expect(data.DAILY_PUBLISH_CAP).toBe(5);
  });

  it("reports issues but still yields usable defaults", () => {
    const { data, issues } = parseEnv({ AGENT_API_KEY: "short" });
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.join(" ")).toContain("AGENT_API_KEY");
    // A bad key must not disable the site: defaults still come through.
    expect(data.DAILY_PUBLISH_CAP).toBe(5);
    expect(data.SITE_URL).toBe("http://localhost:3000");
  });

  it("coerces the publish cap", () => {
    const { data } = parseEnv({ DAILY_PUBLISH_CAP: "9" });
    expect(data.DAILY_PUBLISH_CAP).toBe(9);
  });
});

describe("isAdminKey", () => {
  it("rejects when no admin key is configured", () => {
    expect(isAdminKey("anything")).toBe(false);
  });

  it("rejects a wrong or same-length prefix", () => {
    process.env.ADMIN_API_KEY = "b".repeat(32);
    resetEnv();
    expect(isAdminKey("c".repeat(32))).toBe(false);
    expect(isAdminKey("b".repeat(31))).toBe(false);
    expect(isAdminKey(null)).toBe(false);
  });

  it("accepts the exact key", () => {
    process.env.ADMIN_API_KEY = "b".repeat(32);
    resetEnv();
    expect(isAdminKey("b".repeat(32))).toBe(true);
  });
});

describe("authenticateAdmin via session cookie", () => {
  const key = "k".repeat(32);

  async function auth(headers: Record<string, string>) {
    const { authenticateAdmin } = await import("@/lib/auth");
    return authenticateAdmin(
      new Request("https://example.com/api/admin/review", { headers }),
    );
  }

  it("accepts the session cookie without a header", async () => {
    process.env.ADMIN_API_KEY = key;
    resetEnv();
    const actor = await auth({
      cookie: `${ADMIN_SESSION_COOKIE}=${key}; other=1`,
    });
    expect(actor?.actor).toBe("human");
  });

  it("rejects a wrong cookie value", async () => {
    process.env.ADMIN_API_KEY = key;
    resetEnv();
    const actor = await auth({ cookie: `${ADMIN_SESSION_COOKIE}=nope` });
    expect(actor).toBeNull();
  });
});

describe("toVectorLiteral", () => {
  it("renders a pgvector array literal", () => {
    expect(toVectorLiteral([1, 2.5, -3])).toBe("[1,2.5,-3]");
  });

  it("never emits NaN or Infinity", () => {
    expect(toVectorLiteral([Number.NaN, Infinity, 0])).toBe("[0,0,0]");
  });
});