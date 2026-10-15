import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    /*
     * Edge caching for read-only content pages.
     *
     * Every content route sets `force-dynamic`, so each hit is a full React
     * render plus a database round-trip. `export const revalidate = 300` sits
     * alongside it on ten routes and is dead code: force-dynamic wins. That
     * is why the HTML ships `cache-control: public, max-age=0, must-revalidate`
     * — nothing is ever reused at the edge.
     *
     * A 60s shared cache changes that. Freshness stays intact because
     * src/lib/revalidate.ts already calls revalidatePath for the article, the
     * news index and the homepage on every publish and edit, so a new or
     * changed article purges its own cache immediately. s-maxage only bounds
     * how long an unrelated edge copy can survive; stale-while-revalidate lets
     * a visitor be served instantly while one request refreshes in the
     * background, so nobody waits on a cold render.
     *
     * Deliberately NOT cached: /search (query-driven, unbounded keyspace) and
     * /contact (form target). /api/* is untouched — it carries its own
     * authentication and must never be edge-cached.
     */
    const cache = "public, s-maxage=60, stale-while-revalidate=600";

    const cacheable = [
      "/",
      "/news",
      "/news/:slug*",
      "/topics",
      "/topics/:slug*",
      "/glossary",
      "/glossary/:slug*",
      "/sources",
      "/corrections",
      "/standards",
      "/about",
      "/feed.xml",
      "/sitemap.xml",
    ];

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      ...cacheable.map((source) => ({
        source,
        headers: [{ key: "Cache-Control", value: cache }],
      })),
      {
        // Explicitly uncacheable, in case a broader pattern ever widens.
        source: "/search",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      },
      {
        source: "/contact",
        headers: [{ key: "Cache-Control", value: "private, no-store, max-age=0" }],
      },
    ];
  },
};

export default nextConfig;

// Initialise OpenNext Cloudflare for local dev (no-op in plain `next dev`)
if (process.env.NODE_ENV === "development") {
  import("@opennextjs/cloudflare").then((m) =>
    m.initOpenNextCloudflareForDev?.(),
  );
}
