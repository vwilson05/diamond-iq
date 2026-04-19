/**
 * Diamond IQ — Main Application Entry Point
 * Wires together: game state, field renderer, scoreboard, scenario panel, UI screens
 */

import { TEAMS } from './renderer/teams.js';
import { FieldCanvas } from './renderer/field-canvas.js';
import { Scoreboard } from './renderer/scoreboard.js';
import { GameState } from './engine/game-state.js';
import { loadScenarioList, loadScenario, getRandomScenario } from './engine/scenario-loader.js';
import { PlayerAuth } from './ui/player-auth.js';

// ---- State ----
const game = new GameState();
const playerAuth = new PlayerAuth();
let fieldCanvas = null;
let scoreboard = null;
let playedScenarioIds = [];
let scenarioList = [];
let currentSessionId = null;  // Server session ID for saving results

// ---- DOM Refs ----
const screens = {
  auth: document.getElementById('screen-auth'),
  teamSelect: document.getElementById('screen-team-select'),
  sportSelect: document.getElementById('screen-sport-select'),
  difficultySelect: document.getElementById('screen-difficulty-select'),
  game: document.getElementById('screen-game'),
  review: document.getElementById('screen-review'),
};

// ---- Screen Management ----
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

function setTeamColors(team) {
  document.documentElement.style.setProperty('--team-primary', team.primary);
  document.documentElement.style.setProperty('--team-secondary', team.secondary);
}

// ---- Team Picker ----
function renderTeamGrid() {
  const grid = document.getElementById('team-grid');
  grid.innerHTML = '';
  TEAMS.forEach(team => {
    const card = document.createElement('button');
    card.className = 'team-card';
    card.style.background = team.primary;
    card.style.color = team.secondary;
    card.innerHTML = `
      <span class="team-abbr">${team.abbr}</span>
      <span class="team-name">${team.city} ${team.name}</span>
    `;
    card.addEventListener('click', () => {
      game.selectTeam(team);
      setTeamColors(team);
      localStorage.setItem('diamond_iq_team', JSON.stringify(team));
      showScreen('difficultySelect');
      renderDifficultyCards();
    });
    grid.appendChild(card);
  });
}

// ---- Sport Picker ----
function initSportPicker() {
  document.querySelectorAll('.sport-card').forEach(card => {
    card.addEventListener('click', () => {
      game.selectSport(card.dataset.sport);
      localStorage.setItem('diamond_iq_sport', card.dataset.sport);
      startGame(TIERS.find(t => t.id === game.state.tier));
    });
  });
}

// ---- Difficulty Picker ----
const TIERS = [
  { id: 'tball', name: 'T-Ball', num: '1', desc: 'Learn the basics — where to throw, where to run, how to catch' },
  { id: 'rookie', name: 'Rookie', num: '2', desc: 'Fundamentals — force outs, tagging up, base running decisions' },
  { id: 'minors', name: 'Minors', num: '3', desc: 'Game IQ — cutoffs, relays, situational hitting, defensive positioning' },
  { id: 'majors', name: 'Majors', num: '4', desc: 'Advanced — double plays, pitch sequencing, hit-and-run, defensive schemes' },
  { id: 'the-show', name: 'The Show', num: '5', desc: 'Elite — squeeze plays, shifts, pitcher/batter chess, full-game strategy' },
];

function renderDifficultyCards() {
  const container = document.getElementById('difficulty-cards');
  container.innerHTML = '';
  TIERS.forEach(tier => {
    const card = document.createElement('button');
    card.className = 'difficulty-card';
    card.innerHTML = `
      <div class="tier-number">${tier.num}</div>
      <div class="tier-info">
        <div class="tier-name">${tier.name}</div>
        <div class="tier-desc">${tier.desc}</div>
      </div>
    `;
    card.addEventListener('click', () => {
      game.selectTier(tier.id);
      localStorage.setItem('diamond_iq_tier', tier.id);
      showScreen('sportSelect');
    });
    container.appendChild(card);
  });
}

