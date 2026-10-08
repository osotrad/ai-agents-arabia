import { NextResponse, type NextRequest } from "next/server";

/**
 * Host-conditional indexation.
 *
 * Three hosts currently serve or will serve identical content:
 *
 *   - the apex, wokala.vip          → indexable, the canonical one
 *   - *.workers.dev                 → the Worker's fallback, noindex
 *   - *.vercel.app (and *.vercel.sh)→ the staging deployment, noindex
 *
 * Any two of those visible at once splits a crawler's signals across domains,
 * so everything except the apex is marked noindex here and the rule is flipped
 * at cutover rather than forgotten.
 *
 * Canonical tags already point every page at the apex — CANONICAL_URL is
 * wokala.vip — which is the correct consolidation signal on its own. This
 * adds an explicit `noindex` on every non-apex host so none of them competes
 * for it. At cutover the apex moves to Vercel, and this file is reduced to
 * excluding only *.workers.dev.
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
  const isApex = host === "wokala.vip" || host === "www.wokala.vip";
  if (isApex) return NextResponse.next();

  const isFallback =
    host.endsWith(".workers.dev") ||
    host.endsWith(".vercel.app") ||
    host.endsWith(".vercel.sh");

  if (!isFallback) return NextResponse.next();

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
