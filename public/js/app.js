/**
 * PlayIQ — Main Application Entry Point
 * Wires together: game state, field renderer, scoreboard, scenario panel, UI screens
 */

import { TEAMS, SOFTBALL_TEAMS } from './renderer/teams.js';

const CHESS_TEAMS = [
  { id: 201, name: 'Knights', city: 'White', primary: '#F0D9B5', secondary: '#B58863', abbr: 'WHT' },
  { id: 202, name: 'Bishops', city: 'Black', primary: '#B58863', secondary: '#F0D9B5', abbr: 'BLK' },
  { id: 203, name: 'Rooks', city: 'Classic', primary: '#4A90D9', secondary: '#1a1a2e', abbr: 'CLS' },
  { id: 204, name: 'Pawns', city: 'Scholars', primary: '#7B2D8E', secondary: '#F0C808', abbr: 'SCH' },
  { id: 205, name: 'Queens', city: 'Champions', primary: '#C41E3A', secondary: '#FFD700', abbr: 'CHP' },
  { id: 206, name: 'Kings', city: 'Masters', primary: '#2A9D8F', secondary: '#264653', abbr: 'MST' },
];
import { FieldCanvas } from './renderer/field-canvas.js';
import { Scoreboard } from './renderer/scoreboard.js';
import { GameState } from './engine/game-state.js';
import { loadScenarioList, loadScenario, getRandomScenario } from './engine/scenario-loader.js';
import { ChessBoard } from './renderer/chess-board.js';
import { PlayerAuth, AVATAR_SVGS } from './ui/player-auth.js';

