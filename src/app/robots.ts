import type { MetadataRoute } from "next";
import { canonicalUrl } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // /search is a query-driven surface — useful for visitors, noise for crawlers.
        disallow: ["/admin", "/api/", "/search"],
      },
    ],
    sitemap: `${canonicalUrl()}/sitemap.xml`,
  };
}