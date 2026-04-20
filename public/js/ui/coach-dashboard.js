/**
 * PlayIQ — Coach Dashboard
 * Separate page at /coach for coaches to view team progress.
 */

const AVATAR_SVGS = {
  slugger: `<svg viewBox="0 0 32 32" fill="none" width="24" height="24"><rect x="14" y="2" width="4" height="24" rx="2" fill="currentColor"/><rect x="12" y="24" width="8" height="4" rx="1" fill="currentColor" opacity="0.7"/><circle cx="16" cy="4" r="2" fill="currentColor"/></svg>`,
  glove: `<svg viewBox="0 0 32 32" fill="none" width="24" height="24"><path d="M8 18c0-6 3-14 8-14s8 8 8 14c0 4-3 8-8 8s-8-4-8-8z" stroke="currentColor" stroke-width="2" fill="none"/><ellipse cx="16" cy="20" rx="5" ry="4" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
  cap: `<svg viewBox="0 0 32 32" fill="none" width="24" height="24"><path d="M6 18c0-6 4.5-10 10-10s10 4 10 10" stroke="currentColor" stroke-width="2" fill="none"/><rect x="4" y="17" width="24" height="4" rx="2" fill="currentColor"/></svg>`,
  diamond: `<svg viewBox="0 0 32 32" fill="none" width="24" height="24"><path d="M16 2L30 16L16 30L2 16Z" stroke="currentColor" stroke-width="2" fill="none"/></svg>`,
  homeplate: `<svg viewBox="0 0 32 32" fill="none" width="24" height="24"><path d="M8 6h16l0 12l-8 10l-8-10z" stroke="currentColor" stroke-width="2" fill="none"/></svg>`,
  ball: `<svg viewBox="0 0 32 32" fill="none" width="24" height="24"><circle cx="16" cy="16" r="12" stroke="currentColor" stroke-width="2" fill="none"/><path d="M10 6c2 3 2 7 0 10s-2 7 0 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M22 6c-2 3-2 7 0 10s2 7 0 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  trophy: `<svg viewBox="0 0 32 32" fill="none" width="24" height="24"><path d="M10 4h12v10c0 4-2.5 7-6 7s-6-3-6-7V4z" stroke="currentColor" stroke-width="2" fill="none"/><rect x="11" y="24" width="10" height="3" rx="1" fill="currentColor"/></svg>`,
  star: `<svg viewBox="0 0 32 32" fill="none" width="24" height="24"><path d="M16 3l3.5 7 7.5 1.5-5.5 5.3 1.3 7.7L16 21l-6.8 3.5 1.3-7.7L5 11.5l7.5-1.5z" stroke="currentColor" stroke-width="2" fill="none"/></svg>`,
  // Legacy keys mapped to new icons
  rocket: null,
  lightning: null,
  fire: null,
};

const RESULT_COLORS = {
  great: 'var(--great)',
  good: 'var(--good)',
  okay: 'var(--okay)',
  bad: 'var(--bad)',
};

const app = document.getElementById('coach-app');
let coach = null;
let currentTeamId = null;

// ---- Check for existing session ----
const savedCoach = localStorage.getItem('diamond_iq_coach');
if (savedCoach) {
  try {
    coach = JSON.parse(savedCoach);
    showTeamList();
  } catch {
    showLogin();
  }
} else {
  showLogin();
}

