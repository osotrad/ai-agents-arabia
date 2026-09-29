import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;

// Initialise OpenNext Cloudflare for local dev (no-op in plain `next dev`)
if (process.env.NODE_ENV === "development") {
  import("@opennextjs/cloudflare").then((m) =>
    m.initOpenNextCloudflareForDev?.(),
  );
}
