// Volante /publicar photo-upload failure UAT. Covers three failure modes
// that round-3 /final-review flagged for follow-up Playwright coverage:
//
//   1. Partial photo failure — at least one upload fails after listing.create
//      succeeds. Expect: error banner with partial-failure copy and a
//      Continue-to-listing CTA. Listing should land in DB despite the failure.
//
//   2. All-photo failure — every upload fails. Expect: error banner with
//      all-failed copy. Continue CTA still navigates to the created listing.
//
//   3. Rapid double-click on Publish — POST /api/listings is intentionally
//      delayed so the user can click Publish twice before the first response
//      lands. Expect: exactly ONE listings.create request. The synchronous
//      useRef latch in submit() is what makes this work.
//
// Usage:  cd ~/projects/diamond-iq && node volante-photo-upload-failure.mjs
//
// Targets PROD by default; pass --base=https://staging.example to override
// when staging exists. Hits the same admin.demo account the publish-smoke
// uses to register + promote a fresh seller per run.

import { chromium } from "playwright";
import fs from "node:fs";

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)=(.*)$/);
  return m ? [m[1], m[2]] : [a.replace(/^--/, ""), true];
}));
const WEB = args.base || "https://volantecr.com";
const API = args.api || WEB.replace("//volantecr.com", "//api.volantecr.com");
const STAMP = Date.now();
const password = "smoke-test-pass-12345";

const issues = [];
const ok = (m) => console.log("✓", m);
const fail = (m) => { console.log("✗", m); issues.push(m); };
const note = (m) => console.log("•", m);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// 1x1 red JPEG (≈170 bytes, valid magic bytes). Reused across scenarios.
const jpegBytes = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQY" +
  "GBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYa" +
  "KCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAAR" +
  "CAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAAA" +
  "AAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAw" +
  "EAAhEDEQA/AL+AB//Z",
  "base64",
);

function makeTempJpegs(n, label) {
  const paths = [];
  for (let i = 0; i < n; i++) {
    const p = `/tmp/volante-upload-fail-${label}-${STAMP}-${i}.jpg`;
    fs.writeFileSync(p, jpegBytes);
    paths.push(p);
  }
  return paths;
}

async function registerSeller(email) {
  const r = await fetch(`${API}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name: "Photo Fail UAT " + STAMP }),
  });
  const j = await r.json();
  return j?.token || null;
}

async function adminPromote(sellerId) {
  const adminLogin = await fetch(`${API}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin.demo@demo.volantecr.com",
      password: "demo-admin-pass-12345",
    }),
  });
  const adminJ = await adminLogin.json();
  if (!adminJ.token) return false;
  const r = await fetch(`${API}/api/admin/users/${sellerId}/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminJ.token}` },
    body: JSON.stringify({ role: "seller" }),
  });
  return r.ok;
}

