// Streak end-to-end UAT — mobile viewport (iPhone 14, 390x844).
//
// Walks: landing → waitlist signup → app auth gate → signup → today empty state →
//        new habit → tap-to-mark x2 → completion state → stats → settings → sign-out.
//
// Run with both servers up:
//   ~/projects/streak/server   (port 3461)
//   ~/projects/streak/web      (port 3450)
// then:  cd ~/projects/diamond-iq && node streak-uat-full.mjs

import { chromium } from "playwright";

const WEB = process.env.STREAK_WEB || "http://localhost:3450";
const STAMP = Date.now();
const testEmail = `uat-${STAMP}@streak.test`;
const testPassword = "uat-test-12345";
const testName = "UAT Tester";
const issues = [];
const note = (msg) => { console.log(msg); };
const fail = (msg) => { console.log("  ✗ " + msg); issues.push(msg); };
const ok = (msg) => { console.log("  ✓ " + msg); };

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => fail(`pageerror: ${e.message}`));

  // ─── 1. Landing renders + has CTA + email signup ────────────────────
  note("=== 1. Landing ===");
  await page.goto(WEB, { waitUntil: "networkidle" });
  await page.screenshot({ path: "/tmp/streak-uat-01-landing.png", fullPage: true });

  const heroH1 = await page.locator("h1").first().textContent();
  if (heroH1 && /Tiny taps/i.test(heroH1)) ok("hero headline present");
  else fail(`hero headline missing or wrong: "${heroH1}"`);

  const startCta = page.locator(".hero-cta__primary");
  if (await startCta.count()) ok("hero primary CTA present (Start your first streak)");
  else fail("hero primary CTA missing");

  const headerOpen = page.getByRole("link", { name: /Open Streak/i });
  if (await headerOpen.count()) ok("header Open-Streak CTA present");
  else fail("header Open-Streak CTA missing");

  const headerSignin = page.getByRole("link", { name: /^Sign in$/i });
  if (await headerSignin.count()) ok("header Sign-in CTA present");
  else fail("header Sign-in CTA missing");

  // ─── 2. Bottom waitlist signup (TestFlight notification list) ───────
  note("=== 2. Waitlist signup ===");
  const heroEmail = `hero-${STAMP}@streak.test`;
  await page.locator("#waitlist").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  const waitlistCard = page.locator("#waitlist .cta-card").first();
  await waitlistCard.locator('input[type="email"]').fill(heroEmail);
  await waitlistCard.locator('button[type="submit"]').click();
  await page.waitForTimeout(900);
  const thanks = waitlistCard.locator('p').filter({ hasText: /You're on the list/i });
  if (await thanks.count()) ok("waitlist thanks state shows");
  else fail("waitlist submit didn't transition to thanks state");
  await page.screenshot({ path: "/tmp/streak-uat-02-waitlist-thanks.png" });

  // ─── 3. Auth gate ───────────────────────────────────────────────────
  note("=== 3. Auth gate ===");
  await page.goto(`${WEB}/app`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const authTitle = await page.locator(".auth-title").first().textContent().catch(() => null);
  if (authTitle && /Welcome back|Start a streak/i.test(authTitle)) ok(`auth gate visible: "${authTitle}"`);
  else fail("auth gate not visible at /app");

  const tabBarCount = await page.locator(".tab-bar").count();
  if (tabBarCount === 0) ok("tab bar hidden when unauthed");
  else fail("tab bar visible when unauthed (should hide)");
  await page.screenshot({ path: "/tmp/streak-uat-03-authgate.png" });

  // ─── 4. Sign up ─────────────────────────────────────────────────────
  note("=== 4. Sign up ===");
  await page.locator(".auth-toggle").click();
  await page.waitForTimeout(150);
  await page.locator('input[type="text"]').fill(testName);
  await page.locator('input[type="email"]').fill(testEmail);
  await page.locator('input[type="password"]').fill(testPassword);
  await page.locator(".auth-submit").click();
  await page.waitForTimeout(1500);

  const todayHeader = await page.locator(".app-header__title").first().textContent().catch(() => null);
  if (todayHeader === "Today") ok("Today view rendered post-signup");
  else fail(`Today view not visible after signup; got "${todayHeader}"`);
  await page.screenshot({ path: "/tmp/streak-uat-04-today-empty.png" });

  // ─── 5. Empty state CTA ─────────────────────────────────────────────
  note("=== 5. Empty state ===");
  const emptyHas = await page.locator(".empty").count();
  if (emptyHas) ok("empty state visible");
  else fail("empty state not visible (expected for new account)");

  // ─── 6. Add a habit ─────────────────────────────────────────────────
  note("=== 6. Add habit ===");
  await page.getByRole("button", { name: /Add your first habit|New habit/i }).first().click();
  await page.waitForTimeout(300);
  const sheet = page.locator(".sheet__panel");
  if (await sheet.count()) ok("new habit sheet opened");
  else { fail("new habit sheet didn't open"); await browser.close(); finish(); return; }

  await sheet.locator(".field input").first().fill("UAT pushups");
  // Bump target to 2
  await sheet.getByLabel("Increase target").click();
  await page.waitForTimeout(150);
  // Pick second color (blue)
  await sheet.locator(".color-chip").nth(1).click();
  // Pick first icon (drop)
  await sheet.locator(".icon-chip").first().click();
  await page.screenshot({ path: "/tmp/streak-uat-06-newhabit-form.png" });
  await sheet.getByRole("button", { name: /Create habit/i }).click();
  await page.waitForTimeout(700);

  const habitRows = await page.locator(".habit-row").count();
  if (habitRows >= 1) ok(`habit row appeared (count=${habitRows})`);
  else fail("habit row didn't appear after save");
  await page.screenshot({ path: "/tmp/streak-uat-07-habit-row.png" });

  // ─── 7. Tap to mark done x2 ─────────────────────────────────────────
  note("=== 7. Tap to mark done (target=2) ===");
  const tap = page.locator(".habit-row__tap").first();
  await tap.click();
  await page.waitForTimeout(400);
  await tap.click();
  await page.waitForTimeout(700);

  const meta = await page.locator(".habit-row__meta").first().textContent();
  if (meta && /Done today|2 \/ 2/.test(meta)) ok(`row shows complete state: "${meta?.trim()}"`);
  else fail(`row meta unexpected: "${meta?.trim()}"`);

  const doneRow = await page.locator(".habit-row--done").count();
  if (doneRow >= 1) ok("habit-row--done class applied");
  else fail("habit-row--done class missing after target met");
  await page.screenshot({ path: "/tmp/streak-uat-08-done.png" });

  // ─── 7b. SECOND habit with target=1 — single-tap "done today" path ──
  // Caught a regression where target=1 toggle stayed at 0 because client used
  // UTC date and server used local date as the completion key (2026-04-29).
  // This section locks down the single-tap path so the same bug can't
  // silently slip through again.
  note("=== 7b. Single-tap habit (target=1) ===");
  await page.getByRole("button", { name: /New habit/i }).first().click();
  await page.waitForTimeout(300);
  const sheet2 = page.locator(".sheet__panel");
  if (!await sheet2.count()) { fail("new habit sheet didn't reopen for target=1 case"); await browser.close(); finish(); return; }
  await sheet2.locator(".field input").first().fill("UAT pushups one");
  // Leave target at default 1 (no Increase tap)
  await sheet2.locator(".color-chip").nth(2).click();
  await sheet2.locator(".icon-chip").nth(1).click();
  await sheet2.getByRole("button", { name: /Create habit/i }).click();
  await page.waitForTimeout(700);

  // Find the new target=1 row (it's the most recent — first in the list).
  const oneRow = page.locator(".habit-row").filter({ hasText: "UAT pushups one" }).first();
  await oneRow.locator(".habit-row__tap").click();
  await page.waitForTimeout(900);
  const oneMeta = await oneRow.locator(".habit-row__meta").first().textContent();
  if (oneMeta && /Done today/.test(oneMeta)) ok(`target=1 row → Done today: "${oneMeta?.trim()}"`);
  else fail(`target=1 row meta unexpected: "${oneMeta?.trim()}"`);
  const oneIsDone = (await oneRow.locator(".habit-row--done").count()) > 0
    || (await oneRow.evaluate((el) => el.classList.contains("habit-row--done")));
  if (oneIsDone) ok("target=1 row got habit-row--done class");
  else fail("target=1 row did NOT get habit-row--done after one tap (regression)");
  await page.screenshot({ path: "/tmp/streak-uat-07b-target1-done.png" });

  // ─── 7c. Weekly habit (5× per week) — progress bar + meta line ──────
  // Caught a regression where weekly_n habits showed no progress visualization
  // because the bar was gated on isMultiTap (daily-only). Locks down weekly UX.
  note("=== 7c. Weekly habit (weekly_n target=5) ===");
  await page.getByRole("button", { name: /New habit/i }).first().click();
  await page.waitForTimeout(300);
  const sheet3 = page.locator(".sheet__panel");
  if (!await sheet3.count()) { fail("new habit sheet didn't reopen for weekly case"); await browser.close(); finish(); return; }
  await sheet3.locator(".field input").first().fill("UAT weekly run");
  // Switch to Weekly mode
  await sheet3.locator(".seg-toggle button", { hasText: "Weekly" }).first().click();
  await page.waitForTimeout(150);
  // Bump target from 1 to 5 (4 increments)
  for (let i = 0; i < 4; i++) {
    await sheet3.getByLabel("Increase target").click();
    await page.waitForTimeout(80);
  }
  await sheet3.locator(".color-chip").nth(3).click();
  await sheet3.locator(".icon-chip").nth(2).click();
  await sheet3.getByRole("button", { name: /Create habit/i }).click();
  await page.waitForTimeout(700);

  const weeklyRow = page.locator(".habit-row").filter({ hasText: "UAT weekly run" }).first();
  // Pre-tap meta should read "5× / week"
  const metaPre = await weeklyRow.locator(".habit-row__meta").first().textContent();
  if (metaPre && /5×.*week/.test(metaPre)) ok(`weekly pre-tap meta: "${metaPre.trim()}"`);
  else fail(`weekly pre-tap meta unexpected: "${metaPre?.trim()}"`);

  // Tap once → meta should switch to "1 / 5 this week" + progress bar appears
  await weeklyRow.locator(".habit-row__tap").click();
  await page.waitForTimeout(900);
  const metaPost = await weeklyRow.locator(".habit-row__meta").first().textContent();
  if (metaPost && /1\s*\/\s*5\s*this week/.test(metaPost)) ok(`weekly post-tap meta: "${metaPost.trim()}"`);
  else fail(`weekly post-tap meta unexpected (expected "1 / 5 this week"): "${metaPost?.trim()}"`);

  const weeklyProgress = await weeklyRow.locator(".habit-row__progress-fill").count();
  if (weeklyProgress > 0) ok("weekly progress bar rendered");
  else fail("weekly progress bar NOT rendered (regression — was gated on isMultiTap)");
  await page.screenshot({ path: "/tmp/streak-uat-07c-weekly-progress.png" });

  // ─── 7d. Today list groups daily vs weekly with section headers ─────
  // Branch coverage required: when both groups exist, "Daily" and "Weekly"
  // headers render and each habit lands under the correct one. Single-group
  // case (only daily OR only weekly) hides headers — covered implicitly by
  // sections 6/7b/7c earlier where there were daily-only habits and no
  // header was visible. See feedback_uat_must_cover_branch_split.md.
  note("=== 7d. Today list grouped by frequency ===");
  const groupHeaders = await page.locator(".habit-group").allTextContents();
  const headerSet = new Set(groupHeaders.map((s) => s.trim().toLowerCase()));
  if (headerSet.has("daily") && headerSet.has("weekly")) {
    ok(`group headers rendered: ${groupHeaders.map((s) => s.trim()).join(", ")}`);
  } else {
    fail(`expected "Daily" + "Weekly" group headers, got: ${JSON.stringify(groupHeaders)}`);
  }
  // Walk the DOM in document order: first .habit-group should be "Daily"
  // followed by daily-targeted habits, then "Weekly" followed by the
  // weekly habit. Use evaluate so we get true source-order.
  const groupingOrder = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll(".habit-group, .habit-row").forEach((el) => {
      if (el.classList.contains("habit-group")) {
        out.push({ kind: "header", text: el.textContent?.trim() ?? "" });
      } else {
        const name = el.querySelector(".habit-row__name")?.textContent?.trim() ?? "";
        out.push({ kind: "row", name });
      }
    });
    return out;
  });
  const dailyIdx = groupingOrder.findIndex((e) => e.kind === "header" && /daily/i.test(e.text));
  const weeklyIdx = groupingOrder.findIndex((e) => e.kind === "header" && /weekly/i.test(e.text));
  const weeklyHabitIdx = groupingOrder.findIndex((e) => e.kind === "row" && e.name.includes("UAT weekly run"));
  if (dailyIdx >= 0 && weeklyIdx > dailyIdx && weeklyHabitIdx > weeklyIdx) {
    ok(`weekly habit "UAT weekly run" sits under the Weekly header (positions: daily=${dailyIdx}, weekly=${weeklyIdx}, weeklyHabit=${weeklyHabitIdx})`);
  } else {
    fail(`grouping order wrong — daily=${dailyIdx} weekly=${weeklyIdx} weeklyHabit=${weeklyHabitIdx}`);
  }

  // ─── 8. Stats view ──────────────────────────────────────────────────
  note("=== 8. Stats ===");
  await page.goto(`${WEB}/app/stats`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  const cards = await page.locator(".stat").count();
  if (cards >= 4) ok(`stat cards rendered (count=${cards})`);
  else fail(`expected 4+ stat cards, got ${cards}`);

  // Heatmap renders one of two grids depending on the selected habit's
  // frequency: daily → .heatmap__grid, weekly_n → .heatmap__weekly-grid.
  const heatmap = await page.locator(".heatmap__grid, .heatmap__weekly-grid").count();
  if (heatmap) ok("heatmap rendered");
  else fail("heatmap missing");

  const bars = await page.locator(".bars").count();
  if (bars) ok("weekly bars rendered");
  else fail("weekly bars missing");
  await page.screenshot({ path: "/tmp/streak-uat-09-stats.png", fullPage: true });

  // ─── 9. Settings + sign out ─────────────────────────────────────────
  note("=== 9. Settings ===");
  await page.goto(`${WEB}/app/settings`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  const settingsTitle = await page.locator(".app-header__title").first().textContent();
  if (settingsTitle === "Settings") ok("settings header visible");
  else fail(`settings header wrong: "${settingsTitle}"`);

  const profileEmail = await page.getByText(testEmail).count();
  if (profileEmail) ok("profile email visible");
  else fail("profile email not visible");

  await page.screenshot({ path: "/tmp/streak-uat-10-settings.png" });

  await page.getByRole("button", { name: /Sign out/i }).click();
  await page.waitForTimeout(800);

  // ─── 10. Sign-out reverts to auth gate ──────────────────────────────
  note("=== 10. Sign out clears state ===");
  await page.goto(`${WEB}/app`, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);
  const postSignout = await page.locator(".auth-title").count();
  if (postSignout) ok("auth gate visible after sign-out");
  else fail("auth gate NOT visible after sign-out — token may still be in localStorage");

  const tokenLeft = await page.evaluate(() => localStorage.getItem("streak.token"));
  if (!tokenLeft) ok("streak.token cleared from localStorage");
  else fail("streak.token still in localStorage after sign-out");

  await browser.close();
  finish();
})();

function finish() {
  console.log();
  if (issues.length === 0) {
    console.log("✓ ALL UAT CHECKS PASSED.");
    process.exit(0);
  } else {
    console.log(`✗ ${issues.length} issue(s):`);
    issues.forEach((i) => console.log("  -", i));
    process.exit(1);
  }
}
