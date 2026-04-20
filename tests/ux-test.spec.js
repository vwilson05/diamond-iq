/**
 * PlayIQ — Full UX Test Suite
 * Tests all user flows across all tiers, devices, and edge cases.
 * Run with: bunx playwright test tests/ux-test.js
 */

const { test, expect } = require('@playwright/test');

const BASE = 'http://localhost:3456';

const TIERS = ['T-Ball', 'Rookie', 'Minors', 'Majors', 'The Show'];
const VIEWPORTS = {
  desktop: { width: 1280, height: 800 },
  ipad: { width: 1024, height: 768 },
  phone: { width: 390, height: 844 },
};

// Helper: navigate through auth + team + tier + sport to game screen
async function navigateToGame(page, tier = 'T-Ball', team = 'SDP San Diego Padres') {
  await page.goto(BASE);
  await page.waitForTimeout(500);

  // Skip auth (guest mode)
  const guestBtn = page.locator('text=Play as Guest');
  if (await guestBtn.count() > 0) {
    await guestBtn.click();
    await page.waitForTimeout(500);
  }

  // Pick team
  await page.getByRole('button', { name: team }).click();
  await page.waitForTimeout(300);

  // Pick tier
  await page.getByRole('button', { name: tier }).click();
  await page.waitForTimeout(300);

  // Pick sport
  await page.getByRole('button', { name: 'Baseball' }).click();
  await page.waitForTimeout(3000);
}

// Helper: play through one scenario (pick first choice)
async function playOneScenario(page) {
  // Wait for choices
  const choiceBtn = page.locator('.choice-btn').first();
  await choiceBtn.waitFor({ timeout: 15000 });
  await page.waitForTimeout(300);

  // Click first choice
  await choiceBtn.click();
  await page.waitForTimeout(500);

  // Verify outcome appeared
  const headline = page.locator('.outcome-headline');
  await headline.waitFor({ timeout: 5000 });
  return await headline.textContent();
}

// ============================================================
// TEST SUITE 1: Auth Screen
// ============================================================
test.describe('Auth Screen', () => {
  test('renders login and signup tabs', async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator('text=I Have an Account')).toBeVisible();
    await expect(page.locator('text=I\'m New')).toBeVisible();
    await expect(page.locator('text=Play as Guest')).toBeVisible();
  });

  test('guest mode bypasses auth', async ({ page }) => {
    await page.goto(BASE);
    await page.locator('text=Play as Guest').click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=Pick Your Team')).toBeVisible();
  });

  test('signup tab shows avatar picker and fields', async ({ page }) => {
    await page.goto(BASE);
    await page.locator('text=I\'m New').click();
    await page.waitForTimeout(300);
    await expect(page.locator('#auth-signup-name')).toBeVisible();
    await expect(page.locator('#auth-signup-username')).toBeVisible();
    await expect(page.locator('.avatar-btn').first()).toBeVisible();
  });
});

// ============================================================
// TEST SUITE 2: Team Selection
// ============================================================
test.describe('Team Selection', () => {
  test('shows all 30 MLB teams', async ({ page }) => {
    await page.goto(BASE);
    await page.locator('text=Play as Guest').click();
    await page.waitForTimeout(500);
    const teamCards = page.locator('.team-card');
    await expect(teamCards).toHaveCount(30);
  });

  test('clicking a team advances to difficulty select', async ({ page }) => {
    await page.goto(BASE);
    await page.locator('text=Play as Guest').click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'NYY New York Yankees' }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=Choose Your Level')).toBeVisible();
  });
});

// ============================================================
// TEST SUITE 3: Difficulty Selection
// ============================================================
test.describe('Difficulty Selection', () => {
  test('shows all 5 tiers', async ({ page }) => {
    await page.goto(BASE);
    await page.locator('text=Play as Guest').click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'SDP San Diego Padres' }).click();
    await page.waitForTimeout(500);
    const cards = page.locator('.difficulty-card');
    await expect(cards).toHaveCount(5);
  });

  test('clicking a tier advances to sport select', async ({ page }) => {
    await page.goto(BASE);
    await page.locator('text=Play as Guest').click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'SDP San Diego Padres' }).click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Rookie' }).click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=Choose Your Game')).toBeVisible();
  });
});