async function deleteListing(token, id) {
  if (!id) return;
  await fetch(`${API}/api/listings/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => {});
}

// Walk steps 0-4 of /publicar with valid inputs and queue `files` photos.
// Leaves the page on step 5 (Review) without clicking Publish.
async function walkToReview(page, files, label) {
  await page.goto(`${WEB}/publicar`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("h1");

  // Step 0 — Vehicle
  await page.selectOption("select >> nth=0", { label: "Toyota" }).catch(() => {});
  await page.fill('input[placeholder]', `PhotoFailUAT-${label}-${STAMP}`);
  await page.fill('input[type=number] >> nth=0', "2020");
  await page.locator("select").nth(1).selectOption("suv").catch(() => {});
  await page.locator("select").nth(2).selectOption("gasolina").catch(() => {});
  await page.locator("select").nth(3).selectOption("automatic").catch(() => {});
  await page.click("button.btn.btn-primary");

  // Step 1 — Details
  await page.fill('input[type=number]', "45000");
  await page.click("button.btn.btn-primary");

  // Step 2 — Location
  await page.locator("select").first().selectOption("san_jose");
  const cantonSelect = page.locator("select").nth(1);
  const cantonOptions = await cantonSelect.locator("option").all();
  if (cantonOptions.length > 1) {
    const val = await cantonOptions[1].getAttribute("value");
    if (val) await cantonSelect.selectOption(val);
  }
  await page.click("button.btn.btn-primary");

  // Step 3 — Price
  await page.fill('input[type=number]', "12500000");
  await page.click("button.btn.btn-primary");

  // Step 4 — Photos: stage files via the hidden file input
  await page.locator('input[type=file]').setInputFiles(files);
  await wait(200);
  await page.click("button.btn.btn-primary");

  // Now on Step 5 — Review
  await page.waitForSelector("button.btn.btn-papaya");
}

async function scenarioPartialFailure(ctx, sellerToken) {
  console.log("\n--- Scenario 1: partial photo failure ---");
  const page = await ctx.newPage();
  page.on("pageerror", (e) => fail(`[partial] page error: ${e.message}`));
  const files = makeTempJpegs(3, "partial");

  // Intercept photo POSTs: let the FIRST succeed (passthrough), fail the rest.
  let photoPostSeen = 0;
  await page.route(/\/api\/listings\/[^/]+\/photos$/, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    photoPostSeen++;
    if (photoPostSeen === 1) return route.continue();
    return route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message_es: "Falló", message_en: "Failed" } }),
    });
  });

  await walkToReview(page, files, "partial");
  await page.click("button.btn.btn-papaya");

  // Expect to stay on /publicar with an error banner mentioning partial failure.
  await wait(2500); // allow listing.create + sequential photo POSTs to settle
  const stillOnPublicar = page.url().endsWith("/publicar");
  if (stillOnPublicar) ok("[partial] did not auto-navigate after photo failure");
  else fail(`[partial] navigated away: ${page.url()}`);

  const banner = await page.locator(".auth-error").first().textContent().catch(() => "");
  if (/no se pudieron subir|could not be uploaded/i.test(banner ?? "")) {
    ok(`[partial] partial-failure banner present: "${(banner ?? "").slice(0, 80)}…"`);
  } else {
    fail(`[partial] partial-failure banner missing — got: "${(banner ?? "").slice(0, 120)}"`);
  }

  // Continue CTA should be visible (both the banner and the nav). Click banner one.
  const cont = page.getByRole("button", { name: /Continuar al anuncio|Continue to listing/i });
  if (await cont.count() === 0) fail("[partial] continue CTA missing");
  else {
    await cont.first().click();
    await page.waitForURL(/\/anuncio\//, { timeout: 10000 }).catch(() => {});
    if (/\/anuncio\//.test(page.url())) ok(`[partial] continue CTA navigated to ${page.url()}`);
    else fail(`[partial] continue CTA didn't navigate — at ${page.url()}`);
  }

  // Confirm listing was created (1 photo through, rest 500'd)
  const mine = await (await fetch(`${API}/api/listings/mine`, {
    headers: { Authorization: `Bearer ${sellerToken}` },
  })).json();
  const ids = (mine.listings || []).map((l) => l.id);
  for (const id of ids) await deleteListing(sellerToken, id);
  if (ids.length >= 1) ok(`[partial] listing landed in DB (${ids.length}) — cleaned up`);
  else fail("[partial] expected ≥1 created listing");

  files.forEach((f) => fs.existsSync(f) && fs.unlinkSync(f));
  await page.close();
}

async function scenarioAllFailure(ctx, sellerToken) {
  console.log("\n--- Scenario 2: all photos fail ---");
  const page = await ctx.newPage();
  page.on("pageerror", (e) => fail(`[all] page error: ${e.message}`));
  const files = makeTempJpegs(2, "all");

  await page.route(/\/api\/listings\/[^/]+\/photos$/, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    return route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({ error: { code: "INTERNAL_ERROR", message_es: "Falló", message_en: "Failed" } }),
    });
  });

  await walkToReview(page, files, "all");
  await page.click("button.btn.btn-papaya");

  await wait(2500);
  const banner = await page.locator(".auth-error").first().textContent().catch(() => "");
  if (/ninguna de las|none of the/i.test(banner ?? "")) {
    ok(`[all] all-failed banner present: "${(banner ?? "").slice(0, 80)}…"`);
  } else {
    fail(`[all] all-failed banner missing — got: "${(banner ?? "").slice(0, 120)}"`);
  }

  // Verify nav button became Continue (not Publish) — the Publish button must
  // be gone so re-submission is impossible.
  const navButtons = await page.locator(".publicar__nav button").allTextContents();
  const hasPublishBtn = navButtons.some((t) => /Publicar ahora|Publish now/i.test(t));
  if (hasPublishBtn) fail(`[all] Publish button still rendered after publish: ${navButtons.join(" | ")}`);
  else ok("[all] Publish button replaced by Continue CTA — duplicate-create path closed");

  // Cleanup any listing that landed
  const mine = await (await fetch(`${API}/api/listings/mine`, {
    headers: { Authorization: `Bearer ${sellerToken}` },
  })).json();
  for (const l of mine.listings || []) await deleteListing(sellerToken, l.id);

  files.forEach((f) => fs.existsSync(f) && fs.unlinkSync(f));
  await page.close();
}

