/**
 * Diamond IQ — Central State Machine
 * Manages game phases, scenario progression, and decision history.
 */

const PHASES = [
  'team-select',
  'difficulty-select',
  'sport-select',
  'playing',
  'outcome',
  'review',
];

const INITIAL_STATE = {
  phase: 'team-select',
  team: null,
  tier: null,
  sport: null,
  currentScenario: null,
  currentNode: null,
  situation: null,
  history: [],
  totalIQ: 0,
  scenariosCompleted: 0,
};

export class GameState {
  constructor() {
    /** @type {Record<string, Function[]>} */
    this._listeners = {};
    this._state = { ...INITIAL_STATE, history: [] };
  }

  // ---------------------------------------------------------------------------
  // Event bus
  // ---------------------------------------------------------------------------

  /**
   * Subscribe to a named event.
   * @param {string} event
   * @param {Function} callback
   * @returns {Function} unsubscribe handle
   */
  on(event, callback) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(callback);
    return () => {
      this._listeners[event] = this._listeners[event].filter(
        (cb) => cb !== callback
      );
    };
  }

  /**
   * Emit a named event to all subscribers.
   * @param {string} event
   * @param {*} data
   */
  emit(event, data) {
    const cbs = this._listeners[event];
    if (cbs) {
      for (const cb of cbs) {
        try {
          cb(data);
        } catch (err) {
          console.error(`[GameState] listener error on "${event}":`, err);
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Read helpers
  // ---------------------------------------------------------------------------

  get state() {
    return this._state;
  }

  get phase() {
    return this._state.phase;
  }

  // ---------------------------------------------------------------------------
  // Setup transitions
  // ---------------------------------------------------------------------------

  /**
   * Select an MLB team and move to difficulty selection.
   * @param {{ code: string, city: string, name: string, primaryColor: string, secondaryColor: string }} team
   */
  selectTeam(team) {
    this._state.team = team;
    this._state.phase = 'difficulty-select';
    this.emit('phase', this._state);
    this.emit('team-selected', team);
  }

  /**
   * Select a difficulty tier and move to sport selection.
   * @param {string} tier — one of "tball", "rookie", "minors", "majors", "the-show"
   */
  selectTier(tier) {
    this._state.tier = tier;
    this._state.phase = 'sport-select';
    this.emit('phase', this._state);
    this.emit('tier-selected', tier);
  }

  /**
   * Select baseball or softball and begin playing.
   * @param {"baseball"|"softball"} sport
   */
  selectSport(sport) {
    this._state.sport = sport;
    this._state.phase = 'playing';
    this.emit('phase', this._state);
    this.emit('sport-selected', sport);
  }

  // ---------------------------------------------------------------------------
  // Scenario progression
  // ---------------------------------------------------------------------------

  /**
   * Load a scenario tree into state.
   * A scenario has the shape:
   *   { id, title, situation, nodes: { [nodeId]: { narration, choices, outcome } }, startNode }
   * Each node.choices is an array of { id, text, nextNode }
   * Leaf nodes have an outcome: { headline, explanation, remember, iqPoints, grade }
   * @param {object} scenario
   */
  loadScenario(scenario) {
    this._state.currentScenario = scenario;
    this._state.situation = scenario.situation || scenario.title;
    this._state.currentNode = scenario.startNode || 'start';
    this._state.phase = 'playing';
    this.emit('scenario-loaded', scenario);
    this.emit('phase', this._state);
    this.emit('node', this._getCurrentNode());
  }

  /**
   * Advance directly to a specific node ID within the current scenario.
   * @param {string} nodeId
   */
  advanceToNode(nodeId) {
    if (!this._state.currentScenario) {
      throw new Error('No scenario loaded');
    }
    const node = this._state.currentScenario.nodes[nodeId];
    if (!node) {
      throw new Error(`Node "${nodeId}" not found in scenario`);
    }
    this._state.currentNode = nodeId;
    this.emit('node', node);

    // If this node is a leaf (has outcome, no choices) transition to outcome phase
    if (node.outcome && (!node.choices || node.choices.length === 0)) {
      this._state.phase = 'outcome';
      this.emit('phase', this._state);
      this.emit('outcome', node.outcome);
    }
  }

  /**
   * Record a player's choice, then advance to the next node.
   * @param {string} choiceId
   */
  makeChoice(choiceId) {
    const node = this._getCurrentNode();
    if (!node || !node.choices) {
      throw new Error('Current node has no choices');
    }

    const choice = node.choices.find((c) => c.id === choiceId);
    if (!choice) {
      throw new Error(`Choice "${choiceId}" not found`);
    }

    // Record this decision
    this._state.history.push({
      scenarioId: this._state.currentScenario.id,
      situation: this._state.situation,
      nodeId: this._state.currentNode,
      narration: node.narration,
      choiceId: choice.id,
      choiceText: choice.text,
      timestamp: Date.now(),
    });

    this.emit('choice-made', { node, choice });

    // Advance
    if (choice.nextNode) {
      this.advanceToNode(choice.nextNode);
    }
  }

  /**
   * Record the final outcome after a scenario completes.
   * @param {{ headline: string, explanation: string, remember: string, iqPoints: number, grade: string }} outcome
   */
  recordOutcome(outcome) {
    // Attach outcome to the most recent history entry
    const lastEntry = this._state.history[this._state.history.length - 1];
    if (lastEntry) {
      lastEntry.outcome = outcome;
    }

    this._state.totalIQ += outcome.iqPoints || 0;
    this._state.scenariosCompleted += 1;
    this.emit('outcome-recorded', {
      outcome,
      totalIQ: this._state.totalIQ,
      scenariosCompleted: this._state.scenariosCompleted,
    });
  }

  /**
   * Return full decision history.
   * @returns {Array}
   */
  getHistory() {
    return [...this._state.history];
  }

  /**
   * Transition to review phase.
   */
  startReview() {
    this._state.phase = 'review';
    this.emit('phase', this._state);
  }

  /**
   * Full reset back to team select.
   */
  reset() {
    this._state = { ...INITIAL_STATE, history: [] };
    this._listeners = {};
    this.emit('reset', this._state);
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  _getCurrentNode() {
    if (!this._state.currentScenario || !this._state.currentNode) return null;
    return this._state.currentScenario.nodes[this._state.currentNode] || null;
  }
}