// ============================================================
// TEST SUITE 4: Game Flow — All Tiers
// ============================================================
for (const tier of TIERS) {
  test.describe(`Game Flow — ${tier}`, () => {
    test(`loads a scenario at ${tier} level`, async ({ page }) => {
      await navigateToGame(page, tier);

      // Should see the scenario panel with choices
      const choices = page.locator('.choice-btn');
      await choices.first().waitFor({ timeout: 15000 });
      const count = await choices.count();
      expect(count).toBeGreaterThanOrEqual(2);
    });

    test(`can complete a scenario at ${tier} level`, async ({ page }) => {
      await navigateToGame(page, tier);
      const headline = await playOneScenario(page);
      expect(headline).toBeTruthy();
      expect(headline.length).toBeGreaterThan(3);
    });

    test(`shows Key Terms on great outcome at ${tier}`, async ({ page }) => {
      await navigateToGame(page, tier);
      await playOneScenario(page);

      // Check for Key Terms or Remember This (at least one should appear)
      const keyTerms = page.locator('.outcome-terms');
      const rememberThis = page.locator('.outcome-remember');
      const hasKeyTerms = await keyTerms.count() > 0;
      const hasRemember = await rememberThis.count() > 0;
      expect(hasKeyTerms || hasRemember).toBeTruthy();
    });

    test(`IQ updates after answering at ${tier}`, async ({ page }) => {
      await navigateToGame(page, tier);
      await playOneScenario(page);

      const iqText = await page.locator('.iq-display').textContent();
      const iqValue = parseInt(iqText.replace(/\D/g, ''));
      expect(iqValue).toBeGreaterThan(0);
    });

    test(`Next Scenario button works at ${tier}`, async ({ page }) => {
      await navigateToGame(page, tier);
      await playOneScenario(page);

      const nextBtn = page.locator('.btn-next-scenario');
      await nextBtn.waitFor({ timeout: 5000 });
      await nextBtn.click();
      await page.waitForTimeout(3000);

      // Should load a new scenario with choices
      const choices = page.locator('.choice-btn');
      await choices.first().waitFor({ timeout: 15000 });
      expect(await choices.count()).toBeGreaterThanOrEqual(2);
    });
  });
}

// ============================================================
// TEST SUITE 5: No Duplicate Scenarios
// ============================================================
test.describe('No Duplicate Scenarios', () => {
  test('3 consecutive scenarios are all different', async ({ page }) => {
    await navigateToGame(page, 'T-Ball');
    const headlines = [];

    for (let i = 0; i < 3; i++) {
      const narration = await page.locator('.narration-text').textContent();
      headlines.push(narration);

      await playOneScenario(page);

      const nextBtn = page.locator('.btn-next-scenario');
      const btnText = await nextBtn.textContent();

      if (btnText.includes('See Results')) break;
      await nextBtn.click();
      await page.waitForTimeout(3000);
    }

    // All narrations should be unique
    const unique = new Set(headlines);
    expect(unique.size).toBe(headlines.length);
  });
});

// ============================================================
// TEST SUITE 6: Scoreboard
// ============================================================
test.describe('Scoreboard', () => {
  test('scoreboard renders with team abbreviation', async ({ page }) => {
    await navigateToGame(page, 'T-Ball');
    const scoreboard = page.locator('.diq-scoreboard, .scoreboard');
    await expect(scoreboard.first()).toBeVisible();

    // Should show SDP (Padres)
    const sbText = await scoreboard.first().textContent();
    expect(sbText).toContain('SDP');
  });
});

// ============================================================
// TEST SUITE 7: Menu
// ============================================================
test.describe('Menu', () => {
  test('menu opens and closes', async ({ page }) => {
    await navigateToGame(page, 'T-Ball');

    const menu = page.locator('.game-menu');
    await expect(menu).toHaveClass(/hidden/);

    await page.locator('#btn-menu').click();
    await expect(menu).not.toHaveClass(/hidden/);

    // Click outside to close
    await page.locator('.game-body').click();
    await page.waitForTimeout(300);
    await expect(menu).toHaveClass(/hidden/);
  });

  test('Change Level goes to difficulty select', async ({ page }) => {
    await navigateToGame(page, 'T-Ball');
    await page.locator('#btn-menu').click();
    await page.locator('#menu-change-level').click();
    await page.waitForTimeout(500);
    await expect(page.locator('text=Choose Your Level')).toBeVisible();
  });
});

