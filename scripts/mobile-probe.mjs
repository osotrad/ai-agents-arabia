/**
 * Measure horizontal overflow on the live site at a phone viewport.
 *
 * Run from a directory where `puppeteer-core` resolves:
 *   npm i --prefix /tmp/probe puppeteer-core
 *   BASE=https://www.wokala.vip WIDTH=390 CHROME=<path to chrome> \
 *     node /tmp/probe/mobile-probe.mjs
 *
 * Why this exists: an iOS or Android browser offers pinch-zoom-out when the
 * document is wider than the viewport (`scrollWidth > clientWidth`). Reading
 * the CSS cannot tell you which element caused it, and a fix that "looks right"
 * while the symptom persists is worse than no fix. This renders real pages on
 * a real engine and names the offending element.
 *
 * Elements that scroll internally are skipped on purpose: a `<pre>` with
 * `overflow-x: auto` is contained by design and does not widen the page.
 */
import puppeteer from "puppeteer-core";

const BASE = process.env.BASE ?? "https://www.wokala.vip";
const WIDTH = Number(process.env.WIDTH ?? 390);
const CHROME = process.env.CHROME;

const PATHS = [
  "/",
  "/news",
  "/topics",
  "/topics/n8n",
  "/topics/langchain",
  "/glossary",
  "/contact",
  "/search?q=langchain",
  "/news/n8n-three-agents-explained",
  "/news/n8n-expressions-and-data",
  "/news/n8n-licensing-and-editions-honestly",
  "/news/n8n-production-project-end-to-end",
  "/news/langchain-langgraph-arabic-guide",
  "/news/build-your-first-langgraph-agent-end-to-end",
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage();
await page.setViewport({
  width: WIDTH,
  height: 844,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});

let bad = 0;
console.log(`  base=${BASE} viewport=${WIDTH}px`);
console.log(`  ${"path".padEnd(48)}${"status".padEnd(10)}viewport  scrollWidth`);
console.log(`  ${"-".repeat(78)}`);

for (const p of PATHS) {
  try {
    await page.goto(`${BASE}${p}`, { waitUntil: "networkidle2", timeout: 45000 });
  } catch {
    console.log(`  ${p.padEnd(48)}${"NAV-FAIL".padEnd(10)}`);
    bad++;
    continue;
  }

  const r = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const offenders = [];
    for (const el of document.querySelectorAll("body *")) {
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      const s = getComputedStyle(el);
      if (s.position === "fixed") continue;
      if (s.overflowX === "auto" || s.overflowX === "scroll" || s.overflowX === "clip") continue;
      if (b.right > vw + 1 || b.left < -1) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || "").toString().slice(0, 44),
          right: Math.round(b.right),
          left: Math.round(b.left),
          text: (el.textContent || "").trim().slice(0, 30),
        });
      }
    }
    return {
      vw,
      scrollW: document.documentElement.scrollWidth,
      offenders: offenders.slice(0, 5),
    };
  });

  const overflow = r.scrollW > r.vw + 1;
  if (overflow) bad++;
  console.log(
    `  ${p.padEnd(48)}${(overflow ? "OVERFLOW" : "ok").padEnd(10)}${String(r.vw).padEnd(9)}${r.scrollW}`,
  );
  for (const o of r.offenders) {
    console.log(`      <${o.tag} class="${o.cls}"> right=${o.right} left=${o.left} "${o.text}"`);
  }
}

await browser.close();
console.log(`\n  overflowing at ${WIDTH}px: ${bad}/${PATHS.length}`);
// Never fail the run: this is a report. A red build over a 1px rounding
// difference trains people to ignore it.
process.exit(0);
