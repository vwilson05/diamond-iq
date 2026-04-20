# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ux-test.spec.js >> Game Flow — Minors >> IQ updates after answering at Minors
- Location: tests/ux-test.spec.js:170:5

# Error details

```
TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
Call log:
  - waiting for locator('.outcome-headline') to be visible

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e5]: PLAYIQ
      - generic [ref=e6]: Minors
    - generic [ref=e7]: "IQ: 0"
    - generic [ref=e8]:
      - generic [ref=e9]: Scenario 1
      - button "Menu" [ref=e11] [cursor=pointer]:
        - img [ref=e12]
  - generic [ref=e13]:
    - generic [ref=e15]:
      - generic [ref=e16]:
        - generic [ref=e17]:
          - img [ref=e19]
          - generic [ref=e22]: Inn
          - text: Bot 6
        - generic [ref=e23]:
          - img [ref=e25]
          - generic [ref=e28]: Outs
          - text: "0"
        - generic [ref=e29]:
          - img [ref=e31]
          - generic [ref=e33]: Score
          - text: 3-3
        - generic [ref=e34]:
          - img [ref=e36]
          - generic [ref=e38]: Runners
          - text: 2nd
      - generic [ref=e39]: The third baseman fields your bunt and has to make a choice. But think about it from YOUR perspective -- where do you think the defense should throw, and why is this bunt such a smart play?
      - generic [ref=e40]:
        - button "A They'll throw to first to get me out -- but the runner reaches third. That's the sacrifice!" [ref=e41] [cursor=pointer]:
          - generic [ref=e42]: A
          - generic [ref=e43]: They'll throw to first to get me out -- but the runner reaches third. That's the sacrifice!
        - button "B They might throw to third to get the lead runner!" [ref=e44] [cursor=pointer]:
          - generic [ref=e45]: B
          - generic [ref=e46]: They might throw to third to get the lead runner!
        - button "C Maybe they just hold the ball since they can't get anyone." [ref=e47] [cursor=pointer]:
          - generic [ref=e48]: C
          - generic [ref=e49]: Maybe they just hold the ball since they can't get anyone.
    - generic [ref=e53]:
      - generic [ref=e54]:
        - generic [ref=e55]: PlayIQ
        - generic [ref=e57]:
          - generic [ref=e58]: ▼
          - text: 6th
      - generic [ref=e59]:
        - generic [ref=e60]:
          - generic [ref=e62]: "1"
          - generic [ref=e63]: "2"
          - generic [ref=e64]: "3"
          - generic [ref=e65]: "4"
          - generic [ref=e66]: "5"
          - generic [ref=e67]: "6"
          - generic [ref=e68]: "7"
          - generic [ref=e69]: "8"
          - generic [ref=e70]: "9"
          - generic [ref=e71]: R
          - generic [ref=e72]: H
          - generic [ref=e73]: E
        - generic [ref=e74]:
          - generic [ref=e75]: AWAY
          - generic [ref=e77]: "0"
          - generic [ref=e78]: "0"
          - generic [ref=e79]: "0"
          - generic [ref=e80]: "0"
          - generic [ref=e81]: "3"
          - generic [ref=e82]: "0"
          - generic [ref=e86]: "3"
          - generic [ref=e87]: "4"
          - generic [ref=e88]: "0"
        - generic [ref=e89]:
          - generic [ref=e90]: SDP
          - generic [ref=e92]: "0"
          - generic [ref=e93]: "0"
          - generic [ref=e94]: "0"
          - generic [ref=e95]: "3"
          - generic [ref=e96]: "0"
          - generic [ref=e97]: "0"
          - generic [ref=e101]: "3"
          - generic [ref=e102]: "4"
          - generic [ref=e103]: "0"
      - generic [ref=e104]:
        - generic [ref=e106]: B
        - generic [ref=e112]: S
        - generic [ref=e117]: OUT
```

# Test source

