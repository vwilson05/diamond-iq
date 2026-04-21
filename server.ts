import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { Resend } from "resend";
import { sql, migrate, generateJoinCode, checkAwards } from "./db";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const app = new Hono();

const SCENARIOS_DIR = join(import.meta.dir, "scenarios");

// Run migrations on boot
migrate().catch((err) => console.error("[db] Migration failed:", err));

// ---- Helper: check if DB is available ----
function requireDB(c: any) {
  if (!sql) {
    return c.json({ error: "Database not configured" }, 503);
  }
  return null;
}

// ===========================================================================
// EXISTING ROUTES
// ===========================================================================

// --- API: Teams ---
app.get("/api/teams", async (c) => {
  const { TEAMS } = await import("./public/js/renderer/teams.js");
  return c.json(TEAMS);
});

// --- API: List scenarios for a tier ---
app.get("/api/scenarios/:tier", async (c) => {
  const tier = c.req.param("tier");
  const tierDir = join(SCENARIOS_DIR, tier);

  try {
    const files = await readdir(tierDir);
    const scenarios = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => {
          const raw = await readFile(join(tierDir, f), "utf-8");
          const data = JSON.parse(raw);
          return {
            ...data,
            id: f.replace(".json", ""),
            title: data.title ?? f.replace(".json", ""),
          };
        })
    );
    return c.json(scenarios);
  } catch {
    return c.json([]);
  }
});

// --- API: Load a specific scenario ---
app.get("/api/scenarios/:tier/:id", async (c) => {
  const { tier, id } = c.req.param();
  const filePath = join(SCENARIOS_DIR, tier, `${id}.json`);

  try {
    const raw = await readFile(filePath, "utf-8");
    return c.json(JSON.parse(raw));
  } catch {
    return c.json({ error: "Scenario not found" }, 404);
  }
});

// ===========================================================================
// PLAYER ROUTES
// ===========================================================================

// Create player
app.post("/api/players", async (c) => {
  const dbErr = requireDB(c);
  if (dbErr) return dbErr;

  const body = await c.req.json();
  const { username, display_name, avatar, team_id, sport, password, parent_email } = body;

  if (!username || !display_name) {
    return c.json({ error: "username and display_name are required" }, 400);
  }
  if (!password || password.length < 4) {
    return c.json({ error: "Password must be at least 4 characters" }, 400);
  }

  const passwordHash = await Bun.password.hash(password);

  try {
    const [player] = await sql`
      INSERT INTO players (username, display_name, avatar, team_id, sport, password_hash, parent_email)
      VALUES (${username.toLowerCase().trim()}, ${display_name.trim()}, ${avatar || "slugger"}, ${team_id || null}, ${sport || "baseball"}, ${passwordHash}, ${parent_email?.trim() || null})
      RETURNING id, username, display_name, avatar, team_id, sport, created_at
    `;
    return c.json(player, 201);
  } catch (err: any) {
    if (err.code === "23505") {
      return c.json({ error: "Username already taken" }, 409);
    }
    throw err;
  }
});

// Login player
app.post("/api/players/login", async (c) => {
  const dbErr = requireDB(c);
  if (dbErr) return dbErr;

  const { username, password } = await c.req.json();
  if (!username) return c.json({ error: "username required" }, 400);

  const [player] = await sql`
    SELECT * FROM players WHERE username = ${username.toLowerCase().trim()}
  `;

  if (!player) return c.json({ error: "Player not found" }, 404);

  // Verify password (skip for legacy accounts without password_hash)
  if (player.password_hash) {
    if (!password) return c.json({ error: "Password required" }, 401);
    const valid = await Bun.password.verify(password, player.password_hash);
    if (!valid) return c.json({ error: "Wrong password" }, 401);
  }

  // Get cumulative IQ
  const [iqRow] = await sql`
    SELECT COALESCE(SUM(total_iq), 0)::int as total_iq,
           COUNT(*)::int as total_sessions
    FROM sessions WHERE player_id = ${player.id} AND ended_at IS NOT NULL
  `;

  const { password_hash, parent_email, ...safe } = player;
  return c.json({ ...safe, cumulative_iq: iqRow.total_iq, total_sessions: iqRow.total_sessions });
});

