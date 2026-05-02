#!/usr/bin/env bun
/**
 * PlayIQ sport-tag UAT
 *
 * Goal: prove no scenario bleeds across sports. For every (sport, tier),
 *   1. fetch the listing endpoint with ?sport=<id>
 *   2. confirm every result has the requested sport in its sport tag
 *   3. for the sport==softball case, also walk all 5 tiers and assert non-empty
 *      where applicable (tball/rookie/minors/majors/the-show should all return >= 1)
 *
 * Runs against a base URL passed as the first arg (default: http://localhost:3456).
 */

const BASE = process.argv[2] || "http://localhost:3456";

const SPORTS = [
  "baseball", "softball", "basketball", "football", "soccer", "hockey", "tennis", "golf",
  "chess", "detective",
  "money", "coding", "survival", "social",
  "science", "history",
];

const TIERS = ["tball", "rookie", "minors", "majors", "the-show"];

let failures = 0;
const summary = [];

for (const sport of SPORTS) {
  for (const tier of TIERS) {
    const url = `${BASE}/api/scenarios/${tier}?sport=${sport}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`FAIL ${sport}/${tier}: HTTP ${res.status}`);
      failures++;
      continue;
    }
    const data = await res.json();
    if (!Array.isArray(data)) {
      console.error(`FAIL ${sport}/${tier}: response not an array`);
      failures++;
      continue;
    }

    // Strict containment check
    const leaks = data.filter(
      (s) => !Array.isArray(s.sport) || !s.sport.includes(sport),
    );
    if (leaks.length > 0) {
      console.error(`FAIL ${sport}/${tier}: ${leaks.length} leaked scenarios`);
      for (const leak of leaks.slice(0, 5)) {
        console.error(`  - ${leak.id} | sport=${JSON.stringify(leak.sport)}`);
      }
      failures++;
      continue;
    }

    summary.push({ sport, tier, count: data.length });
  }
}

console.log("\n=== Per-(sport, tier) scenario counts ===");
const byTier = {};
for (const row of summary) {
  byTier[row.tier] ??= {};
  byTier[row.tier][row.sport] = row.count;
}
const headerSports = SPORTS.join(" | ");
console.log(`tier         | ${headerSports}`);
for (const tier of TIERS) {
  const cells = SPORTS.map((s) => String(byTier[tier]?.[s] ?? 0).padStart(s.length));
  console.log(`${tier.padEnd(12)} | ${cells.join(" | ")}`);
}

// Softball must have >= 1 scenario at every tier (key bug-fix assertion)
console.log("\n=== Softball coverage check ===");
for (const tier of TIERS) {
  const count = byTier[tier]?.softball ?? 0;
  const ok = count >= 1;
  console.log(`  softball / ${tier}: ${count} ${ok ? "OK" : "FAIL"}`);
  if (!ok) failures++;
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nAll sport-tag UAT checks passed.");