```ts
  1   | /**
  2   |  * PlayIQ — Full UX Test Suite
  3   |  * Tests all user flows across all tiers, devices, and edge cases.
  4   |  * Run with: bunx playwright test tests/ux-test.js
  5   |  */
  6   | 
  7   | const { test, expect } = require('@playwright/test');
  8   | 
  9   | const BASE = 'http://localhost:3456';
  10  | 
  11  | const TIERS = ['T-Ball', 'Rookie', 'Minors', 'Majors', 'The Show'];
  12  | const VIEWPORTS = {
  13  |   desktop: { width: 1280, height: 800 },
  14  |   ipad: { width: 1024, height: 768 },
  15  |   phone: { width: 390, height: 844 },
  16  | };
  17  | 
  18  | // Helper: navigate through auth + team + tier + sport to game screen
  19  | async function navigateToGame(page, tier = 'T-Ball', team = 'SDP San Diego Padres') {
  20  |   await page.goto(BASE);
  21  |   await page.waitForTimeout(500);
  22  | 
  23  |   // Skip auth (guest mode)
  24  |   const guestBtn = page.locator('text=Play as Guest');
  25  |   if (await guestBtn.count() > 0) {
  26  |     await guestBtn.click();
  27  |     await page.waitForTimeout(500);
  28  |   }
  29  | 
  30  |   // Pick team
  31  |   await page.getByRole('button', { name: team }).click();
  32  |   await page.waitForTimeout(300);
  33  | 
  34  |   // Pick tier
  35  |   await page.getByRole('button', { name: tier }).click();
  36  |   await page.waitForTimeout(300);
  37  | 
  38  |   // Pick sport
  39  |   await page.getByRole('button', { name: 'Baseball' }).click();
  40  |   await page.waitForTimeout(3000);
  41  | }
  42  | 
  43  | // Helper: play through one scenario (pick first choice)
  44  | async function playOneScenario(page) {
  45  |   // Wait for choices
  46  |   const choiceBtn = page.locator('.choice-btn').first();
  47  |   await choiceBtn.waitFor({ timeout: 15000 });
  48  |   await page.waitForTimeout(300);
  49  | 
  50  |   // Click first choice
  51  |   await choiceBtn.click();
  52  |   await page.waitForTimeout(500);
  53  | 
  54  |   // Verify outcome appeared
  55  |   const headline = page.locator('.outcome-headline');
> 56  |   await headline.waitFor({ timeout: 5000 });
      |                  ^ TimeoutError: locator.waitFor: Timeout 5000ms exceeded.
  57  |   return await headline.textContent();
  58  | }
  59  | 
  60  | // ============================================================
  61  | // TEST SUITE 1: Auth Screen
  62  | // ============================================================
  63  | test.describe('Auth Screen', () => {
  64  |   test('renders login and signup tabs', async ({ page }) => {
  65  |     await page.goto(BASE);
  66  |     await expect(page.locator('text=I Have an Account')).toBeVisible();
  67  |     await expect(page.locator('text=I\'m New')).toBeVisible();
  68  |     await expect(page.locator('text=Play as Guest')).toBeVisible();
  69  |   });
  70  | 
  71  |   test('guest mode bypasses auth', async ({ page }) => {
  72  |     await page.goto(BASE);
  73  |     await page.locator('text=Play as Guest').click();
  74  |     await page.waitForTimeout(500);
  75  |     await expect(page.locator('text=Pick Your Team')).toBeVisible();
  76  |   });
  77  | 
  78  |   test('signup tab shows avatar picker and fields', async ({ page }) => {
  79  |     await page.goto(BASE);
  80  |     await page.locator('text=I\'m New').click();
  81  |     await page.waitForTimeout(300);
  82  |     await expect(page.locator('#auth-signup-name')).toBeVisible();
  83  |     await expect(page.locator('#auth-signup-username')).toBeVisible();
  84  |     await expect(page.locator('.avatar-btn').first()).toBeVisible();
  85  |   });
  86  | });
  87  | 
  88  | // ============================================================
  89  | // TEST SUITE 2: Team Selection
  90  | // ============================================================
  91  | test.describe('Team Selection', () => {
  92  |   test('shows all 30 MLB teams', async ({ page }) => {
  93  |     await page.goto(BASE);
  94  |     await page.locator('text=Play as Guest').click();
  95  |     await page.waitForTimeout(500);
  96  |     const teamCards = page.locator('.team-card');
  97  |     await expect(teamCards).toHaveCount(30);
  98  |   });
  99  | 
  100 |   test('clicking a team advances to difficulty select', async ({ page }) => {
  101 |     await page.goto(BASE);
  102 |     await page.locator('text=Play as Guest').click();
  103 |     await page.waitForTimeout(500);
  104 |     await page.getByRole('button', { name: 'NYY New York Yankees' }).click();
  105 |     await page.waitForTimeout(500);
  106 |     await expect(page.locator('text=Choose Your Level')).toBeVisible();
  107 |   });
  108 | });
  109 | 
  110 | // ============================================================
  111 | // TEST SUITE 3: Difficulty Selection
  112 | // ============================================================
  113 | test.describe('Difficulty Selection', () => {
  114 |   test('shows all 5 tiers', async ({ page }) => {
  115 |     await page.goto(BASE);
  116 |     await page.locator('text=Play as Guest').click();
  117 |     await page.waitForTimeout(500);
  118 |     await page.getByRole('button', { name: 'SDP San Diego Padres' }).click();
  119 |     await page.waitForTimeout(500);
  120 |     const cards = page.locator('.difficulty-card');
  121 |     await expect(cards).toHaveCount(5);
  122 |   });
  123 | 
  124 |   test('clicking a tier advances to sport select', async ({ page }) => {
  125 |     await page.goto(BASE);
  126 |     await page.locator('text=Play as Guest').click();
  127 |     await page.waitForTimeout(500);
  128 |     await page.getByRole('button', { name: 'SDP San Diego Padres' }).click();
  129 |     await page.waitForTimeout(500);
  130 |     await page.getByRole('button', { name: 'Rookie' }).click();
  131 |     await page.waitForTimeout(500);
  132 |     await expect(page.locator('text=Choose Your Game')).toBeVisible();
  133 |   });
  134 | });
  135 | 
  136 | // ============================================================
  137 | // TEST SUITE 4: Game Flow — All Tiers
  138 | // ============================================================
  139 | for (const tier of TIERS) {
  140 |   test.describe(`Game Flow — ${tier}`, () => {
  141 |     test(`loads a scenario at ${tier} level`, async ({ page }) => {
  142 |       await navigateToGame(page, tier);
  143 | 
  144 |       // Should see the scenario panel with choices
  145 |       const choices = page.locator('.choice-btn');
  146 |       await choices.first().waitFor({ timeout: 15000 });
  147 |       const count = await choices.count();
  148 |       expect(count).toBeGreaterThanOrEqual(2);
  149 |     });
  150 | 
  151 |     test(`can complete a scenario at ${tier} level`, async ({ page }) => {
  152 |       await navigateToGame(page, tier);
  153 |       const headline = await playOneScenario(page);
  154 |       expect(headline).toBeTruthy();
  155 |       expect(headline.length).toBeGreaterThan(3);
  156 |     });
```