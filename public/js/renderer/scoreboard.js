/**
 * PlayIQ — Fenway Park Green Monster style scoreboard
 */

export class Scoreboard {
  /**
   * @param {HTMLElement} container — DOM element to render into
   */
  constructor(container) {
    this._container = container;
    this._el = null;
    this._state = null;
    this._buildStructure();
  }

  /**
   * Update the scoreboard from game state.
   * @param {{
   *   away: { abbr: string, color: string, innings: number[], runs: number, hits: number, errors: number },
   *   home: { abbr: string, color: string, innings: number[], runs: number, hits: number, errors: number },
   *   currentInning: number,
   *   isTop: boolean,
   *   outs: number,
   *   balls: number,
   *   strikes: number,
   * }} gameState
   */
  update(gameState) {
    this._state = gameState;
    this._render();
  }

  /* ── Build DOM skeleton ──────────────────────────────────────────── */

  _buildStructure() {
    this._el = document.createElement('div');
    this._el.className = 'diq-scoreboard';
    this._injectStyles();
    this._container.appendChild(this._el);
  }

  _injectStyles() {
    if (document.getElementById('diq-scoreboard-styles')) return;
    const style = document.createElement('style');
    style.id = 'diq-scoreboard-styles';
    style.textContent = `
      .diq-scoreboard {
        background: linear-gradient(180deg, #2D5F2D 0%, #1E4A1E 100%);
        border: 3px solid #1a3a1a;
        border-radius: 6px;
        padding: 12px 16px;
        font-family: 'Courier New', Courier, monospace;
        color: #E8D5A3;
        box-shadow:
          inset 0 1px 0 rgba(255,255,255,0.08),
          0 4px 16px rgba(0,0,0,0.5);
        user-select: none;
        min-width: 360px;
      }

      .diq-sb-header {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 8px;
        font-size: 10px;
        letter-spacing: 2px;
        text-transform: uppercase;
        color: #a09070;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        padding-bottom: 6px;
      }

      .diq-sb-grid {
        display: grid;
        gap: 0;
        width: 100%;
      }

      .diq-sb-row {
        display: flex;
        align-items: center;
        gap: 0;
        height: 28px;
      }

      .diq-sb-row.header-row {
        height: 22px;
        font-size: 10px;
        color: #8a7a5a;
        letter-spacing: 1px;
      }

      .diq-sb-cell {
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 24px;
        height: 100%;
        font-size: 14px;
        font-weight: bold;
        border-right: 1px solid rgba(255,255,255,0.06);
        box-sizing: border-box;
      }

      .diq-sb-cell.team {
        min-width: 48px;
        justify-content: flex-start;
        padding-left: 6px;
        font-size: 13px;
        letter-spacing: 1.5px;
        font-weight: 900;
        border-right: 2px solid rgba(255,255,255,0.1);
      }

      .diq-sb-cell.rhe {
        min-width: 28px;
        font-size: 15px;
        color: #FFE8A0;
      }

      .diq-sb-cell.rhe-header {
        font-size: 10px;
        color: #c0a868;
      }

      .diq-sb-cell.sep {
        border-left: 2px solid rgba(255,255,255,0.12);
      }

      .diq-sb-cell.active {
        background: rgba(255,255,255,0.06);
      }

      .diq-sb-cell.score-flash {
        color: #FFD700;
        text-shadow: 0 0 6px rgba(255,215,0,0.5);
      }

      .diq-sb-row.away-row {
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }

      /* ── Count & Outs ───────────────── */

      .diq-sb-status {
        display: flex;
        align-items: center;
        gap: 20px;
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px solid rgba(255,255,255,0.08);
        font-size: 12px;
        letter-spacing: 1px;
      }

      .diq-sb-status-group {
        display: flex;
        align-items: center;
        gap: 5px;
      }

      .diq-sb-status-label {
        color: #8a7a5a;
        font-size: 10px;
        text-transform: uppercase;
        margin-right: 4px;
      }

      .diq-sb-dot {
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 1.5px solid #8a7a5a;
        background: transparent;
        transition: background 0.2s, box-shadow 0.2s;
      }

      .diq-sb-dot.lit {
        background: #FFD700;
        border-color: #FFD700;
        box-shadow: 0 0 4px rgba(255,215,0,0.6);
      }

      .diq-sb-dot.out-lit {
        background: #E84040;
        border-color: #E84040;
        box-shadow: 0 0 4px rgba(232,64,64,0.6);
      }

      .diq-sb-inning-indicator {
        display: flex;
        align-items: center;
        gap: 4px;
        color: #E8D5A3;
        font-size: 13px;
        font-weight: bold;
      }

      .diq-sb-arrow {
        font-size: 8px;
        line-height: 1;
      }

      .diq-sb-team-color {
        width: 4px;
        height: 16px;
        border-radius: 1px;
        margin-right: 4px;
        flex-shrink: 0;
      }
    `;
    document.head.appendChild(style);
  }

