import { NextResponse, type NextRequest } from "next/server";

/**
 * Host-conditional indexation.
 *
 * The Worker answers on two hosts: the apex (wokala.vip) and the
 * *.workers.dev fallback. Both serve identical content, so a crawler sees the
 * same site twice on two domains and splits signals between them.
 *
 * Canonical tags already point every page at the apex — CANONICAL_URL is
 * wokala.vip — which is the correct consolidation signal on its own. This
 * middleware adds an explicit `noindex` on the fallback host so it does not
 * compete for the apex at all.
 *
 * Why a header and not robots.txt: `Disallow` is not `noindex`. A crawler
 * cannot fetch a page it is told to skip, so it never sees the noindex and may
 * still index the URL from inbound links. X-Robots-Tag is delivered with the
 * page and is unambiguous.
 *
 * `noindex` alone (not `nofollow`): links on the fallback should still pass
 * their equity to the apex. `follow` is the default, so it is not stated.
 *
 * Serving robots.txt as static made a host-conditional rules file impossible,
 * hence this file rather than a rewrite of app/robots.ts.
 *
 * Next 16 renamed the `middleware` convention to `proxy`; this is that form.
 */
export function proxy(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").split(":")[0];
  const isFallbackHost =
    host.endsWith(".workers.dev") || host === "workers.dev";

  if (!isFallbackHost) return NextResponse.next();

  const res = NextResponse.next();
  res.headers.set("X-Robots-Tag", "noindex");
  return res;
}

export const config = {
  matcher: [
    /*
     * Everything a crawler can index, minus immutable assets. Keeping the
     * matcher tight matters: the proxy runs on every matched request, and
     * static files are not worth a function invocation.
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|logo.png|feed.xml).*)",
  ],
};