// Forgot password — sends reset code to parent email
app.post("/api/players/forgot-password", async (c) => {
  const dbErr = requireDB(c);
  if (dbErr) return dbErr;

  const { username } = await c.req.json();
  if (!username) return c.json({ error: "username required" }, 400);

  const [player] = await sql`
    SELECT id, parent_email FROM players WHERE username = ${username.toLowerCase().trim()}
  `;

  // Always return success to avoid leaking account existence
  if (!player || !player.parent_email) {
    return c.json({ message: "If that account exists and has a parent email, a reset code was sent." });
  }

  // Generate 6-digit code
  const code = randomBytes(3).toString("hex").slice(0, 6).toUpperCase();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

  await sql`
    INSERT INTO password_reset_tokens (player_id, token, expires_at)
    VALUES (${player.id}, ${code}, ${expiresAt.toISOString()})
  `;

  // Send email
  if (resend) {
    await resend.emails.send({
      from: "PlayIQ <noreply@playiqapp.com>",
      to: player.parent_email,
      subject: "PlayIQ Password Reset Code",
      html: `
        <div style="font-family: sans-serif; max-width: 400px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a2e;">PlayIQ Password Reset</h2>
          <p>Someone requested a password reset for the PlayIQ account <strong>${username}</strong>.</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; text-align: center; color: #f5a623; padding: 16px; background: #1a1a2e; border-radius: 8px;">${code}</p>
          <p>Enter this code in the app to set a new password. It expires in 15 minutes.</p>
          <p style="color: #888; font-size: 12px;">If you didn't request this, just ignore this email.</p>
        </div>
      `,
    });
  }

  return c.json({ message: "If that account exists and has a parent email, a reset code was sent." });
});