// ---- Game Start ----
async function startGame(tier) {
  showScreen('game');
  playedScenarioIds = [];
  currentSessionId = null;

  // Start a server session if player is logged in
  const player = playerAuth.getPlayer();
  if (player) {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player_id: player.id,
          tier: game.state.tier,
          sport: game.state.sport,
        }),
      });
      if (res.ok) {
        const session = await res.json();
        currentSessionId = session.id;
      }
    } catch {
      // Non-fatal — continue without server session
    }
  }

  // Set up header
  document.getElementById('game-tier-badge').textContent = tier.name;
  document.getElementById('game-iq-display').textContent = 'IQ: 0';
  document.getElementById('game-scenario-count').textContent = '';

  // Initialize field canvas
  const canvas = document.getElementById('field-canvas');
  fieldCanvas = new FieldCanvas(canvas);
  fieldCanvas.drawField({
    primary: game.state.team.primary,
    secondary: game.state.team.secondary,
  });

  // Initialize scoreboard
  const sbContainer = document.getElementById('scoreboard-container');
  scoreboard = new Scoreboard(sbContainer);

  // Handle resize
  window.addEventListener('resize', () => {
    if (!fieldCanvas) return;
    fieldCanvas.drawField({
      primary: game.state.team.primary,
      secondary: game.state.team.secondary,
    });
  });

  // Load scenarios for this tier
  scenarioList = await loadScenarioList(tier.id);

  // Load first scenario
  await loadNextScenario();
}

async function loadNextScenario() {
  const panel = document.getElementById('scenario-panel');

  if (scenarioList.length === 0) {
    panel.innerHTML = `<div class="narration-text">No scenarios available for this tier yet. More coming soon!</div>
      <button class="btn-next-scenario" onclick="location.reload()">Back to Menu</button>`;
    return;
  }

  const pick = getRandomScenario(scenarioList, playedScenarioIds);
  if (!pick) {
    // All scenarios played — go to review
    showReview();
    return;
  }

  panel.innerHTML = '<div class="loading-spinner">Loading scenario</div>';

  const scenario = await loadScenario(game.state.tier, pick.id);
  if (!scenario) {
    panel.innerHTML = '<div class="narration-text">Failed to load scenario. Try again.</div>';
    return;
  }

  playedScenarioIds.push(pick.id);  // Use filename-based id to match the list
  game.loadScenario(scenario);

  // Update scoreboard with setup
  const setup = scenario.setup;
  const awayInnings = new Array(setup.inning).fill(0);
  const homeInnings = new Array(setup.inning).fill(0);
  // Distribute runs across innings roughly
  if (setup.score.away > 0) awayInnings[Math.max(0, setup.inning - 2)] = setup.score.away;
  if (setup.score.home > 0) homeInnings[Math.max(0, setup.inning - 3)] = setup.score.home;

  scoreboard.update({
    away: {
      abbr: 'AWAY',
      color: '#888888',
      innings: awayInnings,
      runs: setup.score.away,
      hits: setup.score.away + Math.floor(Math.random() * 3),
      errors: 0,
    },
    home: {
      abbr: game.state.team.abbr,
      color: game.state.team.primary,
      innings: homeInnings,
      runs: setup.score.home,
      hits: setup.score.home + Math.floor(Math.random() * 3),
      errors: 0,
    },
    currentInning: setup.inning,
    isTop: setup.topBottom === 'top',
    outs: setup.outs,
    balls: setup.count?.balls || 0,
    strikes: setup.count?.strikes || 0,
  });

  // Set defensive positions on field
  fieldCanvas.drawField({
    primary: game.state.team.primary,
    secondary: game.state.team.secondary,
  });
  // Set default defensive positions (using position keys that match POSITIONS in field-canvas)
  const defPositions = ['P', 'C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF'];
  fieldCanvas.setPositions(defPositions.map(pos => ({
    position: pos,
    label: pos,
    color: game.state.team.secondary,
  })));

  // Convert runners object {first: bool, second: bool, third: bool} to array format
  const runnerArr = [];
  if (setup.runners.first) runnerArr.push({ base: 'FIRST' });
  if (setup.runners.second) runnerArr.push({ base: 'SECOND' });
  if (setup.runners.third) runnerArr.push({ base: 'THIRD' });
  fieldCanvas.setRunners(runnerArr);

  // Update scenario count
  const count = game.state.scenariosCompleted + 1;
  document.getElementById('game-scenario-count').textContent = `Scenario ${count}`;

  // Start at root node
  processNode('root');
}