// ---- LOGIN / REGISTER ----
function showLogin() {
  app.innerHTML = `
    <div class="coach-centered">
      <div class="logo-header">
        <h1 class="logo">PLAY<span class="logo-accent">IQ</span></h1>
        <p class="tagline">Coach Dashboard</p>
      </div>

      <div class="coach-auth-tabs">
        <button class="coach-auth-tab active" data-tab="login">Sign In</button>
        <button class="coach-auth-tab" data-tab="register">Register</button>
      </div>

      <div class="coach-auth-panel active" data-panel="login">
        <div class="coach-field">
          <label>Email</label>
          <input type="email" id="coach-login-email" placeholder="coach@email.com" />
        </div>
        <div class="coach-field">
          <label>Password</label>
          <input type="password" id="coach-login-password" placeholder="Password" />
        </div>
        <button class="coach-btn" id="coach-login-btn">Sign In</button>
        <div class="coach-error" id="coach-login-error"></div>
      </div>

      <div class="coach-auth-panel" data-panel="register">
        <div class="coach-field">
          <label>Your Name</label>
          <input type="text" id="coach-reg-name" placeholder="Coach Johnson" />
        </div>
        <div class="coach-field">
          <label>Email</label>
          <input type="email" id="coach-reg-email" placeholder="coach@email.com" />
        </div>
        <div class="coach-field">
          <label>Password</label>
          <input type="password" id="coach-reg-password" placeholder="Create a password" />
        </div>
        <button class="coach-btn" id="coach-reg-btn">Create Account</button>
        <div class="coach-error" id="coach-reg-error"></div>
      </div>

      <button class="coach-btn coach-demo-btn" id="coach-demo-btn">View Demo Dashboard</button>
      <a href="https://playiqapp.com" class="coach-back-link">Back to PlayIQ Home</a>
    </div>
  `;

  // Tab switching
  app.querySelectorAll('.coach-auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      app.querySelectorAll('.coach-auth-tab').forEach(t => t.classList.remove('active'));
      app.querySelectorAll('.coach-auth-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      app.querySelector(`[data-panel="${tab.dataset.tab}"]`).classList.add('active');
    });
  });

  // Login
  app.querySelector('#coach-login-btn').addEventListener('click', async () => {
    const email = app.querySelector('#coach-login-email').value.trim();
    const password = app.querySelector('#coach-login-password').value;
    const err = app.querySelector('#coach-login-error');
    err.textContent = '';

    if (!email || !password) { err.textContent = 'Enter email and password'; return; }

    try {
      const res = await fetch('/api/coaches/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        err.textContent = data.error || 'Login failed';
        return;
      }
      coach = await res.json();
      localStorage.setItem('diamond_iq_coach', JSON.stringify(coach));
      showTeamList();
    } catch {
      err.textContent = 'Connection error';
    }
  });

  // Demo
  app.querySelector('#coach-demo-btn').addEventListener('click', () => showDemo());

  // Register
  app.querySelector('#coach-reg-btn').addEventListener('click', async () => {
    const display_name = app.querySelector('#coach-reg-name').value.trim();
    const email = app.querySelector('#coach-reg-email').value.trim();
    const password = app.querySelector('#coach-reg-password').value;
    const err = app.querySelector('#coach-reg-error');
    err.textContent = '';

    if (!display_name || !email || !password) { err.textContent = 'Fill in all fields'; return; }
    if (password.length < 6) { err.textContent = 'Password must be at least 6 characters'; return; }

    try {
      const res = await fetch('/api/coaches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, display_name }),
      });
      if (!res.ok) {
        const data = await res.json();
        err.textContent = data.error || 'Registration failed';
        return;
      }
      coach = await res.json();
      localStorage.setItem('diamond_iq_coach', JSON.stringify(coach));
      showTeamList();
    } catch {
      err.textContent = 'Connection error';
    }
  });
}

// ---- TEAM LIST ----
async function showTeamList() {
  app.innerHTML = `
    <div class="coach-header">
      <div class="logo-sm">PLAY<span class="logo-accent">IQ</span></div>
      <div class="coach-header-right">
        <span class="coach-name">${coach.display_name}</span>
        <button class="coach-logout-btn" id="coach-logout">Sign Out</button>
      </div>
    </div>
    <div class="coach-content">
      <h2 class="coach-heading">Your Teams</h2>
      <div id="coach-teams-list" class="coach-teams-list">
        <div class="loading-spinner">Loading teams</div>
      </div>
      <div class="coach-create-team">
        <h3>Create a New Team</h3>
        <div class="coach-create-row">
          <input type="text" id="coach-new-team-name" placeholder="Team name" />
          <button class="coach-btn" id="coach-create-team-btn">Create</button>
        </div>
        <div class="coach-error" id="coach-create-error"></div>
      </div>
    </div>
  `;

  app.querySelector('#coach-logout').addEventListener('click', () => {
    localStorage.removeItem('diamond_iq_coach');
    coach = null;
    showLogin();
  });

  app.querySelector('#coach-create-team-btn').addEventListener('click', async () => {
    const name = app.querySelector('#coach-new-team-name').value.trim();
    const err = app.querySelector('#coach-create-error');
    err.textContent = '';
    if (!name) { err.textContent = 'Enter a team name'; return; }

    try {
      const res = await fetch('/api/coaches/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ coach_id: coach.id, name }),
      });
      if (!res.ok) { err.textContent = 'Failed to create team'; return; }
      app.querySelector('#coach-new-team-name').value = '';
      await loadTeams();
    } catch {
      err.textContent = 'Connection error';
    }
  });

  await loadTeams();
}

