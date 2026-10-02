import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/env";

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
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}