// Reset password with code
app.post("/api/players/reset-password", async (c) => {
  const dbErr = requireDB(c);
  if (dbErr) return dbErr;

  const { username, code, new_password } = await c.req.json();
  if (!username || !code || !new_password) {
    return c.json({ error: "username, code, and new_password required" }, 400);
  }
  if (new_password.length < 4) {
    return c.json({ error: "Password must be at least 4 characters" }, 400);
  }

  const [player] = await sql`
    SELECT id FROM players WHERE username = ${username.toLowerCase().trim()}
  `;
  if (!player) return c.json({ error: "Invalid code" }, 400);

  const [token] = await sql`
    SELECT id FROM password_reset_tokens
    WHERE player_id = ${player.id}
      AND token = ${code.toUpperCase().trim()}
      AND used = FALSE
      AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (!token) return c.json({ error: "Invalid or expired code" }, 400);

  const passwordHash = await Bun.password.hash(new_password);

  await sql`UPDATE players SET password_hash = ${passwordHash} WHERE id = ${player.id}`;
  await sql`UPDATE password_reset_tokens SET used = TRUE WHERE id = ${token.id}`;

  return c.json({ message: "Password reset successfully. You can now log in." });
});

// Get player profile with stats (includes per-module and per-category breakdowns)
app.get("/api/players/:id", async (c) => {
  const dbErr = requireDB(c);
  if (dbErr) return dbErr;

  const id = c.req.param("id");

  const [player] = await sql`SELECT * FROM players WHERE id = ${id}`;
  if (!player) return c.json({ error: "Player not found" }, 404);

  const [stats] = await sql`
    SELECT COALESCE(SUM(total_iq), 0)::int as cumulative_iq,
           COUNT(*)::int as total_sessions,
           MAX(tier) as best_tier
    FROM sessions WHERE player_id = ${id} AND ended_at IS NOT NULL
  `;

  // Total tokens = SUM of iq_points from all scenario results (tokens track with IQ for now)
  const [tokenRow] = await sql`
    SELECT COALESCE(SUM(iq_points), 0)::int as total_tokens
    FROM scenario_results WHERE player_id = ${id}
  `;

  // Per-module stats (grouped by session sport)
  const moduleRows = await sql`
    SELECT s.sport,
           COUNT(DISTINCT s.id)::int as sessions,
           COALESCE(SUM(s.total_iq), 0)::int as iq,
           COUNT(sr.id)::int as scenarios_played,
           COUNT(sr.id) FILTER (WHERE sr.result = 'great')::int as great,
           COUNT(sr.id) FILTER (WHERE sr.result = 'good')::int as good,
           COUNT(sr.id) FILTER (WHERE sr.result = 'okay')::int as okay,
           COUNT(sr.id) FILTER (WHERE sr.result = 'bad')::int as bad
    FROM sessions s
    LEFT JOIN scenario_results sr ON sr.session_id = s.id
    WHERE s.player_id = ${id} AND s.ended_at IS NOT NULL
    GROUP BY s.sport
  `;

  const modules: Record<string, any> = {};
  for (const row of moduleRows) {
    const total = row.great + row.good + row.okay + row.bad;
    const masteryPct = total > 0 ? Math.round(((row.great + row.good) / total) * 100) : 0;
    modules[row.sport] = {
      sessions: row.sessions,
      iq: row.iq,
      scenarios_played: row.scenarios_played,
      great: row.great,
      good: row.good,
      okay: row.okay,
      bad: row.bad,
      mastery_pct: masteryPct,
    };
  }

  // Category-level stats (scenario_results.category is the in-game category like defense/offense)
  const categoryStats = await sql`
    SELECT category,
           COUNT(*)::int as total,
           COUNT(*) FILTER (WHERE result = 'great')::int as great,
           COUNT(*) FILTER (WHERE result = 'good')::int as good,
           COUNT(*) FILTER (WHERE result = 'okay')::int as okay,
           COUNT(*) FILTER (WHERE result = 'bad')::int as bad
    FROM scenario_results
    WHERE player_id = ${id} AND category IS NOT NULL
    GROUP BY category
  `;

  // Sport-category aggregation (Sports, Strategy, Life Skills, etc.)
  const SPORT_CATEGORY_MAP: Record<string, string> = {
    baseball: "Sports", softball: "Sports", basketball: "Sports", football: "Sports",
    soccer: "Sports", hockey: "Sports", tennis: "Sports", golf: "Sports",
    chess: "Strategy", detective: "Strategy",
    money: "Life Skills", coding: "Life Skills", survival: "Life Skills", social: "Life Skills",
    science: "Science", history: "History",
  };

  const sportCategories: Record<string, { iq: number; sessions: number }> = {};
  for (const row of moduleRows) {
    const cat = SPORT_CATEGORY_MAP[row.sport] || "Other";
    if (!sportCategories[cat]) sportCategories[cat] = { iq: 0, sessions: 0 };
    sportCategories[cat].iq += row.iq;
    sportCategories[cat].sessions += row.sessions;
  }

  const { password_hash: _, parent_email: _pe, ...safePlayer } = player;
  return c.json({
    ...safePlayer,
    ...stats,
    total_tokens: tokenRow.total_tokens,
    modules,
    categories: categoryStats,
    sport_categories: sportCategories,
  });
});

// Get player session history
app.get("/api/players/:id/history", async (c) => {
  const dbErr = requireDB(c);
  if (dbErr) return dbErr;

  const id = c.req.param("id");
  const sessions = await sql`
    SELECT * FROM sessions WHERE player_id = ${id}
    ORDER BY started_at DESC LIMIT 50
  `;
  return c.json(sessions);
});

// Get player awards
app.get("/api/players/:id/awards", async (c) => {
  const dbErr = requireDB(c);
  if (dbErr) return dbErr;

  const id = c.req.param("id");
  const awards = await sql`
    SELECT * FROM awards WHERE player_id = ${id} ORDER BY earned_at DESC
  `;
  return c.json(awards);
});

// Join a team by join code
app.post("/api/players/:id/join-team", async (c) => {
  const dbErr = requireDB(c);
  if (dbErr) return dbErr;

  const playerId = c.req.param("id");
  const { join_code } = await c.req.json();

  if (!join_code) return c.json({ error: "join_code required" }, 400);

  const [team] = await sql`
    SELECT * FROM teams WHERE join_code = ${join_code.toUpperCase().trim()}
  `;
  if (!team) return c.json({ error: "Team not found" }, 404);

  try {
    await sql`
      INSERT INTO team_members (team_id, player_id)
      VALUES (${team.id}, ${playerId})
      ON CONFLICT DO NOTHING
    `;
  } catch {
    // Already a member
  }

  return c.json({ team_id: team.id, team_name: team.name, message: "Joined team!" });
});

// ===========================================================================
// SESSION ROUTES
// ===========================================================================

// Start a session
app.post("/api/sessions", async (c) => {
  const dbErr = requireDB(c);
  if (dbErr) return dbErr;

  const { player_id, tier, sport } = await c.req.json();
  if (!player_id || !tier || !sport) {
    return c.json({ error: "player_id, tier, and sport required" }, 400);
  }

  const [session] = await sql`
    INSERT INTO sessions (player_id, tier, sport)
    VALUES (${player_id}, ${tier}, ${sport})
    RETURNING *
  `;
  return c.json(session, 201);
});

// End a session
app.put("/api/sessions/:id", async (c) => {
  const dbErr = requireDB(c);
  if (dbErr) return dbErr;

  const id = c.req.param("id");
  const { total_iq, grade, scenarios_played, total_tokens } = await c.req.json();

  const [session] = await sql`
    UPDATE sessions
    SET total_iq = ${total_iq || 0},
        grade = ${grade || null},
        scenarios_played = ${scenarios_played || 0},
        ended_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `;

  if (!session) return c.json({ error: "Session not found" }, 404);

  // Check for new awards
  const newAwards = await checkAwards(session.player_id);

  return c.json({ session, new_awards: newAwards });
});

// Save a scenario result
app.post("/api/sessions/:id/results", async (c) => {
  const dbErr = requireDB(c);
  if (dbErr) return dbErr;

  const sessionId = c.req.param("id");
  const body = await c.req.json();
  const { scenario_id, scenario_title, category, tier, choice_id, result, iq_points } = body;

  // Get player_id from session
  const [session] = await sql`SELECT player_id FROM sessions WHERE id = ${sessionId}`;
  if (!session) return c.json({ error: "Session not found" }, 404);

  const [row] = await sql`
    INSERT INTO scenario_results (session_id, player_id, scenario_id, scenario_title, category, tier, choice_id, result, iq_points)
    VALUES (${sessionId}, ${session.player_id}, ${scenario_id}, ${scenario_title || null}, ${category || null}, ${tier}, ${choice_id || null}, ${result}, ${iq_points || 0})
    RETURNING *
  `;

  return c.json(row, 201);
});

// ===========================================================================
// COACH ROUTES
// ===========================================================================

// Register coach
app.post("/api/coaches", async (c) => {
  const dbErr = requireDB(c);
  if (dbErr) return dbErr;

  const { email, password, display_name } = await c.req.json();
  if (!email || !password || !display_name) {
    return c.json({ error: "email, password, and display_name required" }, 400);
  }

  const passwordHash = await Bun.password.hash(password);

  try {
    const [coach] = await sql`
      INSERT INTO coaches (email, password_hash, display_name)
      VALUES (${email.toLowerCase().trim()}, ${passwordHash}, ${display_name.trim()})
      RETURNING id, email, display_name, created_at
    `;
    return c.json(coach, 201);
  } catch (err: any) {
    if (err.code === "23505") {
      return c.json({ error: "Email already registered" }, 409);
    }
    throw err;
  }
});

// Coach login
app.post("/api/coaches/login", async (c) => {
  const dbErr = requireDB(c);
  if (dbErr) return dbErr;

  const { email, password } = await c.req.json();
  if (!email || !password) return c.json({ error: "email and password required" }, 400);

  const [coach] = await sql`
    SELECT * FROM coaches WHERE email = ${email.toLowerCase().trim()}
  `;
  if (!coach) return c.json({ error: "Invalid credentials" }, 401);

  const valid = await Bun.password.verify(password, coach.password_hash);
  if (!valid) return c.json({ error: "Invalid credentials" }, 401);

  return c.json({
    id: coach.id,
    email: coach.email,
    display_name: coach.display_name,
    created_at: coach.created_at,
  });
});

// Create team
app.post("/api/coaches/teams", async (c) => {
  const dbErr = requireDB(c);
  if (dbErr) return dbErr;

  const { coach_id, name } = await c.req.json();
  if (!coach_id || !name) return c.json({ error: "coach_id and name required" }, 400);

  // Generate unique join code
  let joinCode = generateJoinCode();
  let attempts = 0;
  while (attempts < 10) {
    const [existing] = await sql`SELECT id FROM teams WHERE join_code = ${joinCode}`;
    if (!existing) break;
    joinCode = generateJoinCode();
    attempts++;
  }

  const [team] = await sql`
    INSERT INTO teams (coach_id, name, join_code)
    VALUES (${coach_id}, ${name.trim()}, ${joinCode})
    RETURNING *
  `;

  return c.json(team, 201);
});

// List coach's teams
app.get("/api/coaches/:id/teams", async (c) => {
  const dbErr = requireDB(c);
  if (dbErr) return dbErr;

  const coachId = c.req.param("id");
  const teams = await sql`
    SELECT t.*,
           (SELECT COUNT(*)::int FROM team_members WHERE team_id = t.id) as member_count
    FROM teams t
    WHERE t.coach_id = ${coachId}
    ORDER BY t.created_at DESC
  `;
  return c.json(teams);
});

// Get team with roster
app.get("/api/coaches/teams/:id", async (c) => {
  const dbErr = requireDB(c);
  if (dbErr) return dbErr;

  const teamId = c.req.param("id");

  const [team] = await sql`SELECT * FROM teams WHERE id = ${teamId}`;
  if (!team) return c.json({ error: "Team not found" }, 404);

  const roster = await sql`
    SELECT p.id, p.username, p.display_name, p.avatar, p.created_at,
           COALESCE((SELECT SUM(s.total_iq) FROM sessions s WHERE s.player_id = p.id AND s.ended_at IS NOT NULL), 0)::int as total_iq,
           COALESCE((SELECT COUNT(*) FROM sessions s WHERE s.player_id = p.id AND s.ended_at IS NOT NULL), 0)::int as sessions_played
    FROM players p
    JOIN team_members tm ON tm.player_id = p.id
    WHERE tm.team_id = ${teamId}
    ORDER BY p.display_name
  `;

  return c.json({ ...team, roster });
});

// Get team progress dashboard
app.get("/api/coaches/teams/:id/progress", async (c) => {
  const dbErr = requireDB(c);
  if (dbErr) return dbErr;

  const teamId = c.req.param("id");

  // Get all players on the team
  const players = await sql`
    SELECT p.id, p.username, p.display_name, p.avatar
    FROM players p
    JOIN team_members tm ON tm.player_id = p.id
    WHERE tm.team_id = ${teamId}
    ORDER BY p.display_name
  `;

  // For each player, get their stats
  const playerStats = await Promise.all(
    players.map(async (player: any) => {
      const [stats] = await sql`
        SELECT COALESCE(SUM(total_iq), 0)::int as total_iq,
               COUNT(*)::int as sessions_played,
               MAX(tier) as best_tier
        FROM sessions WHERE player_id = ${player.id} AND ended_at IS NOT NULL
      `;

      const categories = await sql`
        SELECT category,
               COUNT(*)::int as total,
               COUNT(*) FILTER (WHERE result = 'great')::int as great,
               COUNT(*) FILTER (WHERE result = 'good')::int as good,
               COUNT(*) FILTER (WHERE result = 'okay')::int as okay,
               COUNT(*) FILTER (WHERE result = 'bad')::int as bad
        FROM scenario_results
        WHERE player_id = ${player.id} AND category IS NOT NULL
        GROUP BY category
      `;

      // Determine strengths and needs-work
      const catMap: Record<string, any> = {};
      for (const cat of categories) {
        const pctGreatGood = cat.total > 0 ? ((cat.great + cat.good) / cat.total) * 100 : 0;
        catMap[cat.category] = { ...cat, pct_great_good: Math.round(pctGreatGood) };
      }

      const sorted = Object.entries(catMap).sort((a: any, b: any) => b[1].pct_great_good - a[1].pct_great_good);
      const strengths = sorted.filter((s: any) => s[1].pct_great_good >= 60).map((s) => s[0]);
      const needsWork = sorted.filter((s: any) => s[1].pct_great_good < 60).map((s) => s[0]);

      const awards = await sql`
        SELECT award_type, award_name FROM awards WHERE player_id = ${player.id}
      `;

      return {
        ...player,
        ...stats,
        categories: catMap,
        strengths,
        needs_work: needsWork,
        awards,
      };
    })
  );

  // Team-wide summary
  const teamCategories: Record<string, { great: number; good: number; okay: number; bad: number; total: number }> = {};
  for (const p of playerStats) {
    for (const [cat, data] of Object.entries(p.categories) as any) {
      if (!teamCategories[cat]) teamCategories[cat] = { great: 0, good: 0, okay: 0, bad: 0, total: 0 };
      teamCategories[cat].great += data.great;
      teamCategories[cat].good += data.good;
      teamCategories[cat].okay += data.okay;
      teamCategories[cat].bad += data.bad;
      teamCategories[cat].total += data.total;
    }
  }

  const teamSorted = Object.entries(teamCategories)
    .map(([cat, data]) => ({
      category: cat,
      pct_great_good: data.total > 0 ? Math.round(((data.great + data.good) / data.total) * 100) : 0,
    }))
    .sort((a, b) => b.pct_great_good - a.pct_great_good);

  const teamStrengths = teamSorted.filter((s) => s.pct_great_good >= 60).map((s) => s.category);
  const teamNeedsWork = teamSorted.filter((s) => s.pct_great_good < 60).map((s) => s.category);

  return c.json({
    players: playerStats,
    team_summary: {
      categories: teamCategories,
      strengths: teamStrengths,
      needs_work: teamNeedsWork,
    },
  });
});

// ===========================================================================
// COACH DASHBOARD PAGE
// ===========================================================================

app.get("/coach", async (c) => {
  const html = await readFile(join(import.meta.dir, "public", "coach.html"), "utf-8");
  return c.html(html);
});

// --- No-cache for JS/CSS so deploys take effect immediately ---
app.use("/js/*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-cache, no-store, must-revalidate");
});
app.use("/css/*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-cache, no-store, must-revalidate");
});

// --- Static files (AFTER API routes so /api/* matches first) ---
app.use("/*", serveStatic({ root: "./public" }));

const port = parseInt(process.env.PORT ?? "3456", 10);

export default {
  port,
  fetch: app.fetch,
};

console.log(`PlayIQ server running on port ${port}`);
