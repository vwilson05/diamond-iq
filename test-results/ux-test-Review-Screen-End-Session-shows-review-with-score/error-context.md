# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ux-test.spec.js >> Review Screen >> End Session shows review with score
- Location: tests/ux-test.spec.js:373:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: .review-iq-score, text=/\d+ IQ/
Expected: visible
Error: Unexpected token "=" while parsing css selector ".review-iq-score, text=/\d+ IQ/". Did you mean to CSS.escape it?

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for .review-iq-score, text=/\d+ IQ/

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]: PLAYIQ
    - generic [ref=e6]: Session Complete
    - generic [ref=e7]:
      - img [ref=e8]
      - generic [ref=e11]:
        - generic [ref=e12]: A+
        - generic [ref=e13]: 100%
    - generic [ref=e14]: 10 IQ
    - generic [ref=e15]: 1 scenario completed
  - generic [ref=e17]:
    - generic [ref=e18]: Wait Your Turn to Bat!
    - generic [ref=e19]: Great Teammate! Ready to Hit!
    - generic [ref=e20]: Being a good teammate means cheering for your friends when they're batting! Yelling 'Let's go!' and clapping makes them feel good and play better. Plus, while you're watching and cheering, you're also learning! You can see what the fielders are doing, where the ball is going, and get ready for YOUR turn. When your name gets called, you'll be ready because you were paying attention the whole time.
    - generic [ref=e21]:
      - generic [ref=e22]: Remember This
      - generic [ref=e23]: Cheer for your teammates and watch the game while you wait! You'll be a great teammate AND you'll be ready when it's your turn.
  - button "PLAY AGAIN" [ref=e24] [cursor=pointer]
```

# Test source

```ts
  284 |   });
  285 | 
  286 |   test('team grid shows 2 columns on phone', async ({ page }) => {
  287 |     await page.setViewportSize(VIEWPORTS.phone);
  288 |     await page.goto(BASE);
  289 |     await page.locator('text=Play as Guest').click();
  290 |     await page.waitForTimeout(500);
  291 | 
  292 |     const firstCard = page.locator('.team-card').first();
  293 |     const secondCard = page.locator('.team-card').nth(1);
  294 |     const box1 = await firstCard.boundingBox();
  295 |     const box2 = await secondCard.boundingBox();
  296 | 
  297 |     // Second card should be on the same row (not below)
  298 |     expect(Math.abs(box1.y - box2.y)).toBeLessThan(10);
  299 |   });
  300 | });
  301 | 
  302 | // ============================================================
  303 | // TEST SUITE 9: Responsive — iPad
  304 | // ============================================================
  305 | test.describe('iPad Layout', () => {
  306 |   test('field does not stretch on iPad', async ({ page }) => {
  307 |     await page.setViewportSize(VIEWPORTS.ipad);
  308 |     await navigateToGame(page, 'T-Ball');
  309 | 
  310 |     const canvas = page.locator('#field-canvas');
  311 |     const box = await canvas.boundingBox();
  312 | 
  313 |     // Field should not take more than 60% of viewport height
  314 |     expect(box.height).toBeLessThan(VIEWPORTS.ipad.height * 0.6);
  315 |   });
  316 | 
  317 |   test('choices are clickable on iPad', async ({ page }) => {
  318 |     await page.setViewportSize(VIEWPORTS.ipad);
  319 |     await navigateToGame(page, 'T-Ball');
  320 |     const headline = await playOneScenario(page);
  321 |     expect(headline).toBeTruthy();
  322 |   });
  323 | });
  324 | 
  325 | // ============================================================
  326 | // TEST SUITE 10: API — Scenarios
  327 | // ============================================================
  328 | test.describe('Scenario API', () => {
  329 |   for (const tier of ['tball', 'rookie', 'minors', 'majors', 'the-show']) {
  330 |     test(`/api/scenarios/${tier} returns 20+ scenarios`, async ({ request }) => {
  331 |       const res = await request.get(`${BASE}/api/scenarios/${tier}`);
  332 |       expect(res.status()).toBe(200);
  333 |       const data = await res.json();
  334 |       expect(data.length).toBeGreaterThanOrEqual(20);
  335 |     });
  336 |   }
  337 | 
  338 |   test('each scenario has required fields', async ({ request }) => {
  339 |     const res = await request.get(`${BASE}/api/scenarios/tball`);
  340 |     const scenarios = await res.json();
  341 | 
  342 |     for (const s of scenarios.slice(0, 5)) {
  343 |       expect(s.id).toBeTruthy();
  344 |       expect(s.title).toBeTruthy();
  345 |       expect(s.tier).toBe('tball');
  346 |       expect(s.nodes).toBeTruthy();
  347 |       expect(s.nodes.root).toBeTruthy();
  348 |       expect(s.setup).toBeTruthy();
  349 |       expect(s.setup.inning).toBeGreaterThan(0);
  350 |     }
  351 |   });
  352 | 
  353 |   test('scenario root node has choices', async ({ request }) => {
  354 |     const res = await request.get(`${BASE}/api/scenarios/tball`);
  355 |     const scenarios = await res.json();
  356 | 
  357 |     for (const s of scenarios.slice(0, 5)) {
  358 |       const root = s.nodes.root;
  359 |       // Root should be a decision (or transition pointing to decision)
  360 |       if (root.type === 'decision') {
  361 |         expect(root.choices.length).toBeGreaterThanOrEqual(2);
  362 |       } else if (root.type === 'transition') {
  363 |         expect(root.next).toBeTruthy();
  364 |       }
  365 |     }
  366 |   });
  367 | });
  368 | 
  369 | // ============================================================
  370 | // TEST SUITE 11: Review Screen
  371 | // ============================================================
  372 | test.describe('Review Screen', () => {
  373 |   test('End Session shows review with score', async ({ page }) => {
  374 |     await navigateToGame(page, 'T-Ball');
  375 |     await playOneScenario(page);
  376 | 
  377 |     // Open menu and end session
  378 |     await page.locator('#btn-menu').click();
  379 |     await page.locator('#menu-end').click();
  380 |     await page.waitForTimeout(500);
  381 | 
  382 |     // Should show review screen
  383 |     await expect(page.locator('text=Session Complete')).toBeVisible();
> 384 |     await expect(page.locator('.review-iq-score, text=/\\d+ IQ/')).toBeVisible();
      |                                                                    ^ Error: expect(locator).toBeVisible() failed
  385 |   });
  386 | });
  387 | 
  388 | // ============================================================
  389 | // TEST SUITE 12: Play Again Flow
  390 | // ============================================================
  391 | test.describe('Play Again', () => {
  392 |   test('Play Again starts a new game without re-picking', async ({ page }) => {
  393 |     await navigateToGame(page, 'T-Ball');
  394 |     await playOneScenario(page);
  395 | 
  396 |     await page.locator('#btn-menu').click();
  397 |     await page.locator('#menu-end').click();
  398 |     await page.waitForTimeout(500);
  399 | 
  400 |     // Click Play Again
  401 |     await page.locator('.btn-play-again').click();
  402 |     await page.waitForTimeout(4000);
  403 | 
  404 |     // Should go straight to game, not team select
  405 |     const choices = page.locator('.choice-btn');
  406 |     await choices.first().waitFor({ timeout: 15000 });
  407 |     expect(await choices.count()).toBeGreaterThanOrEqual(2);
  408 |   });
  409 | });
  410 | 
```