  /* ── Render ──────────────────────────────────────────────────────── */

  _render() {
    const s = this._state;
    if (!s) return;

    const maxInnings = Math.max(9, s.away.innings.length, s.home.innings.length);

    let html = '';

    // Header
    html += `<div class="diq-sb-header">
      <span>PlayIQ</span>
      <span style="margin-left:auto;">
        <span class="diq-sb-inning-indicator">
          <span class="diq-sb-arrow">${s.isTop ? '\u25B2' : '\u25BC'}</span>
          ${this._ordinal(s.currentInning)}
        </span>
      </span>
    </div>`;

    // Grid: header row + away + home
    html += '<div class="diq-sb-grid">';

    // Column header
    html += '<div class="diq-sb-row header-row">';
    html += '<div class="diq-sb-cell team"></div>';
    for (let i = 1; i <= maxInnings; i++) {
      const active = i === s.currentInning ? ' active' : '';
      html += `<div class="diq-sb-cell${active}">${i}</div>`;
    }
    html += '<div class="diq-sb-cell rhe-header sep">R</div>';
    html += '<div class="diq-sb-cell rhe-header">H</div>';
    html += '<div class="diq-sb-cell rhe-header">E</div>';
    html += '</div>';

    // Away row
    html += this._teamRow(s.away, maxInnings, s.currentInning, true, s.isTop);

    // Home row
    html += this._teamRow(s.home, maxInnings, s.currentInning, false, !s.isTop);

    html += '</div>';

    // Count & outs
    html += `<div class="diq-sb-status">
      ${this._countDots('B', s.balls, 4)}
      ${this._countDots('S', s.strikes, 3)}
      ${this._outsDots(s.outs)}
    </div>`;

    this._el.innerHTML = html;
  }

  _teamRow(team, maxInnings, currentInning, isAway, isBatting) {
    let row = `<div class="diq-sb-row ${isAway ? 'away-row' : 'home-row'}">`;
    row += `<div class="diq-sb-cell team">
      <span class="diq-sb-team-color" style="background:${team.color}"></span>
      ${team.abbr}
    </div>`;
    for (let i = 0; i < maxInnings; i++) {
      const active = (i + 1) === currentInning ? ' active' : '';
      const val = team.innings[i] !== undefined ? team.innings[i] : '';
      const flash = val !== '' && val > 0 && (i + 1) === currentInning ? ' score-flash' : '';
      row += `<div class="diq-sb-cell${active}${flash}">${val}</div>`;
    }
    row += `<div class="diq-sb-cell rhe sep">${team.runs}</div>`;
    row += `<div class="diq-sb-cell rhe">${team.hits}</div>`;
    row += `<div class="diq-sb-cell rhe">${team.errors}</div>`;
    row += '</div>';
    return row;
  }

  _countDots(label, count, max) {
    let html = `<div class="diq-sb-status-group">
      <span class="diq-sb-status-label">${label}</span>`;
    for (let i = 0; i < max; i++) {
      html += `<span class="diq-sb-dot${i < count ? ' lit' : ''}"></span>`;
    }
    html += '</div>';
    return html;
  }

  _outsDots(outs) {
    let html = `<div class="diq-sb-status-group">
      <span class="diq-sb-status-label">OUT</span>`;
    for (let i = 0; i < 3; i++) {
      html += `<span class="diq-sb-dot${i < outs ? ' out-lit' : ''}"></span>`;
    }
    html += '</div>';
    return html;
  }

  _ordinal(n) {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }
}
