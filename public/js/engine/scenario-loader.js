/**
 * Diamond IQ — Scenario Loader
 * Fetches scenario data from the API and provides random selection.
 */

/**
 * Fetch the list of available scenarios for a given tier, optionally filtered by sport server-side.
 * @param {string} tier — e.g. "tball", "rookie", "minors", "majors", "the-show"
 * @param {string} [sport] — optional sport id; when set, server returns only scenarios whose sport array includes it.
 * @returns {Promise<Array<{ id: string, title: string, situation: string }>>}
 */
export async function loadScenarioList(tier, sport) {
  const qs = sport ? `?sport=${encodeURIComponent(sport)}` : '';
  const res = await fetch(`/api/scenarios/${encodeURIComponent(tier)}${qs}`);
  if (!res.ok) {
    throw new Error(
      `Failed to load scenario list for tier "${tier}": ${res.status} ${res.statusText}`
    );
  }
  return res.json();
}

/**
 * Fetch a single scenario's full tree by tier and id.
 * @param {string} tier
 * @param {string} id
 * @returns {Promise<object>} Full scenario tree with nodes
 */
export async function loadScenario(tier, id) {
  const res = await fetch(
    `/api/scenarios/${encodeURIComponent(tier)}/${encodeURIComponent(id)}`
  );
  if (!res.ok) {
    throw new Error(
      `Failed to load scenario "${id}" for tier "${tier}": ${res.status} ${res.statusText}`
    );
  }
  return res.json();
}

/**
 * Pick a random scenario from a list, excluding already-played IDs.
 * @param {Array<{ id: string }>} list — array of scenario summaries
 * @param {string[]} excludeIds — IDs to skip (already played)
 * @returns {{ id: string, title: string, situation: string } | null} — null if all played
 */
export function getRandomScenario(list, excludeIds = []) {
  const excludeSet = new Set(excludeIds);
  const available = list.filter((s) => !excludeSet.has(s.id));
  if (available.length === 0) return null;
  const idx = Math.floor(Math.random() * available.length);
  return available[idx];
}
