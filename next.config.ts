import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
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