// ---- Node Processing ----
function processNode(nodeId) {
  const scenario = game.state.currentScenario;
  const node = scenario.nodes[nodeId];
  if (!node) {
    console.error('Node not found:', nodeId);
    return;
  }

  game.advanceToNode(nodeId);

  switch (node.type) {
    case 'transition':
      renderTransition(node, nodeId);
      break;
    case 'decision':
      renderDecision(node, nodeId);
      break;
    case 'outcome':
      renderOutcome(node, nodeId);
      break;
  }
}

function renderTransition(node, nodeId) {
  // Instead of showing a separate transition screen, merge the transition
  // narration with the next decision node and show it all at once.
  const scenario = game.state.currentScenario;
  const nextNode = node.next ? scenario.nodes[node.next] : null;

  if (nextNode && nextNode.type === 'decision') {
    // Combine narrations and render as a single decision screen
    const combinedNarration = node.narration + ' ' + nextNode.narration;
    const mergedNode = { ...nextNode, narration: combinedNarration };
    game.advanceToNode(node.next);
    renderDecision(mergedNode, node.next);
  } else if (node.next) {
    // No merge possible — just advance immediately (skip the pause)
    processNode(node.next);
  }
}

function renderDecision(node, nodeId) {
  const panel = document.getElementById('scenario-panel');
  const setup = game.state.currentScenario.setup;
  const sport = game.state.sport;

  panel.innerHTML = '';

  // Situation bar
  const sitBar = createSituationBar(setup);
  panel.appendChild(sitBar);

  // Narration
  const narDiv = document.createElement('div');
  narDiv.className = 'narration-text';
  panel.appendChild(narDiv);

  // Choices container (hidden until typewriter done)
  const choicesDiv = document.createElement('div');
  choicesDiv.className = 'choices-container';
  panel.appendChild(choicesDiv);

  typewriter(narDiv, node.narration, () => {
    // Render choices
    const letters = ['A', 'B', 'C', 'D', 'E'];
    node.choices.forEach((choice, i) => {
      // Check sport-specific filtering
      if (choice.onlyIn && choice.onlyIn !== sport) return;

      const btn = document.createElement('button');
      btn.className = 'choice-btn';

      if (choice.disabledReason) {
        btn.classList.add('disabled');
        btn.innerHTML = `<span class="choice-letter">${letters[i]}.</span>${choice.text} <span style="font-size:0.8rem;color:var(--text-muted)">— ${choice.disabledReason}</span>`;
      } else {
        btn.innerHTML = `<span class="choice-letter">${letters[i]}.</span>${choice.text}`;
        btn.addEventListener('click', () => {
          // Record choice in history (game-state's makeChoice auto-advances,
          // but we drive node transitions ourselves)
          game.state.history.push({
            scenarioId: game.state.currentScenario.id,
            scenarioTitle: game.state.currentScenario.title,
            choiceId: choice.id,
            choiceText: choice.text,
            nodeId: game.state.currentNode,
            timestamp: Date.now(),
          });
          processNode(choice.nextNode);
        });
      }

      choicesDiv.appendChild(btn);
    });
  });
}

