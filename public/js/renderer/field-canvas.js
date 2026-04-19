/**
 * Diamond IQ — Canvas-based overhead baseball diamond renderer
 */

import { lerp, easeOut, easeInOut, bezierPoint } from './animations.js';

/* ── Standard defensive position coordinates (normalized 0-1) ───────── */
const POSITIONS = {
  HOME:  { x: 0.50, y: 0.85 },
  '1B':  { x: 0.65, y: 0.55 },
  '2B':  { x: 0.60, y: 0.50 },
  SS:    { x: 0.40, y: 0.50 },
  '3B':  { x: 0.35, y: 0.55 },
  P:     { x: 0.50, y: 0.62 },
  C:     { x: 0.50, y: 0.90 },
  LF:    { x: 0.22, y: 0.30 },
  CF:    { x: 0.50, y: 0.25 },
  RF:    { x: 0.78, y: 0.30 },
  FIRST: { x: 0.70, y: 0.60 },
  SECOND:{ x: 0.50, y: 0.45 },
  THIRD: { x: 0.30, y: 0.60 },
};

export class FieldCanvas {
  /**
   * @param {HTMLCanvasElement} canvas
   */
  constructor(canvas) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._dpr = window.devicePixelRatio || 1;

    this._players = [];       // { pos, label, color }
    this._runners = [];       // { base, color }
    this._ball = null;        // { x, y }
    this._highlightPos = null;
    this._highlightAlpha = 0;
    this._teamColors = { primary: '#1a3c6e', secondary: '#c8102e' };
    this._animating = false;

    // Load field SVG as background image
    this._fieldImg = new Image();
    this._fieldImgReady = false;
    this._fieldImg.onload = () => {
      this._fieldImgReady = true;
      this._redraw();
    };
    this._fieldImg.src = '/assets/field.svg';

    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  /* ── Internal helpers ────────────────────────────────────────────── */

  _resize() {
    const rect = this._canvas.getBoundingClientRect();
    this._canvas.width = rect.width * this._dpr;
    this._canvas.height = rect.height * this._dpr;
    this._ctx.setTransform(this._dpr, 0, 0, this._dpr, 0, 0);
    this._w = rect.width;
    this._h = rect.height;
    this._redraw();
  }

  /** Convert normalized 0-1 coordinate to pixel */
  _px(nx, ny) {
    return { x: nx * this._w, y: ny * this._h };
  }

  _redraw() {
    this.drawField(this._teamColors);
    this._drawPlayers();
    this._drawRunners();
    this._drawBall();
  }

  /* ── Public API ──────────────────────────────────────────────────── */

  /**
   * Draw the full overhead field using the SVG background image.
   * @param {{ primary: string, secondary: string }} teamColors
   */
  drawField(teamColors = {}) {
    if (teamColors.primary) this._teamColors = teamColors;
    const ctx = this._ctx;
    const w = this._w;
    const h = this._h;

    ctx.clearRect(0, 0, w, h);

    if (this._fieldImgReady) {
      // Draw SVG background scaled to fill canvas
      ctx.drawImage(this._fieldImg, 0, 0, w, h);
      // Darken for night-game look that fits the dark UI theme
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.fillRect(0, 0, w, h);
    } else {
      // Fallback: dark green background while image loads
      ctx.fillStyle = '#0b1e0b';
      ctx.fillRect(0, 0, w, h);
    }
  }

  /**
   * Place player dots at defensive positions.
   * @param {Array<{ position: string, label: string, color?: string }>} positions
   */
  setPositions(positions) {
    this._players = positions.map(p => {
      const coord = POSITIONS[p.position] || POSITIONS[p.label] || { x: 0.5, y: 0.5 };
      return { ...coord, label: p.label || p.position, color: p.color || this._teamColors.primary };
    });
    this._redraw();
  }

  /**
   * Show runner dots on bases.
   * @param {Array<{ base: 'FIRST'|'SECOND'|'THIRD'|'HOME', color?: string }>} runners
   */
  setRunners(runners) {
    this._runners = runners.map(r => ({
      ...POSITIONS[r.base],
      color: r.color || '#FFD600',
    }));
    this._redraw();
  }

  /**
   * Show ball dot at a normalized position.
   * @param {{ x: number, y: number }} pos
   */
  setBallPosition(pos) {
    this._ball = pos ? { x: pos.x, y: pos.y } : null;
    this._redraw();
  }

  /**
   * Animate a sequence of steps. Returns a Promise that resolves when done.
   * Each step: { type, from, to, entity, duration, parallel }
   * @param {Array} animationSequence
   * @returns {Promise<void>}
   */
  async animate(animationSequence) {
    this._animating = true;
    let i = 0;
    while (i < animationSequence.length) {
      // Gather parallel group
      const group = [animationSequence[i]];
      while (i + 1 < animationSequence.length && animationSequence[i + 1].parallel) {
        i++;
        group.push(animationSequence[i]);
      }
      await Promise.all(group.map(step => this._animateStep(step)));
      i++;
    }
    this._animating = false;
  }