// ============================================================
// TEST SUITE 8: Responsive — Mobile
// ============================================================
test.describe('Mobile Layout', () => {
  test('game screen is usable on phone', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.phone);
    await navigateToGame(page, 'T-Ball');

    // Field should be compact at top
    const canvas = page.locator('#field-canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox.height).toBeLessThan(250); // compact, not half screen

    // Choices should be visible (scrollable)
    const choices = page.locator('.choice-btn');
    await choices.first().waitFor({ timeout: 15000 });
    expect(await choices.count()).toBeGreaterThanOrEqual(2);
  });

  test('team grid shows 2 columns on phone', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.phone);
    await page.goto(BASE);
    await page.locator('text=Play as Guest').click();
    await page.waitForTimeout(500);

    const firstCard = page.locator('.team-card').first();
    const secondCard = page.locator('.team-card').nth(1);
    const box1 = await firstCard.boundingBox();
    const box2 = await secondCard.boundingBox();

    // Second card should be on the same row (not below)
    expect(Math.abs(box1.y - box2.y)).toBeLessThan(10);
  });
});

// ============================================================
// TEST SUITE 9: Responsive — iPad
// ============================================================
test.describe('iPad Layout', () => {
  test('field does not stretch on iPad', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.ipad);
    await navigateToGame(page, 'T-Ball');

    const canvas = page.locator('#field-canvas');
    const box = await canvas.boundingBox();

    // Field should not take more than 60% of viewport height
    expect(box.height).toBeLessThan(VIEWPORTS.ipad.height * 0.6);
  });

  test('choices are clickable on iPad', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.ipad);
    await navigateToGame(page, 'T-Ball');
    const headline = await playOneScenario(page);
    expect(headline).toBeTruthy();
  });
});

// ============================================================
// TEST SUITE 10: API — Scenarios
// ============================================================
test.describe('Scenario API', () => {
  for (const tier of ['tball', 'rookie', 'minors', 'majors', 'the-show']) {
    test(`/api/scenarios/${tier} returns 20+ scenarios`, async ({ request }) => {
      const res = await request.get(`${BASE}/api/scenarios/${tier}`);
      expect(res.status()).toBe(200);
      const data = await res.json();
      expect(data.length).toBeGreaterThanOrEqual(20);
    });
  }

  test('each scenario has required fields', async ({ request }) => {
    const res = await request.get(`${BASE}/api/scenarios/tball`);
    const scenarios = await res.json();

    for (const s of scenarios.slice(0, 5)) {
      expect(s.id).toBeTruthy();
      expect(s.title).toBeTruthy();
      expect(s.tier).toBe('tball');
      expect(s.nodes).toBeTruthy();
      expect(s.nodes.root).toBeTruthy();
      expect(s.setup).toBeTruthy();
      expect(s.setup.inning).toBeGreaterThan(0);
    }
  });

  test('scenario root node has choices', async ({ request }) => {
    const res = await request.get(`${BASE}/api/scenarios/tball`);
    const scenarios = await res.json();

    for (const s of scenarios.slice(0, 5)) {
      const root = s.nodes.root;
      // Root should be a decision (or transition pointing to decision)
      if (root.type === 'decision') {
        expect(root.choices.length).toBeGreaterThanOrEqual(2);
      } else if (root.type === 'transition') {
        expect(root.next).toBeTruthy();
      }
    }
  });
});

// ============================================================
// TEST SUITE 11: Review Screen
// ============================================================
test.describe('Review Screen', () => {
  test('End Session shows review with score', async ({ page }) => {
    await navigateToGame(page, 'T-Ball');
    await playOneScenario(page);

    // Open menu and end session
    await page.locator('#btn-menu').click();
    await page.locator('#menu-end').click();
    await page.waitForTimeout(500);

    // Should show review screen
    await expect(page.locator('text=Session Complete')).toBeVisible();
    await expect(page.locator('.review-iq-score, text=/\\d+ IQ/')).toBeVisible();
  });
});

// ============================================================
// TEST SUITE 12: Play Again Flow
// ============================================================
test.describe('Play Again', () => {
  test('Play Again starts a new game without re-picking', async ({ page }) => {
    await navigateToGame(page, 'T-Ball');
    await playOneScenario(page);

    await page.locator('#btn-menu').click();
    await page.locator('#menu-end').click();
    await page.waitForTimeout(500);

    // Click Play Again
    await page.locator('.btn-play-again').click();
    await page.waitForTimeout(4000);

    // Should go straight to game, not team select
    const choices = page.locator('.choice-btn');
    await choices.first().waitFor({ timeout: 15000 });
    expect(await choices.count()).toBeGreaterThanOrEqual(2);
  });
});