function renderOutcome(node, nodeId) {
  const panel = document.getElementById('scenario-panel');
  const outcome = node.outcome;

  panel.innerHTML = '';

  // Animate the play on the field
  if (outcome.animation && outcome.animation.steps) {
    fieldCanvas.animate(outcome.animation.steps);
  }

  // Outcome display
  const outcomeDiv = document.createElement('div');
  outcomeDiv.className = 'outcome-display';
  // Build key terms HTML if present
  const termsHtml = outcome.keyTerms ? `
    <div class="outcome-terms">
      <div class="outcome-terms-label">Key Terms</div>
      ${outcome.keyTerms.map(t => `<div class="outcome-term"><strong>${t.term}</strong> — ${t.definition}</div>`).join('')}
    </div>
  ` : '';

  outcomeDiv.innerHTML = `
    <div class="outcome-headline ${outcome.result}">${outcome.headline}</div>
    <div class="outcome-explanation">${outcome.explanation}</div>
    ${termsHtml}
    <div class="outcome-remember">
      <div class="outcome-remember-label">Remember This</div>
      <div class="outcome-remember-text">${outcome.whatToRemember}</div>
    </div>
    <div class="outcome-iq">+${outcome.iqPoints} IQ Points</div>
  `;

  // Record outcome
  game.recordOutcome({
    scenarioId: game.state.currentScenario.id,
    scenarioTitle: game.state.currentScenario.title,
    result: outcome.result,
    headline: outcome.headline,
    explanation: outcome.explanation,
    whatToRemember: outcome.whatToRemember,
    iqPoints: outcome.iqPoints,
  });

  // Update IQ display
  document.getElementById('game-iq-display').textContent = `IQ: ${game.state.totalIQ}`;

  // Save result to server if we have a session
  if (currentSessionId) {
    try {
      fetch(`/api/sessions/${currentSessionId}/results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario_id: game.state.currentScenario.id,
          scenario_title: game.state.currentScenario.title,
          category: game.state.currentScenario.category || null,
          tier: game.state.tier,
          choice_id: game.state.history.length > 0 ? game.state.history[game.state.history.length - 1].choiceId : null,
          result: outcome.result,
          iq_points: outcome.iqPoints,
        }),
      }).catch(() => {});
    } catch {
      // Non-fatal
    }
  }

  // Next button
  const nextBtn = document.createElement('button');
  nextBtn.className = 'btn-next-scenario';

  if (outcome.next && outcome.next !== 'end') {
    // More nodes in this scenario
    nextBtn.textContent = 'Continue';
    nextBtn.addEventListener('click', () => processNode(outcome.next));
  } else {
    // Scenario complete (scenariosCompleted already incremented by recordOutcome)
    nextBtn.textContent = playedScenarioIds.length >= scenarioList.length ? 'See Results' : 'Next Scenario';
    nextBtn.addEventListener('click', () => {
      if (playedScenarioIds.length >= scenarioList.length) {
        showReview();
      } else {
        loadNextScenario();
      }
    });
  }

  outcomeDiv.appendChild(nextBtn);
  panel.appendChild(outcomeDiv);
}

// ---- Review Screen ----
function showReview() {
  showScreen('review');
  game.startReview();

  const container = document.getElementById('review-container');
  const history = game.getHistory();
  const totalIQ = game.state.totalIQ;
  const outcomeCount = history.filter(h => h.outcome).length;
  const maxIQ = outcomeCount * 10;
  const pct = maxIQ > 0 ? (totalIQ / maxIQ) * 100 : 0;

  let grade = 'A+';
  if (pct < 95) grade = 'A';
  if (pct < 85) grade = 'B+';
  if (pct < 75) grade = 'B';
  if (pct < 65) grade = 'C+';
  if (pct < 55) grade = 'C';
  if (pct < 45) grade = 'D';
  if (pct < 35) grade = 'F';

  // End session on server
  if (currentSessionId) {
    fetch(`/api/sessions/${currentSessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        total_iq: totalIQ,
        grade,
        scenarios_played: outcomeCount,
      }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.new_awards && data.new_awards.length > 0) {
          showAwardsToast(data.new_awards);
        }
      })
      .catch(() => {});

    currentSessionId = null;
  }

  container.innerHTML = `
    <div class="review-header">
      <div class="logo">DIAMOND <span class="logo-accent">IQ</span></div>
      <div class="review-title">Session Complete</div>
      <div class="review-iq-score">${totalIQ} IQ</div>
      <div class="review-grade">Grade: ${grade} (${Math.round(pct)}%) &mdash; ${history.length} scenario${history.length !== 1 ? 's' : ''}</div>
    </div>
    <div class="review-list">
      ${history.filter(h => h.outcome).map(h => `
        <div class="review-item ${h.outcome.result}">
          <div class="review-item-situation">${h.scenarioTitle}</div>
          <div class="review-item-choice">${h.outcome.headline}</div>
          <div class="review-item-why">${h.outcome.explanation}</div>
          <div style="margin-top:0.6rem;padding-top:0.6rem;border-top:1px solid rgba(255,255,255,0.06);">
            <div class="outcome-remember-label" style="font-size:0.65rem;">Remember This</div>
            <div style="font-size:0.82rem;color:var(--text-primary);margin-top:0.2rem;">${h.outcome.whatToRemember}</div>
          </div>
        </div>
      `).join('')}
    </div>
    <button class="btn-play-again">PLAY AGAIN</button>
  `;

  container.querySelector('.btn-play-again').addEventListener('click', () => {
    // Restart with saved preferences — don't make them re-pick
    const savedTeam = localStorage.getItem('diamond_iq_team');
    const savedTier = localStorage.getItem('diamond_iq_tier');
    const savedSport = localStorage.getItem('diamond_iq_sport');

    game.reset();

    if (savedTeam && savedTier && savedSport) {
      const team = JSON.parse(savedTeam);
      const tier = TIERS.find(t => t.id === savedTier);
      if (team && tier) {
        game.selectTeam(team);
        setTeamColors(team);
        game.selectTier(savedTier);
        game.selectSport(savedSport);
        if (playerAuth.getPlayer()) updatePlayerHeader();
        startGame(tier);
        return;
      }
    }
    showScreen('teamSelect');
  });
}