// ---- SVG Icons ----
const TOKEN_COIN_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2" fill="rgba(245,166,35,0.15)"/><circle cx="12" cy="12" r="7" stroke="currentColor" stroke-width="1.5" fill="none"/><text x="12" y="16" text-anchor="middle" font-size="10" font-weight="bold" fill="currentColor">T</text></svg>`;
const BRAIN_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C9 2 7 4 7 6.5C5.5 7 4 8.5 4 10.5C4 12 5 13.5 6 14V20C6 21 7 22 8 22H16C17 22 18 21 18 20V14C19 13.5 20 12 20 10.5C20 8.5 18.5 7 17 6.5C17 4 15 2 12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 2V22" stroke="currentColor" stroke-width="1.5" stroke-dasharray="2 2"/></svg>`;
const TARGET_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="6" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>`;
const TROPHY_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 21h8M12 17v4M6 3h12v4a6 6 0 01-12 0V3zM6 5H3v2a3 3 0 003 3M18 5h3v2a3 3 0 01-3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// ---- Impact & Token Multiplier ----
/**
 * Calculate impact multiplier (1x-5x) from scenario setup.
 * Late innings, close scores, runners in scoring position, and 2 outs = higher impact.
 */
function calcImpact(setup) {
  if (!setup) return 1;
  let impact = 1;

  // Chess
  if (setup.phase) {
    if (setup.phase === 'endgame') impact += 2;
    else if (setup.phase === 'middlegame') impact += 1;
    if (setup.advantage === 'losing') impact += 1;
    if (setup.advantage === 'equal') impact += 0.5;
    return Math.min(Math.round(impact), 5);
  }

  // Basketball/Football/Soccer — quarter/half + score
  if (setup.quarter || setup.half) {
    const period = setup.quarter || (setup.half === 2 ? 3 : 1);
    if (period >= 4) impact += 2;
    else if (period >= 3) impact += 1;
    if (setup.score) {
      const diff = Math.abs(setup.score.home - setup.score.away);
      if (diff <= 3) impact += 1;
      else if (diff <= 7) impact += 0.5;
    }
    if (setup.timeLeft) {
      const parts = setup.timeLeft.split(':');
      const secs = parseInt(parts[0]) * 60 + parseInt(parts[1] || 0);
      if (secs <= 120) impact += 1; // under 2 min
    }
    if (setup.down >= 3) impact += 0.5; // 3rd/4th down
    return Math.min(Math.round(impact), 5);
  }

  // Money/Coding — use difficulty or money amount
  if (setup.difficulty || setup.money) {
    if (setup.difficulty === 'advanced') impact += 2;
    else if (setup.difficulty === 'intermediate') impact += 1;
    if (setup.money && setup.money >= 50) impact += 1;
    return Math.min(Math.round(impact), 5);
  }

  // Baseball/softball
  const inning = setup.inning || 1;
  if (inning >= 9) impact += 2;
  else if (inning >= 7) impact += 1;
  if (setup.score) {
    const scoreDiff = Math.abs(setup.score.home - setup.score.away);
    if (scoreDiff <= 1) impact += 1;
    else if (scoreDiff <= 2) impact += 0.5;
  }
  if (setup.runners?.second || setup.runners?.third) impact += 1;
  if (setup.outs === 2) impact += 0.5;

  return Math.min(Math.round(impact), 5);
}

function getMultiplierLabel(multiplier) {
  if (multiplier >= 5) return 'Game-Changing Moment';
  if (multiplier >= 4) return 'Clutch Time';
  if (multiplier >= 3) return 'Big Decision';
  if (multiplier >= 2) return 'Key Play';
  return '';
}

// ---- State ----
const game = new GameState();
let sessionTokens = 0; // separate token count from IQ
const playerAuth = new PlayerAuth();
let fieldCanvas = null;
let chessBoard = null;
let scoreboard = null;
let playedScenarioIds = [];
let sessionPlayedIds = [];   // Persists across "Keep Going" rounds — no repeats in full session
let scenarioList = [];
let currentSessionId = null;  // Server session ID for saving results
const SCENARIOS_PER_ROUND = 5;

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
function renderTeamGrid(sport) {
  const grid = document.getElementById('team-grid');
  grid.innerHTML = '';
  const teamList = sport === 'chess' ? CHESS_TEAMS : sport === 'softball' ? SOFTBALL_TEAMS : TEAMS;
  teamList.forEach(team => {
    const card = document.createElement('button');
    card.className = 'team-card';
    card.style.background = team.primary;
    card.style.color = team.secondary;
    card.style.setProperty('--team-glow', team.primary + '80');
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
      selectSport(card.dataset.sport);
    });
  });
}

const NO_TEAM_SPORTS = ['chess', 'money', 'coding'];
const DEFAULT_TEAMS = {
  chess: { id: 201, name: 'Knights', city: 'White', primary: '#F0D9B5', secondary: '#B58863', abbr: 'WHT' },
  basketball: { id: 301, name: 'Ballers', city: 'All-Star', primary: '#E85D04', secondary: '#1a1a2e', abbr: 'ALL' },
  football: { id: 401, name: 'Legends', city: 'Gridiron', primary: '#2D6A4F', secondary: '#D4A373', abbr: 'GRD' },
  soccer: { id: 501, name: 'United', city: 'FC', primary: '#1D3557', secondary: '#E63946', abbr: 'FCU' },
  money: { id: 601, name: 'Savers', city: 'Smart', primary: '#2A9D8F', secondary: '#E9C46A', abbr: 'SMT' },
  coding: { id: 701, name: 'Devs', city: 'Code', primary: '#7209B7', secondary: '#4CC9F0', abbr: 'DEV' },
};

function selectSport(sport) {
  game.selectSport(sport);
  localStorage.setItem('diamond_iq_sport', sport);

  if (NO_TEAM_SPORTS.includes(sport) || !['baseball', 'softball'].includes(sport)) {
    // Non-team sports — skip team select, go straight to tiers
    const defaultTeam = DEFAULT_TEAMS[sport] || DEFAULT_TEAMS.chess;
    game.selectTeam(defaultTeam);
    setTeamColors(defaultTeam);
    localStorage.setItem('diamond_iq_team', JSON.stringify(defaultTeam));
    showScreen('difficultySelect');
    renderDifficultyCards();
  } else {
    renderTeamGrid(sport);
    showScreen('teamSelect');
  }
}

// ---- Difficulty Picker ----
const BASEBALL_TIERS = [
  { id: 'tball', name: 'T-Ball', num: '1', desc: 'Learn the basics — where to throw, where to run, how to catch' },
  { id: 'rookie', name: 'Rookie', num: '2', desc: 'Fundamentals — force outs, tagging up, base running decisions' },
  { id: 'minors', name: 'Minors', num: '3', desc: 'Game IQ — cutoffs, relays, situational hitting, defensive positioning' },
  { id: 'majors', name: 'Majors', num: '4', desc: 'Advanced — double plays, pitch sequencing, hit-and-run, defensive schemes' },
  { id: 'the-show', name: 'The Show', num: '5', desc: 'Elite — squeeze plays, shifts, pitcher/batter chess, full-game strategy' },
];

const CHESS_TIERS = [
  { id: 'tball', name: 'Pawn', num: '1', desc: 'Learn the basics — piece values, how pieces move, simple captures' },
  { id: 'rookie', name: 'Knight', num: '2', desc: 'Fundamentals — check, checkmate, protecting pieces, trading up' },
  { id: 'minors', name: 'Bishop', num: '3', desc: 'Tactics — forks, pins, skewers, discovered attacks' },
  { id: 'majors', name: 'Rook', num: '4', desc: 'Strategy — openings, pawn structure, when to trade, king safety' },
  { id: 'the-show', name: 'Queen', num: '5', desc: 'Master — sacrifices, combinations, endgame technique, full plans' },
];

const BASKETBALL_TIERS = [
  { id: 'tball', name: 'Rec League', num: '1', desc: 'Basics — dribbling, passing, shooting form, positions' },
  { id: 'rookie', name: 'JV', num: '2', desc: 'Fundamentals — pick and roll, fast breaks, boxing out, help defense' },
  { id: 'minors', name: 'Varsity', num: '3', desc: 'Game IQ — spacing, screens, transition defense, shot clock' },
  { id: 'majors', name: 'College', num: '4', desc: 'Advanced — zone vs man, pick and pop, press breaks, drawing fouls' },
  { id: 'the-show', name: 'Pro', num: '5', desc: 'Elite — end of game, defensive switches, 2-for-1, clutch plays' },
];

const FOOTBALL_TIERS = [
  { id: 'tball', name: 'Flag', num: '1', desc: 'Basics — positions, catching, handoffs, which way to run' },
  { id: 'rookie', name: 'Pee Wee', num: '2', desc: 'Fundamentals — play action, zone coverage, punt decisions' },
  { id: 'minors', name: 'JV', num: '3', desc: 'Game IQ — reading defenses, audibles, clock management, 4th down' },
  { id: 'majors', name: 'Varsity', num: '4', desc: 'Advanced — route trees, RPO reads, red zone offense, 2-point tries' },
  { id: 'the-show', name: 'Pro', num: '5', desc: 'Elite — 2-minute drill, trick plays, onside kicks, goal line stands' },
];

const SOCCER_TIERS = [
  { id: 'tball', name: 'U6', num: '1', desc: 'Basics — passing, shooting, dribbling, throw-ins' },
  { id: 'rookie', name: 'U8', num: '2', desc: 'Fundamentals — first touch, give-and-go, corner kicks, offsides' },
  { id: 'minors', name: 'U10', num: '3', desc: 'Game IQ — through balls, switching field, counter attacks, set pieces' },
  { id: 'majors', name: 'U12', num: '4', desc: 'Advanced — formations, pressing, overlap runs, tactical fouls' },
  { id: 'the-show', name: 'Academy', num: '5', desc: 'Elite — penalty shootouts, parking the bus, injury time decisions' },
];

const MONEY_TIERS = [
  { id: 'tball', name: 'Piggy Bank', num: '1', desc: 'Basics — coins and bills, needs vs wants, saving, earning' },
  { id: 'rookie', name: 'Allowance', num: '2', desc: 'Fundamentals — budgeting, comparing prices, saving for a goal' },
  { id: 'minors', name: 'Smart Shopper', num: '3', desc: 'Smart spending — sales, opportunity cost, quality vs cheap' },
  { id: 'majors', name: 'Entrepreneur', num: '4', desc: 'Business — lemonade stand math, supply and demand, profit' },
  { id: 'the-show', name: 'Investor', num: '5', desc: 'Real world — compound interest, credit, giving back, big purchases' },
];

const CODING_TIERS = [
  { id: 'tball', name: 'Blocks', num: '1', desc: 'Basics — sequences, simple loops, if/then, what does this code do' },
  { id: 'rookie', name: 'Scratch', num: '2', desc: 'Fundamentals — variables, debugging, input/output, counting loops' },
  { id: 'minors', name: 'Builder', num: '3', desc: 'Problem solving — nested loops, functions, lists, patterns' },
  { id: 'majors', name: 'Hacker', num: '4', desc: 'Logic — AND/OR/NOT, flowcharts, efficiency, algorithms' },
  { id: 'the-show', name: 'Dev', num: '5', desc: 'Real code — reading Python, APIs, data structures, building apps' },
];

const SPORT_TIERS = {
  baseball: BASEBALL_TIERS,
  softball: BASEBALL_TIERS,
  chess: CHESS_TIERS,
  basketball: BASKETBALL_TIERS,
  football: FOOTBALL_TIERS,
  soccer: SOCCER_TIERS,
  money: MONEY_TIERS,
  coding: CODING_TIERS,
};

function getTiers() {
  return SPORT_TIERS[game.state.sport] || BASEBALL_TIERS;
}

function renderDifficultyCards() {
  const container = document.getElementById('difficulty-cards');
  container.innerHTML = '';
  const TIERS = getTiers();
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
      startGame(tier);
    });
    container.appendChild(card);
  });
}

// ---- Game Start ----
async function startGame(tier) {
  showScreen('game');
  playedScenarioIds = [];
  sessionPlayedIds = [];
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
  updateTokenDisplay(0);

  // Initialize field/board based on sport
  const canvas = document.getElementById('field-canvas');
  const sbContainer = document.getElementById('scoreboard-container');

  const gameBody = document.querySelector('.game-body');
  const isBaseball = ['baseball', 'softball'].includes(game.state.sport);
  const isChess = game.state.sport === 'chess';

  if (isChess) {
    // Chess mode
    gameBody.classList.add('chess-mode');
    chessBoard = new ChessBoard(canvas);
    chessBoard.setPosition('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
    fieldCanvas = null;
    sbContainer.style.display = 'none';
  } else if (!isBaseball) {
    // Non-field sports (basketball, football, soccer, money, coding) — hide field and scoreboard
    gameBody.classList.add('chess-mode'); // reuse layout (no field panel)
    fieldCanvas = null;
    chessBoard = null;
    sbContainer.style.display = 'none';
    canvas.style.display = 'none';
  } else {
    // Baseball/softball mode
    gameBody.classList.remove('chess-mode');
    canvas.style.display = '';
    chessBoard = null;
    sbContainer.style.display = '';
    fieldCanvas = new FieldCanvas(canvas);
    fieldCanvas.drawField({
      primary: game.state.team.primary,
      secondary: game.state.team.secondary,
    });
    scoreboard = new Scoreboard(sbContainer);

    window.addEventListener('resize', () => {
      if (!fieldCanvas) return;
      fieldCanvas.drawField({
        primary: game.state.team.primary,
        secondary: game.state.team.secondary,
      });
    });
  }

  // Load scenarios for this tier, filtered by sport
  const allScenarios = await loadScenarioList(tier.id);
  const currentSport = game.state.sport || 'baseball';
  scenarioList = allScenarios.filter(s => {
    if (!s.sport || s.sport.length === 0) return currentSport !== 'chess'; // no sport tag = baseball/softball
    return s.sport.includes(currentSport);
  });

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

  // Check if we've hit the per-round limit
  if (playedScenarioIds.length >= SCENARIOS_PER_ROUND) {
    showReview();
    return;
  }

  const pick = getRandomScenario(scenarioList, sessionPlayedIds);
  if (!pick) {
    // All scenarios in the tier exhausted — go to review
    showReview();
    return;
  }

  panel.innerHTML = '<div class="loading-spinner">Loading scenario</div>';

  const scenario = await loadScenario(game.state.tier, pick.id);
  if (!scenario) {
    panel.innerHTML = '<div class="narration-text">Failed to load scenario. Try again.</div>';
    return;
  }

  playedScenarioIds.push(pick.id);
  sessionPlayedIds.push(pick.id);  // Track across rounds so "Keep Going" never repeats
  game.loadScenario(scenario);

  // Update board/field with setup
  const setup = scenario.setup;

  if (game.state.sport === 'chess') {
    // Chess — update board position
    if (chessBoard && setup.position) {
      chessBoard.setPosition(setup.position);
      if (setup.lastMove) {
        chessBoard.setHighlights([setup.lastMove.slice(0, 2), setup.lastMove.slice(2, 4)]);
      }
    }
  } else {
    // Baseball/softball — update scoreboard and field
    const awayInnings = new Array(setup.inning).fill(0);
    const homeInnings = new Array(setup.inning).fill(0);
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

    fieldCanvas.drawField({
      primary: game.state.team.primary,
      secondary: game.state.team.secondary,
    });
    const defPositions = ['P', 'C', '1B', '2B', 'SS', '3B', 'LF', 'CF', 'RF'];
    fieldCanvas.setPositions(defPositions.map(pos => ({
      position: pos,
      label: pos,
      color: game.state.team.secondary,
    })));

    const runnerArr = [];
    if (setup.runners.first) runnerArr.push({ base: 'FIRST' });
    if (setup.runners.second) runnerArr.push({ base: 'SECOND' });
    if (setup.runners.third) runnerArr.push({ base: 'THIRD' });
    fieldCanvas.setRunners(runnerArr);
  }

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
  // Skip transition screen — go straight to the next decision node.
  // The decision node's narration is self-contained.
  const scenario = game.state.currentScenario;
  const nextNode = node.next ? scenario.nodes[node.next] : null;

  if (nextNode && nextNode.type === 'decision') {
    game.advanceToNode(node.next);
    renderDecision(nextNode, node.next);
  } else if (node.next) {
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

  // Impact multiplier banner
  const scenario = game.state.currentScenario;
  const multiplier = scenario.impact || calcImpact(setup);
  if (multiplier >= 2) {
    const banner = document.createElement('div');
    banner.className = 'impact-banner';
    banner.innerHTML = `
      <span class="impact-label">${getMultiplierLabel(multiplier)}</span>
      <span class="impact-multiplier">${multiplier}x Token Multiplier</span>
    `;
    panel.appendChild(banner);
  }

  // Narration
  const narDiv = document.createElement('div');
  narDiv.className = 'narration-text';
  panel.appendChild(narDiv);

  // Choices container (hidden until typewriter done)
  const choicesDiv = document.createElement('div');
  choicesDiv.className = 'choices-container';
  panel.appendChild(choicesDiv);

  typewriter(narDiv, node.narration, () => {
    // Shuffle choices so correct answer isn't always A (Fisher-Yates)
    const shuffled = [...node.choices];
    for (let si = shuffled.length - 1; si > 0; si--) {
      const sj = Math.floor(Math.random() * (si + 1));
      [shuffled[si], shuffled[sj]] = [shuffled[sj], shuffled[si]];
    }

    // Render choices
    const letters = ['A', 'B', 'C', 'D', 'E'];
    shuffled.forEach((choice, i) => {
      // Check sport-specific filtering
      if (choice.onlyIn && choice.onlyIn !== sport) return;

      const btn = document.createElement('button');
      btn.className = 'choice-btn';

      if (choice.disabledReason) {
        btn.classList.add('disabled');
        btn.innerHTML = `<span class="choice-letter">${letters[i]}</span><span class="choice-text">${choice.text} <span style="font-size:0.8rem;color:var(--text-muted)">-- ${choice.disabledReason}</span></span>`;
      } else {
        btn.innerHTML = `<span class="choice-letter">${letters[i]}</span><span class="choice-text">${choice.text}</span>`;
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

  // Animate the play on the field/board
  if (outcome.animation && outcome.animation.steps && fieldCanvas) {
    fieldCanvas.animate(outcome.animation.steps);
  }
  if (outcome.animation && outcome.animation.move && chessBoard) {
    chessBoard.animateMove(outcome.animation.move.slice(0, 2), outcome.animation.move.slice(2, 4));
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

  // Calculate tokens earned with impact multiplier
  const scenarioMultiplier = game.state.currentScenario.impact || calcImpact(game.state.currentScenario.setup);
  const baseTokens = outcome.iqPoints || 0;
  const tokensEarned = baseTokens * scenarioMultiplier;
  sessionTokens += tokensEarned;

  const tokenHtml = scenarioMultiplier > 1
    ? `<div class="outcome-tokens"><span class="token-coin">${TOKEN_COIN_SVG}</span> +${tokensEarned} tokens <span class="token-multiplier-tag">${scenarioMultiplier}x multiplier</span></div>`
    : `<div class="outcome-tokens"><span class="token-coin">${TOKEN_COIN_SVG}</span> +${tokensEarned} tokens</div>`;

  outcomeDiv.innerHTML = `
    <div class="outcome-headline ${outcome.result}">${outcome.headline}</div>
    <div class="outcome-explanation">${outcome.explanation}</div>
    ${termsHtml}
    <div class="outcome-remember">
      <div class="outcome-remember-label">Remember This</div>
      <div class="outcome-remember-text">${outcome.whatToRemember}</div>
    </div>
    <div class="outcome-iq">+${outcome.iqPoints} IQ Points</div>
    ${tokenHtml}
  `;

  // Record outcome (include category + whatToRemember for review breakdown)
  game.recordOutcome({
    scenarioId: game.state.currentScenario.id,
    scenarioTitle: game.state.currentScenario.title,
    result: outcome.result,
    headline: outcome.headline,
    explanation: outcome.explanation,
    whatToRemember: outcome.whatToRemember,
    iqPoints: outcome.iqPoints,
    category: game.state.currentScenario.role || 'general',
  });

  // Update IQ display with animation
  const iqEl = document.getElementById('game-iq-display');
  iqEl.textContent = `IQ: ${game.state.totalIQ}`;
  iqEl.classList.remove('iq-bump');
  void iqEl.offsetWidth; // force reflow to restart animation
  iqEl.classList.add('iq-bump');

  // Update token display (tokens are separate from IQ now)
  updateTokenDisplay(sessionTokens);

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
    const roundDone = playedScenarioIds.length >= SCENARIOS_PER_ROUND || sessionPlayedIds.length >= scenarioList.length;
    nextBtn.textContent = roundDone ? 'See Results' : 'Next Scenario';
    nextBtn.addEventListener('click', () => {
      if (roundDone) {
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

  // Score ring SVG dimensions
  const ringR = 58;
  const ringCirc = 2 * Math.PI * ringR;
  const ringOffset = ringCirc - (ringCirc * Math.min(pct, 100) / 100);
  const gradeClass = grade.startsWith('A') ? 'grade-a' : grade.startsWith('B') ? 'grade-b' : grade.startsWith('C') ? 'grade-c' : 'grade-d';

  // --- Category Breakdown ---
  const outcomesWithCat = history.filter(h => h.outcome);
  const catMap = {};
  const CATEGORY_ORDER = ['defense', 'offense', 'pitching', 'baserunning'];
  outcomesWithCat.forEach(h => {
    const cat = (h.outcome.category || 'general').toLowerCase();
    if (!catMap[cat]) catMap[cat] = { total: 0, greatGood: 0 };
    catMap[cat].total++;
    if (h.outcome.result === 'great' || h.outcome.result === 'good') catMap[cat].greatGood++;
  });

  const catBarColor = (p) => p >= 80 ? 'var(--great)' : p >= 60 ? 'var(--good)' : p >= 40 ? 'var(--okay)' : 'var(--bad)';

  const allCats = [...new Set([...CATEGORY_ORDER, ...Object.keys(catMap)])];
  const catCards = allCats.filter(c => catMap[c]).map(cat => {
    const d = catMap[cat];
    const p = d.total > 0 ? Math.round((d.greatGood / d.total) * 100) : 0;
    return `<div class="review-cat-card">
      <div class="review-cat-label">${cat}</div>
      <div class="review-cat-bar-track"><div class="review-cat-bar-fill" style="width:${p}%;background:${catBarColor(p)}"></div></div>
      <span class="review-cat-pct">${p}%</span> <span class="review-cat-count">(${d.greatGood}/${d.total})</span>
    </div>`;
  }).join('');

  // --- Focus Area (weakest category) ---
  let weakestCat = null;
  let weakestPct = 101;
  allCats.filter(c => catMap[c]).forEach(cat => {
    const d = catMap[cat];
    const p = d.total > 0 ? (d.greatGood / d.total) * 100 : 100;
    if (p < weakestPct) { weakestPct = p; weakestCat = cat; }
  });
  const focusHtml = weakestCat && weakestPct < 80 ? `
    <div class="review-focus">
      <div class="review-focus-icon">${TARGET_SVG}</div>
      <div>
        <div class="review-focus-label">Focus Area</div>
        <div class="review-focus-text">Work on: ${weakestCat.charAt(0).toUpperCase() + weakestCat.slice(1)}</div>
      </div>
    </div>` : '';

  // --- Key Facts to Review (non-great outcomes) ---
  const factsToReview = outcomesWithCat.filter(h => h.outcome.result !== 'great' && h.outcome.whatToRemember);
  const factsHtml = factsToReview.length > 0 ? `
    <div class="review-facts">
      <div class="review-facts-header">
        <div class="review-facts-icon">${BRAIN_SVG}</div>
        <div class="review-facts-title">Review These</div>
      </div>
      ${factsToReview.map(h => `
        <div class="review-fact-item">
          <div class="review-fact-scenario">${h.scenarioTitle}</div>
          ${h.outcome.whatToRemember}
        </div>
      `).join('')}
    </div>` : '';

  // --- Tokens earned this round (with multipliers) ---
  const tokensHtml = `<div class="review-tokens">
    <span class="review-tokens-earned"><span class="token-coin">${TOKEN_COIN_SVG}</span> +${sessionTokens} tokens earned this round</span>
  </div>`;

  container.innerHTML = `
    <div class="review-header">
      <div class="logo">PLAY<span class="logo-accent">IQ</span></div>
      <div class="review-title">Session Complete</div>
      <div class="review-score-ring">
        <svg viewBox="0 0 140 140">
          <circle class="ring-bg" cx="70" cy="70" r="${ringR}"/>
          <circle class="ring-fill" cx="70" cy="70" r="${ringR}" stroke-dasharray="${ringCirc}" stroke-dashoffset="${ringOffset}"/>
        </svg>
        <div class="ring-label">
          <span class="ring-grade ${gradeClass}" style="color: ${grade.startsWith('A') ? 'var(--great)' : grade.startsWith('B') ? 'var(--good)' : grade.startsWith('C') ? 'var(--okay)' : 'var(--bad)'}">${grade}</span>
          <span class="ring-pct">${Math.round(pct)}%</span>
        </div>
      </div>
      <div class="review-iq-score">${totalIQ} IQ</div>
      <div class="review-grade">${history.length} scenario${history.length !== 1 ? 's' : ''} completed</div>
      ${tokensHtml}
    </div>
    ${catCards ? `<h3 class="profile-section-header">Category Breakdown</h3><div class="review-categories">${catCards}</div>` : ''}
    ${focusHtml}
    ${factsHtml}
    <h3 class="profile-section-header">Decisions</h3>
    <div class="review-list">
      ${history.filter(h => h.outcome).map(h => `
        <div class="review-item ${h.outcome.result}">
          <div class="review-item-situation">${h.scenarioTitle}${h.outcome.category ? ` <span style="opacity:0.5;font-size:0.65rem;">/ ${h.outcome.category}</span>` : ''}</div>
          <div class="review-item-choice">${h.outcome.headline}</div>
          <div class="review-item-why">${h.outcome.explanation}</div>
          <div style="margin-top:0.6rem;padding-top:0.6rem;border-top:1px solid rgba(255,255,255,0.06);">
            <div class="outcome-remember-label" style="font-size:0.65rem;">Remember This</div>
            <div style="font-size:0.82rem;color:var(--text-primary);margin-top:0.2rem;">${h.outcome.whatToRemember}</div>
          </div>
        </div>
      `).join('')}
    </div>
    <div class="review-buttons">
      <button class="btn-play-again btn-keep-going">KEEP GOING</button>
      <button class="btn-play-again btn-change-level">CHANGE LEVEL</button>
    </div>
  `;

  // "Keep Going" — play 5 more at the same level (no scenario repeats within session)
  container.querySelector('.btn-keep-going').addEventListener('click', () => {
    const savedTeam = localStorage.getItem('diamond_iq_team');
    const savedTier = localStorage.getItem('diamond_iq_tier');
    const savedSport = localStorage.getItem('diamond_iq_sport');

    if (savedSport && savedTeam && savedTier) {
      const team = JSON.parse(savedTeam);
      const tier = getTiers().find(t => t.id === savedTier);
      if (team && tier) {
        // Reset per-round counter but keep sessionPlayedIds to avoid repeats
        playedScenarioIds = [];
        game.selectSport(savedSport);
        game.selectTeam(team);
        setTeamColors(team);
        game.selectTier(savedTier);

        showScreen('game');

        // Set up header
        document.getElementById('game-tier-badge').textContent = tier.name;
        document.getElementById('game-scenario-count').textContent = '';

        loadNextScenario();
        return;
      }
    }
    showScreen('sportSelect');
  });

  // "Change Level" — go to difficulty select with saved sport/team
  container.querySelector('.btn-change-level').addEventListener('click', () => {
    const savedSport = localStorage.getItem('diamond_iq_sport');
    const savedTeam = localStorage.getItem('diamond_iq_team');

    game.reset(); sessionTokens = 0;

    if (savedSport) game.selectSport(savedSport);
    if (savedTeam) {
      const team = JSON.parse(savedTeam);
      game.selectTeam(team);
      setTeamColors(team);
    }
    showScreen('difficultySelect');
    renderDifficultyCards();
  });
}

// ---- Helpers ----
function updateTokenDisplay(total) {
  const el = document.getElementById('game-token-display');
  if (el) {
    el.innerHTML = `<span class="token-coin">${TOKEN_COIN_SVG}</span> ${total}`;
  }
}

function createSituationBar(setup) {
  const sitBar = document.createElement('div');
  sitBar.className = 'situation-bar';

  const sport = game.state.sport;

  // Generic situation bar for non-field sports
  if (['basketball', 'football', 'soccer', 'money', 'coding'].includes(sport)) {
    const items = [];
    if (setup.quarter) items.push(`Q${setup.quarter}`);
    if (setup.half) items.push(`Half ${setup.half}`);
    if (setup.timeLeft) items.push(setup.timeLeft);
    if (setup.down) items.push(`${setup.down}${['st','nd','rd','th'][Math.min(setup.down-1,3)]} & ${setup.distance}`);
    if (setup.score) items.push(`${setup.score.home}-${setup.score.away}`);
    if (setup.shotClock) items.push(`Shot: ${setup.shotClock}s`);
    if (setup.situation) items.push(setup.situation.replace(/-/g, ' '));
    if (setup.concept) items.push(setup.concept);
    if (setup.context) items.push(setup.context);

    sitBar.innerHTML = items.map(item =>
      `<div class="sit-item"><span class="sit-label">${item}</span></div>`
    ).join('');
    return sitBar;
  }

  if (sport === 'chess') {
    // Chess situation bar
    const chessSvg = `<span class="sit-icon"><svg viewBox="0 0 16 16"><rect x="2" y="2" width="5" height="5" fill="currentColor" opacity="0.3"/><rect x="9" y="2" width="5" height="5" fill="currentColor" opacity="0.6"/><rect x="2" y="9" width="5" height="5" fill="currentColor" opacity="0.6"/><rect x="9" y="9" width="5" height="5" fill="currentColor" opacity="0.3"/></svg></span>`;
    const colorSvg = `<span class="sit-icon"><svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5" fill="${setup.playerColor === 'white' ? '#fff' : '#333'}"/></svg></span>`;
    const phaseSvg = `<span class="sit-icon"><svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M8 4v4l3 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span>`;

    sitBar.innerHTML = `
      <div class="sit-item">${chessSvg}<span class="sit-label">Move</span> ${setup.move || '?'}</div>
      <div class="sit-item">${colorSvg}<span class="sit-label">Playing</span> ${(setup.playerColor || 'white').charAt(0).toUpperCase() + (setup.playerColor || 'white').slice(1)}</div>
      <div class="sit-item">${phaseSvg}<span class="sit-label">Phase</span> ${(setup.phase || 'middlegame').charAt(0).toUpperCase() + (setup.phase || 'middlegame').slice(1)}</div>
      <div class="sit-item"><span class="sit-label">Position</span> ${setup.advantage || 'Equal'}</div>
    `;

    // Update chess board with position
    if (chessBoard && setup.position) {
      chessBoard.setPosition(setup.position);
      if (setup.lastMove) {
        const from = setup.lastMove.slice(0, 2);
        const to = setup.lastMove.slice(2, 4);
        chessBoard.setHighlights([from, to]);
      }
    }
  } else {
    // Baseball/softball situation bar
    const runners = [];
    if (setup.runners.first) runners.push('1st');
    if (setup.runners.second) runners.push('2nd');
    if (setup.runners.third) runners.push('3rd');
    const runnerText = runners.length > 0 ? runners.join(', ') : 'Empty';

    const inningSvg = `<span class="sit-icon"><svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M8 4v4l3 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></span>`;
    const outsSvg = `<span class="sit-icon"><svg viewBox="0 0 16 16"><circle cx="5" cy="8" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="11" cy="8" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/></svg></span>`;
    const scoreSvg = `<span class="sit-icon"><svg viewBox="0 0 16 16"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" stroke-width="1"/></svg></span>`;
    const runnerSvg = `<span class="sit-icon"><svg viewBox="0 0 16 16"><path d="M8 2L14 8L8 14L2 8Z" stroke="currentColor" stroke-width="1.5" fill="none"/></svg></span>`;

    sitBar.innerHTML = `
      <div class="sit-item">${inningSvg}<span class="sit-label">Inn</span> ${setup.topBottom === 'top' ? 'Top' : 'Bot'} ${setup.inning}</div>
      <div class="sit-item">${outsSvg}<span class="sit-label">Outs</span> ${setup.outs}</div>
      <div class="sit-item">${scoreSvg}<span class="sit-label">Score</span> ${setup.score.away}-${setup.score.home}</div>
      <div class="sit-item">${runnerSvg}<span class="sit-label">Runners</span> ${runnerText}</div>
    `;
  }

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
    const avatarSvg = AVATAR_SVGS[player.avatar] || AVATAR_SVGS.ball;
    const btn = document.createElement('button');
    btn.className = 'player-profile-btn';
    btn.innerHTML = `<span class="profile-avatar">${avatarSvg}</span>
      <span>${player.display_name}</span>
      <span class="profile-iq">${player.cumulative_iq || 0} IQ</span>
      <span class="token-display" style="font-size:0.8rem;margin-left:0.2rem;"><span class="token-coin">${TOKEN_COIN_SVG}</span>${player.cumulative_iq || 0}</span>`;
    btn.addEventListener('click', () => {
      playerAuth.logout();
      game.reset(); sessionTokens = 0;
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
    game.reset(); sessionTokens = 0;
    showScreen('sportSelect');
  }
});

