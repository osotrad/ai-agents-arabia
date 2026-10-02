/**
 * Ping IndexNow (Bing/Yandex) so freshly published URLs get crawled fast.
 * Soft dependency — no-ops when INDEXNOW_KEY is unset, never throws.
 */
export async function pingIndexNow(paths: string[]): Promise<number | null> {
  const key = process.env.INDEXNOW_KEY;
  const siteUrl = process.env.SITE_URL;
  if (!key || !siteUrl || paths.length === 0) return null;
  try {
    const host = new URL(siteUrl).host;
    const urlList = paths
      .map((p) => new URL(p, siteUrl).toString())
      .slice(0, 10_000);
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: `${siteUrl.replace(/\/$/, "")}/${key}.txt`,
        urlList,
      }),
    });
    return res.status;
  } catch (err) {
    console.warn("[indexnow] ping failed", err);
    return null;
  }
}