// ---- Helpers ----
function createSituationBar(setup) {
  const runners = [];
  if (setup.runners.first) runners.push('1st');
  if (setup.runners.second) runners.push('2nd');
  if (setup.runners.third) runners.push('3rd');
  const runnerText = runners.length > 0 ? runners.join(', ') : 'Empty';

  const sitBar = document.createElement('div');
  sitBar.className = 'situation-bar';
  sitBar.innerHTML = `
    <div class="sit-item"><span class="sit-label">Inn</span> ${setup.topBottom === 'top' ? 'Top' : 'Bot'} ${setup.inning}</div>
    <div class="sit-item"><span class="sit-label">Outs</span> ${setup.outs}</div>
    <div class="sit-item"><span class="sit-label">Score</span> ${setup.score.away}-${setup.score.home}</div>
    <div class="sit-item"><span class="sit-label">Runners</span> ${runnerText}</div>
  `;
  return sitBar;
}

function typewriter(element, text, onComplete, speed = 25) {
  let i = 0;
  const cursor = document.createElement('span');
  cursor.className = 'cursor';

  function type() {
    if (i < text.length) {
      element.textContent = text.slice(0, i + 1);
      element.appendChild(cursor);
      i++;
      setTimeout(type, speed);
    } else {
      cursor.remove();
      if (onComplete) onComplete();
    }
  }
  type();
}

// ---- Awards Toast ----
function showAwardsToast(awards) {
  for (let i = 0; i < awards.length; i++) {
    setTimeout(() => {
      const toast = document.createElement('div');
      toast.className = 'awards-toast';
      toast.innerHTML = `
        <div class="awards-toast-title">Award Earned!</div>
        <div class="awards-toast-name">${awards[i].award_name} — ${awards[i].description}</div>
      `;
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 4000);
    }, i * 1500);
  }
}

// ---- Player Profile in Header ----
function updatePlayerHeader() {
  const player = playerAuth.getPlayer();
  const existing = document.querySelector('.player-profile-btn');
  if (existing) existing.remove();

  if (player) {
    const AVATAR_MAP = {
      slugger: '\u26BE', rocket: '\uD83D\uDE80', glove: '\uD83E\uDD4E', lightning: '\u26A1',
      fire: '\uD83D\uDD25', star: '\u2B50', diamond: '\uD83D\uDC8E', trophy: '\uD83C\uDFC6',
    };
    const btn = document.createElement('button');
    btn.className = 'player-profile-btn';
    btn.innerHTML = `<span class="profile-avatar">${AVATAR_MAP[player.avatar] || '\u26BE'}</span>
      <span>${player.display_name}</span>
      <span class="profile-iq">${player.cumulative_iq || 0} IQ</span>`;
    btn.addEventListener('click', () => {
      playerAuth.logout();
      game.reset();
      showScreen('auth');
      bootAuth();
    });
    document.querySelector('.game-header-left').appendChild(btn);
  }
}

// ---- Menu ----
const menuBtn = document.getElementById('btn-menu');
const gameMenu = document.getElementById('game-menu');

menuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  gameMenu.classList.toggle('hidden');
});

// Close menu on outside click
document.addEventListener('click', () => {
  gameMenu.classList.add('hidden');
});

gameMenu.addEventListener('click', (e) => e.stopPropagation());

document.getElementById('menu-end').addEventListener('click', () => {
  gameMenu.classList.add('hidden');
  if (game.getHistory().length > 0) {
    showReview();
  } else {
    game.reset();
    showScreen('teamSelect');
  }
});

document.getElementById('menu-change-team').addEventListener('click', () => {
  gameMenu.classList.add('hidden');
  localStorage.removeItem('diamond_iq_team');
  game.reset();
  showScreen('teamSelect');
});