async function scenarioRapidDoubleClick(ctx, sellerToken) {
  console.log("\n--- Scenario 3: rapid double-click on Publish ---");
  const page = await ctx.newPage();
  page.on("pageerror", (e) => fail(`[rapid] page error: ${e.message}`));
  const files = makeTempJpegs(1, "rapid");

  // Count POSTs to /api/listings (not the /:id/photos subroute) and delay each
  // for 1.5s so a second click has time to land while the first is in flight.
  let listingCreatePosts = 0;
  await page.route(/\/api\/listings(\?[^/]*)?$/, async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    listingCreatePosts++;
    await wait(1500);
    return route.continue();
  });

  await walkToReview(page, files, "rapid");

  const publish = page.locator("button.btn.btn-papaya");
  // Two clicks dispatched as fast as Playwright can fire them.
  await Promise.all([publish.click(), publish.click({ force: true }).catch(() => {})]);

  // Wait long enough for any second create to have happened (1.5s delay + buffer)
  await wait(4000);

  if (listingCreatePosts === 1) ok(`[rapid] exactly 1 listings.create POST (latch held)`);
  else fail(`[rapid] expected 1 listings.create POST, observed ${listingCreatePosts}`);

  // Cleanup
  const mine = await (await fetch(`${API}/api/listings/mine`, {
    headers: { Authorization: `Bearer ${sellerToken}` },
  })).json();
  for (const l of mine.listings || []) await deleteListing(sellerToken, l.id);

  files.forEach((f) => fs.existsSync(f) && fs.unlinkSync(f));
  await page.close();
}

(async () => {
  console.log(`\n=== Volante photo-upload failure UAT @ ${WEB} ===`);

  // Health check
  const ping = await fetch(`${API}/api/listings?pageSize=1`).then((r) => r.json()).catch(() => null);
  if (!ping?.listings) { fail("server not reachable"); process.exit(1); }
  ok("server reachable");

  // Register + promote ONE seller, reused across the 3 scenarios.
  const email = `upload-fail-${STAMP}@volante.test`;
  const sellerToken = await registerSeller(email);
  if (!sellerToken) { fail("register failed"); process.exit(1); }
  const me = await (await fetch(`${API}/api/auth/me`, {
    headers: { Authorization: `Bearer ${sellerToken}` },
  })).json();
  const sellerId = me?.user?.id;
  if (!sellerId || !(await adminPromote(sellerId))) {
    fail("seller promotion failed"); process.exit(1);
  }
  ok(`registered + promoted ${email}`);

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    storageState: undefined,
  });

  // Login once — share storage across the 3 scenarios.
  const loginPage = await ctx.newPage();
  await loginPage.goto(`${WEB}/iniciar-sesion`, { waitUntil: "domcontentloaded" });
  await loginPage.fill('input[type=email]', email);
  await loginPage.fill('input[type=password]', password);
  await loginPage.click('button[type=submit]');
  await loginPage.waitForLoadState("networkidle");
  await loginPage.close();
  ok("logged in");

  try {
    await scenarioPartialFailure(ctx, sellerToken);
  } catch (e) { fail(`[partial] threw: ${e.message}`); }
  try {
    await scenarioAllFailure(ctx, sellerToken);
  } catch (e) { fail(`[all] threw: ${e.message}`); }
  try {
    await scenarioRapidDoubleClick(ctx, sellerToken);
  } catch (e) { fail(`[rapid] threw: ${e.message}`); }

  await browser.close();

  if (issues.length === 0) {
    console.log("\n=== ALL GREEN ===\n");
    process.exit(0);
  } else {
    console.log(`\n=== ${issues.length} issue(s) ===`);
    issues.forEach((i) => note(`  - ${i}`));
    process.exit(1);
  }
})();