document.getElementById('menu-change-team').addEventListener('click', () => {
  gameMenu.classList.add('hidden');
  localStorage.removeItem('diamond_iq_team');
  localStorage.removeItem('diamond_iq_sport');
  game.reset();
  showScreen('sportSelect');
});

document.getElementById('menu-change-level').addEventListener('click', () => {
  gameMenu.classList.add('hidden');
  localStorage.removeItem('diamond_iq_tier');
  game.reset();
  // Keep sport and team
  const savedSport = localStorage.getItem('diamond_iq_sport');
  const savedTeam = localStorage.getItem('diamond_iq_team');
  if (savedSport) {
    game.selectSport(savedSport);
  }
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
  showPlayerProfile(player);
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

  const isGuest = !player || !player.id;

  // Helper: render category mastery bars
  function renderMasteryBars(cats) {
    if (!cats || cats.length === 0) return '<p style="color:var(--text-muted)">Play some scenarios to see your progress here!</p>';
    const barColor = (p) => p >= 80 ? 'var(--great)' : p >= 60 ? 'var(--good)' : p >= 40 ? 'var(--okay)' : 'var(--bad)';
    return `<div class="profile-mastery">${cats.map(c => {
      const total = c.total || 0;
      const gg = (c.great || 0) + (c.good || 0);
      const pct = total > 0 ? Math.round((gg / total) * 100) : 0;
      return `<div class="profile-mastery-item">
        <div class="profile-mastery-label">
          <span class="profile-mastery-name">${(c.category || 'General')}</span>
          <span class="profile-mastery-pct">${pct}%</span>
        </div>
        <div class="profile-mastery-bar-track"><div class="profile-mastery-bar-fill" style="width:${pct}%;background:${barColor(pct)}"></div></div>
        <div class="profile-mastery-stats">${total} scenarios — Great: ${c.great || 0} | Good: ${c.good || 0} | Okay: ${c.okay || 0} | Opportunity: ${c.bad || 0}</div>
      </div>`;
    }).join('')}</div>`;
  }

  // Helper: render awards
  function renderAwards(awards) {
    if (!awards || awards.length === 0) return '<p style="color:var(--text-muted)">Keep playing to earn awards!</p>';
    return `<div class="profile-awards">${awards.map(a => `
      <div class="profile-award-card">
        <div class="profile-award-icon">${TROPHY_SVG}</div>
        <div class="profile-award-name">${a.award_name || a.name}</div>
        <div class="profile-award-date">${a.earned_at ? new Date(a.earned_at).toLocaleDateString() : ''}</div>
      </div>
    `).join('')}</div>`;
  }

  // Helper: render session history
  function renderSessionHistory(sessions) {
    if (!sessions || sessions.length === 0) return '<p style="color:var(--text-muted)">No sessions recorded yet.</p>';
    return `<div class="profile-history">${sessions.slice(0, 5).map(s => `
      <div class="profile-history-item">
        <div class="profile-history-left">
          <span class="profile-history-tier">${s.tier || 'Unknown'} ${s.grade ? '(' + s.grade + ')' : ''}</span>
          <span class="profile-history-date">${s.created_at ? new Date(s.created_at).toLocaleDateString() : ''}</span>
        </div>
        <span class="profile-history-score">${s.total_iq || 0} IQ</span>
      </div>
    `).join('')}</div>`;
  }

  // Helper: render the full profile page
  function renderProfile(data, awards, sessions) {
    const cumIQ = data.cumulative_iq || 0;
    const totalSessions = data.total_sessions || 0;
    const overallGrade = cumIQ > 0 && totalSessions > 0 ? (() => {
      const avg = cumIQ / totalSessions;
      if (avg >= 45) return 'A+';
      if (avg >= 40) return 'A';
      if (avg >= 35) return 'B+';
      if (avg >= 30) return 'B';
      if (avg >= 25) return 'C';
      return 'D';
    })() : '--';

    container.innerHTML = `
      <div class="review-header">
        <div class="logo">PLAY<span class="logo-accent">IQ</span></div>
        <div class="review-title">${data.display_name || 'Player'}</div>
        <div class="review-iq-score">${cumIQ} IQ</div>
        <div class="review-grade">${totalSessions} session${totalSessions !== 1 ? 's' : ''} played — Overall: ${overallGrade}</div>
      </div>
      <div class="profile-token-balance">
        <div class="profile-token-amount"><span class="token-coin">${TOKEN_COIN_SVG}</span> Token Balance: ${cumIQ}</div>
        <div class="profile-token-note">Tokens unlock rewards — coming soon</div>
      </div>
      <h3 class="profile-section-header">Category Mastery</h3>
      ${renderMasteryBars(data.categories)}
      <h3 class="profile-section-header">Awards</h3>
      ${renderAwards(awards)}
      <h3 class="profile-section-header">Recent Sessions</h3>
      ${renderSessionHistory(sessions)}
      <button class="btn-play-again">BACK TO GAME</button>
    `;

    container.querySelector('.btn-play-again').addEventListener('click', profileBackHandler);
  }

  function profileBackHandler() {
    const savedSport = localStorage.getItem('diamond_iq_sport');
    const savedTeam = localStorage.getItem('diamond_iq_team');
    const savedTier = localStorage.getItem('diamond_iq_tier');
    game.reset(); sessionTokens = 0;
    if (savedSport && savedTeam && savedTier) {
      const team = JSON.parse(savedTeam);
      const tier = getTiers().find(t => t.id === savedTier);
      if (team && tier) {
        game.selectSport(savedSport);
        game.selectTeam(team);
        setTeamColors(team);
        game.selectTier(savedTier);
        updatePlayerHeader();
        startGame(tier);
        return;
      }
    }
    showScreen('sportSelect');
  }

  if (isGuest) {
    // Guest mode — show session-local stats only
    const localHistory = game.getHistory().filter(h => h.outcome);
    const localCatMap = {};
    localHistory.forEach(h => {
      const cat = (h.outcome.category || 'general').toLowerCase();
      if (!localCatMap[cat]) localCatMap[cat] = { category: cat, total: 0, great: 0, good: 0, okay: 0, bad: 0 };
      localCatMap[cat].total++;
      localCatMap[cat][h.outcome.result] = (localCatMap[cat][h.outcome.result] || 0) + 1;
    });

    container.innerHTML = `
      <div class="review-header">
        <div class="logo">PLAY<span class="logo-accent">IQ</span></div>
        <div class="review-title">Guest Player</div>
        <div class="review-iq-score">${game.state.totalIQ} IQ</div>
        <div class="review-grade">This session only</div>
      </div>
      <div class="profile-guest-cta">
        <div class="profile-guest-cta-text">Create an account to save your progress, earn awards, and track your improvement over time.</div>
        <button class="profile-guest-cta-btn">Create Account to Save Progress</button>
      </div>
      <h3 class="profile-section-header">Session Stats</h3>
      ${renderMasteryBars(Object.values(localCatMap))}
      <button class="btn-play-again">BACK TO GAME</button>
    `;

    container.querySelector('.profile-guest-cta-btn')?.addEventListener('click', () => {
      game.reset(); sessionTokens = 0;
      showScreen('auth');
      bootAuth();
    });
    container.querySelector('.btn-play-again').addEventListener('click', profileBackHandler);
    return;
  }

  // Logged-in player — fetch data from API
  Promise.all([
    fetch(`/api/players/${player.id}`).then(r => r.ok ? r.json() : player),
    fetch(`/api/players/${player.id}/awards`).then(r => r.ok ? r.json() : []).catch(() => []),
    fetch(`/api/players/${player.id}/history`).then(r => r.ok ? r.json() : []).catch(() => []),
  ])
    .then(([data, awards, sessions]) => {
      renderProfile(data, awards, sessions);
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
    showScreen('sportSelect');
    if (player) {
      updatePlayerHeader();
    }
  });
}

// ---- Back Buttons ----
document.getElementById('back-to-sport').addEventListener('click', () => {
  showScreen('sportSelect');
});

document.getElementById('back-to-team').addEventListener('click', () => {
  const savedSport = localStorage.getItem('diamond_iq_sport');
  if (savedSport) {
    renderTeamGrid(savedSport);
  }
  showScreen('teamSelect');
});

async function boot() {
  initSportPicker();

  // Try auto-login
  const player = await playerAuth.autoLogin();
  if (player) {
    updatePlayerHeader();

    // Check for saved preferences — skip straight to game if we have them
    const savedSport = localStorage.getItem('diamond_iq_sport');
    const savedTeam = localStorage.getItem('diamond_iq_team');
    const savedTier = localStorage.getItem('diamond_iq_tier');

    if (savedSport && savedTeam && savedTier) {
      const team = JSON.parse(savedTeam);
      const tier = getTiers().find(t => t.id === savedTier);
      if (team && tier) {
        game.selectSport(savedSport);
        game.selectTeam(team);
        setTeamColors(team);
        game.selectTier(savedTier);
        startGame(tier);
        return;
      }
    }

    // No saved prefs — go to sport select
    showScreen('sportSelect');
  } else {
    showScreen('auth');
    bootAuth();
  }
}

boot();