document.getElementById('menu-change-level').addEventListener('click', () => {
  gameMenu.classList.add('hidden');
  localStorage.removeItem('diamond_iq_tier');
  localStorage.removeItem('diamond_iq_sport');
  game.reset();
  // Keep team
  const savedTeam = localStorage.getItem('diamond_iq_team');
  if (savedTeam) {
    const team = JSON.parse(savedTeam);
    game.selectTeam(team);
    setTeamColors(team);
  }
  showScreen('difficultySelect');
  renderDifficultyCards();
});

document.getElementById('menu-profile').addEventListener('click', () => {
  gameMenu.classList.add('hidden');
  const player = playerAuth.getPlayer();
  if (player) {
    showPlayerProfile(player);
  }
});

document.getElementById('menu-logout').addEventListener('click', () => {
  gameMenu.classList.add('hidden');
  playerAuth.logout();
  localStorage.removeItem('diamond_iq_team');
  localStorage.removeItem('diamond_iq_tier');
  localStorage.removeItem('diamond_iq_sport');
  game.reset();
  showScreen('auth');
  bootAuth();
});

function showPlayerProfile(player) {
  showScreen('review');
  const container = document.getElementById('review-container');

  fetch(`/api/players/${player.id}`)
    .then(r => r.ok ? r.json() : player)
    .then(data => {
      const cats = data.categories || [];
      const catHtml = cats.map(c => `
        <div class="review-item good">
          <div class="review-item-situation">${(c.category || 'General').toUpperCase()}</div>
          <div class="review-item-choice">${c.total} scenarios played</div>
          <div class="review-item-why">Great: ${c.great} | Good: ${c.good} | Okay: ${c.okay} | Needs Work: ${c.bad}</div>
        </div>
      `).join('');

      container.innerHTML = `
        <div class="review-header">
          <div class="logo">DIAMOND <span class="logo-accent">IQ</span></div>
          <div class="review-title">${data.display_name}</div>
          <div class="review-iq-score">${data.cumulative_iq || 0} IQ</div>
          <div class="review-grade">${data.total_sessions || 0} sessions played</div>
        </div>
        <h3 style="color:var(--text-secondary);margin:1.5rem 0 1rem;text-transform:uppercase;letter-spacing:0.1em;font-size:0.8rem;">Progress by Category</h3>
        <div class="review-list">${catHtml || '<p style="color:var(--text-muted)">Play some scenarios to see your progress here!</p>'}</div>
        <button class="btn-play-again">BACK TO GAME</button>
      `;

      container.querySelector('.btn-play-again').addEventListener('click', () => {
        const savedTeam = localStorage.getItem('diamond_iq_team');
        const savedTier = localStorage.getItem('diamond_iq_tier');
        const savedSport = localStorage.getItem('diamond_iq_sport');
        game.reset();
        if (savedTeam && savedTier && savedSport) {
          const team = JSON.parse(savedTeam);
          const tier = TIERS.find(t => t.id === savedTier);
          if (team && tier) {
            game.selectTeam(team);
            setTeamColors(team);
            game.selectTier(savedTier);
            game.selectSport(savedSport);
            updatePlayerHeader();
            startGame(tier);
            return;
          }
        }
        showScreen('teamSelect');
      });
    })
    .catch(() => {
      container.innerHTML = '<p style="padding:2rem;color:var(--text-muted)">Could not load profile.</p>';
    });
}

// ---- Auth Boot ----
function bootAuth() {
  const authContainer = document.getElementById('auth-container');
  playerAuth.render(authContainer, (player) => {
    // player is null for guest mode
    showScreen('teamSelect');
    if (player) {
      updatePlayerHeader();
    }
  });
}

async function boot() {
  renderTeamGrid();
  initSportPicker();

  // Try auto-login
  const player = await playerAuth.autoLogin();
  if (player) {
    updatePlayerHeader();

    // Check for saved preferences — skip straight to game if we have them
    const savedTeam = localStorage.getItem('diamond_iq_team');
    const savedTier = localStorage.getItem('diamond_iq_tier');
    const savedSport = localStorage.getItem('diamond_iq_sport');

    if (savedTeam && savedTier && savedSport) {
      const team = JSON.parse(savedTeam);
      const tier = TIERS.find(t => t.id === savedTier);
      if (team && tier) {
        game.selectTeam(team);
        setTeamColors(team);
        game.selectTier(savedTier);
        game.selectSport(savedSport);
        startGame(tier);
        return;
      }
    }

    // No saved prefs — go to team select
    showScreen('teamSelect');
  } else {
    showScreen('auth');
    bootAuth();
  }
}

boot();
