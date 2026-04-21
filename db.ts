/**
 * Diamond IQ — Database Connection & Schema Migration
 * Uses `postgres` (porsager/postgres) with Bun runtime.
 */

import postgres from "postgres";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.warn("[db] DATABASE_URL not set — database features disabled");
}

export const sql = DATABASE_URL
  ? postgres(DATABASE_URL, { ssl: { rejectUnauthorized: false } })
  : (null as unknown as ReturnType<typeof postgres>);

/**
 * Run schema migrations (idempotent — safe to call on every boot).
 */
export async function migrate() {
  if (!sql) {
    console.warn("[db] Skipping migration — no DATABASE_URL");
    return;
  }

  await sql`
    CREATE TABLE IF NOT EXISTS players (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      avatar TEXT DEFAULT 'slugger',
      team_id TEXT,
      sport TEXT DEFAULT 'baseball',
      password_hash TEXT,
      parent_email TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  // Add columns for existing installs (idempotent)
  await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS password_hash TEXT`;
  await sql`ALTER TABLE players ADD COLUMN IF NOT EXISTS parent_email TEXT`;

  await sql`
    CREATE TABLE IF NOT EXISTS sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      player_id UUID REFERENCES players(id),
      tier TEXT NOT NULL,
      sport TEXT NOT NULL,
      total_iq INTEGER DEFAULT 0,
      scenarios_played INTEGER DEFAULT 0,
      grade TEXT,
      started_at TIMESTAMPTZ DEFAULT NOW(),
      ended_at TIMESTAMPTZ
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS scenario_results (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID REFERENCES sessions(id),
      player_id UUID REFERENCES players(id),
      scenario_id TEXT NOT NULL,
      scenario_title TEXT,
      category TEXT,
      tier TEXT NOT NULL,
      choice_id TEXT,
      result TEXT,
      iq_points INTEGER DEFAULT 0,
      played_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS awards (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      player_id UUID REFERENCES players(id),
      award_type TEXT NOT NULL,
      award_name TEXT NOT NULL,
      description TEXT,
      earned_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(player_id, award_type)
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      player_id UUID REFERENCES players(id),
      token TEXT UNIQUE NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS coaches (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS teams (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      coach_id UUID REFERENCES coaches(id),
      name TEXT NOT NULL,
      join_code TEXT UNIQUE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS team_members (
      team_id UUID REFERENCES teams(id),
      player_id UUID REFERENCES players(id),
      joined_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (team_id, player_id)
    )
  `;

  console.log("[db] Migration complete");
}

/**
 * Generate a random 6-char alphanumeric join code.
 */
export function generateJoinCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I/O/0/1 for clarity
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Check and grant awards after a session ends.
 * Returns newly earned awards.
 */
export async function checkAwards(playerId: string): Promise<Array<{ award_type: string; award_name: string; description: string }>> {
  if (!sql) return [];

  const newAwards: Array<{ award_type: string; award_name: string; description: string }> = [];

  // Helper to insert award if not exists
  async function tryAward(type: string, name: string, desc: string) {
    try {
      await sql`
        INSERT INTO awards (player_id, award_type, award_name, description)
        VALUES (${playerId}, ${type}, ${name}, ${desc})
        ON CONFLICT (player_id, award_type) DO NOTHING
      `;
      // Check if it was actually inserted (new award)
      const [check] = await sql`
        SELECT earned_at FROM awards
        WHERE player_id = ${playerId} AND award_type = ${type}
        AND earned_at > NOW() - INTERVAL '5 seconds'
      `;
      if (check) {
        newAwards.push({ award_type: type, award_name: name, description: desc });
      }
    } catch {
      // Ignore duplicates
    }
  }

  // Count total sessions
  const [sessionCount] = await sql`
    SELECT COUNT(*)::int as count FROM sessions WHERE player_id = ${playerId} AND ended_at IS NOT NULL
  `;

  // first_game
  if (sessionCount.count >= 1) {
    await tryAward("first_game", "First Game", "Completed your first Diamond IQ session!");
  }

  // Check for perfect score in latest session
  const [latestSession] = await sql`
    SELECT id, total_iq, scenarios_played FROM sessions
    WHERE player_id = ${playerId} AND ended_at IS NOT NULL
    ORDER BY ended_at DESC LIMIT 1
  `;

  if (latestSession) {
    const results = await sql`
      SELECT result FROM scenario_results WHERE session_id = ${latestSession.id}
    `;
    if (results.length > 0 && results.every((r: any) => r.result === "great")) {
      await tryAward("perfect_score", "Perfect Game", "Got every answer right in a session!");
    }

    // streak_3: 3 consecutive "great" results
    let streak = 0;
    let maxStreak = 0;
    for (const r of results) {
      if (r.result === "great") {
        streak++;
        maxStreak = Math.max(maxStreak, streak);
      } else {
        streak = 0;
      }
    }
    if (maxStreak >= 3) {
      await tryAward("streak_3", "Hot Streak", "Got 3 great answers in a row!");
    }
  }

  // Cumulative IQ milestones
  const [iqTotal] = await sql`
    SELECT COALESCE(SUM(total_iq), 0)::int as total FROM sessions WHERE player_id = ${playerId} AND ended_at IS NOT NULL
  `;

  if (iqTotal.total >= 50) await tryAward("iq_50", "Rising Star", "Earned 50 total IQ points!");
  if (iqTotal.total >= 100) await tryAward("iq_100", "Century Club", "Earned 100 total IQ points!");
  if (iqTotal.total >= 500) await tryAward("iq_500", "Diamond Mind", "Earned 500 total IQ points!");

  // All categories played
  const categories = await sql`
    SELECT DISTINCT category FROM scenario_results WHERE player_id = ${playerId} AND category IS NOT NULL
  `;
  const catSet = new Set(categories.map((c: any) => c.category));
  if (catSet.has("defense") && catSet.has("offense") && catSet.has("pitching") && catSet.has("baserunning")) {
    await tryAward("all_categories", "Well-Rounded", "Played scenarios in all 4 categories!");
  }

  // Tier completions
  const tierMap: Record<string, string> = {
    tball: "tier_complete_tball",
    rookie: "tier_complete_rookie",
    minors: "tier_complete_minors",
    majors: "tier_complete_majors",
    "the-show": "tier_complete_the_show",
  };
  const tierNames: Record<string, string> = {
    tball: "T-Ball Graduate",
    rookie: "Rookie No More",
    minors: "Minor League Champ",
    majors: "Major Leaguer",
    "the-show": "The Show MVP",
  };

  const tiersPlayed = await sql`
    SELECT DISTINCT tier FROM sessions WHERE player_id = ${playerId} AND ended_at IS NOT NULL
  `;
  for (const t of tiersPlayed) {
    const key = tierMap[t.tier];
    if (key) {
      await tryAward(key, tierNames[t.tier], `Completed a session in ${t.tier} tier!`);
    }
  }

  return newAwards;
}