async function loadTeams() {
  const list = app.querySelector('#coach-teams-list');
  try {
    const res = await fetch(`/api/coaches/${coach.id}/teams`);
    const teams = await res.json();

    if (teams.length === 0) {
      list.innerHTML = '<div class="coach-empty">No teams yet. Create one below!</div>';
      return;
    }

    list.innerHTML = teams.map(t => `
      <div class="coach-team-card" data-team-id="${t.id}">
        <div class="coach-team-info">
          <div class="coach-team-name">${t.name}</div>
          <div class="coach-team-meta">${t.member_count} player${t.member_count !== 1 ? 's' : ''}</div>
        </div>
        <div class="coach-team-code">
          <span class="coach-code-label">Join Code</span>
          <span class="coach-code-value">${t.join_code}</span>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.coach-team-card').forEach(card => {
      card.addEventListener('click', () => {
        currentTeamId = card.dataset.teamId;
        showTeamProgress(currentTeamId);
      });
    });
  } catch {
    list.innerHTML = '<div class="coach-empty">Failed to load teams</div>';
  }
}

// ---- TEAM PROGRESS DASHBOARD ----
async function showTeamProgress(teamId) {
  app.innerHTML = `
    <div class="coach-header">
      <div class="coach-header-left">
        <button class="coach-back-btn" id="coach-back">&larr; Teams</button>
        <div class="logo-sm">PLAY<span class="logo-accent">IQ</span></div>
      </div>
      <div class="coach-header-right">
        <span class="coach-name">${coach.display_name}</span>
      </div>
    </div>
    <div class="coach-content" id="coach-progress-content">
      <div class="loading-spinner">Loading team progress</div>
    </div>
  `;

  app.querySelector('#coach-back').addEventListener('click', () => showTeamList());

  try {
    const [teamRes, progressRes] = await Promise.all([
      fetch(`/api/coaches/teams/${teamId}`),
      fetch(`/api/coaches/teams/${teamId}/progress`),
    ]);

    const team = await teamRes.json();
    const progress = await progressRes.json();

    renderProgress(team, progress);
  } catch {
    document.getElementById('coach-progress-content').innerHTML =
      '<div class="coach-empty">Failed to load progress data</div>';
  }
}

function renderProgress(team, progress) {
  const content = document.getElementById('coach-progress-content');

  const teamSummaryHTML = renderTeamSummary(progress.team_summary, progress.players.length);
  const playerCardsHTML = progress.players.map(p => renderPlayerCard(p)).join('');

  content.innerHTML = `
    <div class="coach-team-header-block">
      <h2 class="coach-heading">${team.name}</h2>
      <div class="coach-join-info">Join Code: <strong>${team.join_code}</strong> &mdash; ${team.roster.length} player${team.roster.length !== 1 ? 's' : ''}</div>
    </div>

    ${teamSummaryHTML}

    <h3 class="coach-section-heading">Player Progress</h3>
    <div class="coach-player-grid">
      ${playerCardsHTML || '<div class="coach-empty">No players have joined this team yet. Share the join code!</div>'}
    </div>
  `;
}

function renderTeamSummary(summary, playerCount) {
  if (playerCount === 0 || Object.keys(summary.categories).length === 0) {
    return '<div class="coach-summary-card"><p>No data yet. Players need to complete sessions first.</p></div>';
  }

  const strengthText = summary.strengths.length > 0
    ? `Your team is strong at <strong>${summary.strengths.join(', ')}</strong>.`
    : 'Keep playing to discover team strengths.';

  const needsWorkText = summary.needs_work.length > 0
    ? `Needs work on <strong>${summary.needs_work.join(', ')}</strong>.`
    : '';

  return `
    <div class="coach-summary-card">
      <h3 class="coach-summary-title">Team Overview</h3>
      <div class="coach-summary-text">
        ${strengthText} ${needsWorkText}
      </div>
      <div class="coach-category-bars">
        ${Object.entries(summary.categories).map(([cat, data]) => {
          const pct = data.total > 0 ? Math.round(((data.great + data.good) / data.total) * 100) : 0;
          return `
            <div class="coach-cat-bar">
              <div class="coach-cat-label">${cat}</div>
              <div class="coach-bar-track">
                <div class="coach-bar-fill" style="width:${pct}%;background:${pct >= 60 ? 'var(--great)' : pct >= 40 ? 'var(--okay)' : 'var(--bad)'}"></div>
              </div>
              <div class="coach-cat-pct">${pct}%</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// ---- DEMO MODE ----
function showDemo() {
  coach = { display_name: 'Coach Martinez', id: 'demo' };

  const demoTeam = { name: 'Eastside Wildcats', join_code: 'WILD23', roster: Array(8) };

  const demoProgress = {
    team_summary: {
      categories: {
        defense: { total: 64, great: 28, good: 18, okay: 12, bad: 6 },
        offense: { total: 48, great: 14, good: 16, okay: 10, bad: 8 },
        baserunning: { total: 40, great: 18, good: 12, okay: 6, bad: 4 },
        pitching: { total: 24, great: 6, good: 8, okay: 6, bad: 4 },
      },
      strengths: ['defense', 'baserunning'],
      needs_work: ['pitching', 'offense'],
    },
    players: [
      {
        display_name: 'Marcus J.', avatar: 'slugger', total_iq: 340, sessions_played: 12,
        categories: {
          defense: { total: 10, great: 5, good: 3, okay: 1, bad: 1 },
          offense: { total: 8, great: 4, good: 2, okay: 1, bad: 1 },
          baserunning: { total: 6, great: 3, good: 2, okay: 1, bad: 0 },
          pitching: { total: 4, great: 2, good: 1, okay: 1, bad: 0 },
        },
        strengths: ['defense', 'offense'], needs_work: [],
        awards: [{ award_name: 'All-Star' }, { award_name: 'Perfect Score' }],
      },
      {
        display_name: 'Sofia R.', avatar: 'glove', total_iq: 290, sessions_played: 10,
        categories: {
          defense: { total: 9, great: 5, good: 3, okay: 1, bad: 0 },
          offense: { total: 6, great: 2, good: 2, okay: 1, bad: 1 },
          baserunning: { total: 5, great: 3, good: 1, okay: 1, bad: 0 },
          pitching: { total: 3, great: 1, good: 1, okay: 1, bad: 0 },
        },
        strengths: ['defense', 'baserunning'], needs_work: ['offense'],
        awards: [{ award_name: 'Gold Glove' }],
      },
      {
        display_name: 'Jayden T.', avatar: 'cap', total_iq: 220, sessions_played: 8,
        categories: {
          defense: { total: 7, great: 2, good: 3, okay: 1, bad: 1 },
          offense: { total: 6, great: 1, good: 2, okay: 2, bad: 1 },
          baserunning: { total: 5, great: 2, good: 2, okay: 1, bad: 0 },
          pitching: { total: 3, great: 0, good: 1, okay: 1, bad: 1 },
        },
        strengths: ['baserunning'], needs_work: ['pitching', 'offense'],
        awards: [{ award_name: 'Speed Demon' }],
      },
      {
        display_name: 'Emma L.', avatar: 'star', total_iq: 180, sessions_played: 7,
        categories: {
          defense: { total: 6, great: 2, good: 2, okay: 1, bad: 1 },
          offense: { total: 5, great: 1, good: 1, okay: 2, bad: 1 },
          baserunning: { total: 4, great: 2, good: 1, okay: 0, bad: 1 },
          pitching: { total: 3, great: 1, good: 1, okay: 0, bad: 1 },
        },
        strengths: ['baserunning'], needs_work: ['offense'],
        awards: [],
      },
      {
        display_name: 'Liam K.', avatar: 'trophy', total_iq: 260, sessions_played: 9,
        categories: {
          defense: { total: 8, great: 3, good: 2, okay: 2, bad: 1 },
          offense: { total: 7, great: 3, good: 2, okay: 1, bad: 1 },
          baserunning: { total: 5, great: 2, good: 2, okay: 1, bad: 0 },
          pitching: { total: 4, great: 1, good: 2, okay: 1, bad: 0 },
        },
        strengths: ['defense', 'offense'], needs_work: ['pitching'],
        awards: [{ award_name: 'First Game' }, { award_name: 'IQ 100' }],
      },
      {
        display_name: 'Ava M.', avatar: 'ball', total_iq: 150, sessions_played: 6,
        categories: {
          defense: { total: 6, great: 2, good: 1, okay: 2, bad: 1 },
          offense: { total: 4, great: 1, good: 1, okay: 1, bad: 1 },
          baserunning: { total: 4, great: 2, good: 1, okay: 1, bad: 0 },
          pitching: { total: 2, great: 0, good: 1, okay: 0, bad: 1 },
        },
        strengths: ['baserunning'], needs_work: ['pitching', 'offense'],
        awards: [],
      },
      {
        display_name: 'Noah D.', avatar: 'diamond', total_iq: 310, sessions_played: 11,
        categories: {
          defense: { total: 9, great: 4, good: 3, okay: 1, bad: 1 },
          offense: { total: 7, great: 2, good: 3, okay: 1, bad: 1 },
          baserunning: { total: 6, great: 3, good: 2, okay: 1, bad: 0 },
          pitching: { total: 3, great: 1, good: 1, okay: 1, bad: 0 },
        },
        strengths: ['defense', 'baserunning'], needs_work: [],
        awards: [{ award_name: 'IQ 300' }, { award_name: 'Streak 3' }],
      },
      {
        display_name: 'Mia C.', avatar: 'homeplate', total_iq: 130, sessions_played: 5,
        categories: {
          defense: { total: 5, great: 1, good: 2, okay: 1, bad: 1 },
          offense: { total: 4, great: 1, good: 1, okay: 1, bad: 1 },
          baserunning: { total: 3, great: 1, good: 1, okay: 0, bad: 1 },
          pitching: { total: 2, great: 0, good: 0, okay: 1, bad: 1 },
        },
        strengths: [], needs_work: ['pitching', 'offense', 'defense'],
        awards: [{ award_name: 'First Game' }],
      },
    ],
  };

  // Render the demo dashboard
  app.innerHTML = `
    <div class="coach-header">
      <div class="coach-header-left">
        <button class="coach-back-btn" id="coach-back-demo">&larr; Exit Demo</button>
        <div class="logo-sm">PLAY<span class="logo-accent">IQ</span></div>
      </div>
      <div class="coach-header-right">
        <span class="coach-name">Coach Martinez</span>
        <span class="coach-demo-badge">DEMO</span>
      </div>
    </div>
    <div class="coach-content" id="coach-progress-content"></div>
  `;

  app.querySelector('#coach-back-demo').addEventListener('click', () => {
    coach = null;
    showLogin();
  });

  renderProgress(demoTeam, demoProgress);

  // Add practice plan after progress
  const content = document.getElementById('coach-progress-content');
  content.insertAdjacentHTML('beforeend', renderPracticePlan(demoProgress));
}

// ---- PRACTICE PLAN ----
function renderPracticePlan(progress) {
  const summary = progress.team_summary;
  const cats = summary.categories;

  // Rank categories by weakness (lowest great+good percentage)
  const ranked = Object.entries(cats)
    .map(([cat, d]) => ({ cat, pct: d.total > 0 ? ((d.great + d.good) / d.total) * 100 : 0, ...d }))
    .sort((a, b) => a.pct - b.pct);

  const drills = {
    pitching: [
      { name: 'First Pitch Strike Challenge', desc: 'Each pitcher throws 10 first pitches. Goal: 7+ strikes. Track percentage over the week.' },
      { name: 'Stretch vs Windup Reps', desc: 'Alternate 5 pitches from the windup and 5 from the stretch. Focus on consistent arm slot.' },
      { name: 'Fielding the Position', desc: 'Hit comebackers to pitchers. Practice covering first base on grounders to the right side.' },
    ],
    offense: [
      { name: 'Situational At-Bats', desc: 'Set up game scenarios (runner on 3rd, 1 out). Hitter must execute: fly ball, ground ball right side, etc.' },
      { name: 'Two-Strike Drill', desc: 'Start every at-bat with an 0-2 count. Practice shortening the swing and protecting the plate.' },
      { name: 'Opposite Field Tee Work', desc: 'Place tee on outside corner. 10 swings going opposite field. Focus on letting the ball travel deep.' },
    ],
    defense: [
      { name: 'Cutoff & Relay Circuit', desc: 'Hit to each gap. Outfielders throw to the relay man, relay to the correct base. Rotate positions.' },
      { name: 'Bunt Defense Walkthrough', desc: 'Walk through bunt coverage at half-speed. Practice corner charges, who covers which base.' },
      { name: 'Communication Drill', desc: 'Pop flies between positions. Players must call the ball. No catch counts unless someone calls it.' },
    ],
    baserunning: [
      { name: 'Tag-Up Reads', desc: 'Coach hits fly balls to various depths. Runners on 3rd read whether to tag. Vary ball depth to train the read.' },
      { name: 'Secondary Lead Drill', desc: 'Runners on first practice their secondary shuffle as the pitch is delivered. Time from lead to second on steals.' },
      { name: 'First-to-Third Reads', desc: 'Singles to right field. Runners on first read the outfielder and decide: hold at 2nd or take 3rd? Coach the read.' },
    ],
  };

  const top3 = ranked.slice(0, 3);

  return `
    <h3 class="coach-section-heading">Practice Plan</h3>
    <div class="coach-summary-card">
      <h3 class="coach-summary-title">Top 3 Opportunities This Week</h3>
      <div class="coach-summary-text" style="margin-bottom:1.5rem;">
        Based on your team's results, here's what to focus on at practice:
      </div>
      ${top3.map((area, i) => `
        <div class="coach-practice-area">
          <div class="coach-practice-area-header">
            <span class="coach-practice-rank">${i + 1}</span>
            <span class="coach-practice-cat">${area.cat.charAt(0).toUpperCase() + area.cat.slice(1)}</span>
            <span class="coach-practice-pct" style="color:${area.pct >= 60 ? 'var(--great)' : area.pct >= 40 ? 'var(--okay)' : 'var(--bad)'}">${Math.round(area.pct)}% proficiency</span>
          </div>
          <div class="coach-practice-drills">
            ${(drills[area.cat] || []).map(d => `
              <div class="coach-drill">
                <div class="coach-drill-name">${d.name}</div>
                <div class="coach-drill-desc">${d.desc}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function renderPlayerCard(player) {
  const avatar = AVATAR_SVGS[player.avatar] || AVATAR_SVGS.ball;
  const categories = Object.entries(player.categories || {});

  const categoryBarsHTML = categories.map(([cat, data]) => {
    const total = data.total || 1;
    return `
      <div class="coach-player-cat">
        <div class="coach-player-cat-name">${cat}</div>
        <div class="coach-player-cat-bar">
          <div class="coach-cat-seg" style="width:${(data.great/total)*100}%;background:var(--great)" title="Great: ${data.great}"></div>
          <div class="coach-cat-seg" style="width:${(data.good/total)*100}%;background:var(--good)" title="Good: ${data.good}"></div>
          <div class="coach-cat-seg" style="width:${(data.okay/total)*100}%;background:var(--okay)" title="Okay: ${data.okay}"></div>
          <div class="coach-cat-seg" style="width:${(data.bad/total)*100}%;background:var(--bad)" title="Bad: ${data.bad}"></div>
        </div>
      </div>
    `;
  }).join('');

  const strengthsHTML = player.strengths.length > 0
    ? `<span class="coach-tag coach-tag-good">${player.strengths.join(', ')}</span>`
    : '';
  const needsWorkHTML = player.needs_work.length > 0
    ? `<span class="coach-tag coach-tag-bad">${player.needs_work.join(', ')}</span>`
    : '';

  const awardsHTML = (player.awards || []).map(a => `<span class="coach-award-badge" title="${a.award_name}"><svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M8 1.5l2 4 4.5.8-3.2 3.2.8 4.5L8 12l-4.1 2l.8-4.5L1.5 6.3l4.5-.8z"/></svg></span>`).join('');

  return `
    <div class="coach-player-card">
      <div class="coach-player-header">
        <span class="coach-player-avatar">${avatar}</span>
        <div class="coach-player-info">
          <div class="coach-player-name">${player.display_name}</div>
          <div class="coach-player-meta">${player.total_iq} IQ &bull; ${player.sessions_played} session${player.sessions_played !== 1 ? 's' : ''}</div>
        </div>
        <div class="coach-player-awards">${awardsHTML}</div>
      </div>

      ${categories.length > 0 ? `
        <div class="coach-player-categories">
          ${categoryBarsHTML}
        </div>
        <div class="coach-player-tags">
          ${strengthsHTML ? `<div class="coach-tag-row"><span class="coach-tag-label">Strengths:</span> ${strengthsHTML}</div>` : ''}
          ${needsWorkHTML ? `<div class="coach-tag-row"><span class="coach-tag-label">Needs Work:</span> ${needsWorkHTML}</div>` : ''}
        </div>
      ` : '<div class="coach-player-empty">No sessions yet</div>'}
    </div>
  `;
}