  /**
   * Pulse/glow highlight on a player position label.
   * @param {string} position — e.g. "SS", "CF"
   */
  highlightPlayer(position) {
    this._highlightPos = position;
    this._highlightAlpha = 0;
    let start = null;
    const duration = 1200;
    const tick = (ts) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      const t = Math.min(elapsed / duration, 1);
      this._highlightAlpha = Math.sin(t * Math.PI) * 0.8;
      this._redraw();
      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        this._highlightPos = null;
        this._highlightAlpha = 0;
        this._redraw();
      }
    };
    requestAnimationFrame(tick);
  }

  /** Clear everything and redraw just the field. */
  clear() {
    this._players = [];
    this._runners = [];
    this._ball = null;
    this._highlightPos = null;
    this._redraw();
  }

  _drawPlayers() {
    const ctx = this._ctx;
    const w = this._w;
    const dotR = Math.max(8, w * 0.016);

    this._players.forEach(p => {
      const { x, y } = this._px(p.x, p.y);

      // Highlight glow
      if (this._highlightPos && p.label === this._highlightPos && this._highlightAlpha > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, dotR * 2.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,215,0,${this._highlightAlpha * 0.45})`;
        ctx.fill();
        ctx.restore();
      }

      // Shadow
      ctx.beginPath();
      ctx.arc(x + 1.5, y + 1.5, dotR, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fill();

      // Player dot
      const dotGrad = ctx.createRadialGradient(x - dotR * 0.25, y - dotR * 0.25, dotR * 0.1, x, y, dotR);
      dotGrad.addColorStop(0, this._lighten(p.color, 40));
      dotGrad.addColorStop(1, p.color);
      ctx.beginPath();
      ctx.arc(x, y, dotR, 0, Math.PI * 2);
      ctx.fillStyle = dotGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Label
      ctx.fillStyle = '#ffffff';
      ctx.font = `bold ${Math.max(9, w * 0.018)}px -apple-system, "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.label, x, y);
    });
  }

  _drawRunners() {
    const ctx = this._ctx;
    const w = this._w;
    const dotR = Math.max(7, w * 0.013);

    this._runners.forEach(r => {
      const { x, y } = this._px(r.x, r.y);

      // Outer glow
      ctx.beginPath();
      ctx.arc(x, y, dotR * 1.8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,214,0,0.2)';
      ctx.fill();

      // Runner dot
      ctx.beginPath();
      ctx.arc(x, y, dotR, 0, Math.PI * 2);
      ctx.fillStyle = r.color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }

  _drawBall() {
    if (!this._ball) return;
    const ctx = this._ctx;
    const w = this._w;
    const { x, y } = this._px(this._ball.x, this._ball.y);
    const r = Math.max(4, w * 0.008);

    // Shadow
    ctx.beginPath();
    ctx.arc(x + 2, y + 2, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();

    // Ball
    const ballGrad = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    ballGrad.addColorStop(0, '#ffffff');
    ballGrad.addColorStop(1, '#e0d8cc');
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = ballGrad;
    ctx.fill();

    // Seam hint
    ctx.strokeStyle = '#cc3333';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.55, -0.3, 1.2);
    ctx.stroke();
  }

  /* ── Animation engine ────────────────────────────────────────────── */

  _animateStep(step) {
    return new Promise(resolve => {
      const duration = step.duration || 500;
      const from = step.from;
      const to = step.to;
      const easeFn = (step.type === 'throw' || step.type === 'catch')
        ? easeOut
        : easeInOut;

      // Compute bezier control point for throws (arc upward)
      let controlPt = null;
      if (step.type === 'throw') {
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;
        const dist = Math.hypot(to.x - from.x, to.y - from.y);
        controlPt = { x: midX, y: midY - dist * 0.15 };
      }

      let startTime = null;
      const tick = (ts) => {
        if (!startTime) startTime = ts;
        const elapsed = ts - startTime;
        const rawT = Math.min(elapsed / duration, 1);
        const t = easeFn(rawT);

        let pos;
        if (controlPt) {
          pos = bezierPoint(t, from, controlPt, to);
        } else {
          pos = { x: lerp(from.x, to.x, t), y: lerp(from.y, to.y, t) };
        }

        // Update the relevant entity
        if (step.entity === 'ball') {
          this._ball = pos;
        }

        this._redraw();

        if (rawT < 1) {
          requestAnimationFrame(tick);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(tick);
    });
  }

  /* ── Color utilities ─────────────────────────────────────────────── */

  _lighten(hex, amount) {
    const { r, g, b } = this._hexToRgb(hex);
    return `rgb(${Math.min(255, r + amount)},${Math.min(255, g + amount)},${Math.min(255, b + amount)})`;
  }

  _hexToRgb(hex) {
    if (!hex || hex[0] !== '#') return { r: 50, g: 50, b: 120 };
    const n = parseInt(hex.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
}
