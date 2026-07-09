// Visual check: login + screenshot de una ruta. Uso:
//   BT_EMAIL=... BT_PASSWORD=... node scripts/uxcheck.mjs /managers --out shot.png
//   flags: --builder (mock solo-GET del rol), --mobile (390px)
import { chromium } from "playwright-core";

const args = process.argv.slice(2);
const route = args.find((a) => a.startsWith("/")) ?? "/managers";
const asBuilder = args.includes("--builder");
const mobile = args.includes("--mobile");
const out = args[args.indexOf("--out") + 1] ?? "uxcheck.png";
const BASE = process.env.BASE ?? "http://127.0.0.1:4173";
const { BT_EMAIL, BT_PASSWORD } = process.env;
if (!BT_EMAIL || !BT_PASSWORD) throw new Error("Set BT_EMAIL and BT_PASSWORD");

const browser = await chromium.launch({
  executablePath:
    "/root/.cache/ms-playwright/chromium_headless_shell-1228/chrome-headless-shell-linux64/chrome-headless-shell",
});
const ctx = await browser.newContext({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  ...(mobile ? { isMobile: true, hasTouch: true } : {}),
});
const blocked = [];
if (asBuilder) {
  await ctx.route(/\/rest\/v1\/user_roles\?/, (r) =>
    r.request().method() === "GET"
      ? r.fulfill({
          status: 200,
          contentType: "application/json",
          headers: { "access-control-allow-origin": "*" },
          body: JSON.stringify({ role: "builder" }),
        })
      : r.abort(),
  );
  await ctx.route(/supabase\.co\/rest\/v1\//, (r) => {
    if (r.request().method() !== "GET") {
      blocked.push(r.request().url());
      return r.abort();
    }
    return r.fallback();
  });
}
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(BASE + "/auth", { waitUntil: "networkidle" });
await page.fill("#signin-email", BT_EMAIL);
await page.fill("#signin-password", BT_PASSWORD);
await page.getByRole("button", { name: "Sign In", exact: true }).click();
await page.waitForURL(asBuilder ? "**/builders" : "**/managers", { timeout: 30000 });
if (route !== "/managers" && route !== "/builders") {
  await page.goto(BASE + route, { waitUntil: "networkidle" });
}
await page.waitForTimeout(1500);
await page.screenshot({ path: out, fullPage: true });
console.log(`saved ${out} | console errors: ${errors.length} | blocked writes: ${blocked.length}`);
errors.forEach((e) => console.log("  ERR", e));
await browser.close();
