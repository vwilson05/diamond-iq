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
  LF:    { x: 0.25, y: 0.25 },
  CF:    { x: 0.50, y: 0.20 },
  RF:    { x: 0.75, y: 0.25 },
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
   * Draw the full overhead field.
   * @param {{ primary: string, secondary: string }} teamColors
   */
  drawField(teamColors = {}) {
    if (teamColors.primary) this._teamColors = teamColors;
    const ctx = this._ctx;
    const w = this._w;
    const h = this._h;

    ctx.clearRect(0, 0, w, h);

    // ── Sky / background
    ctx.fillStyle = '#0b1e0b';
    ctx.fillRect(0, 0, w, h);

    // ── Grass outfield — rich, subtly tinted with team primary
    const grassGrad = ctx.createRadialGradient(
      w * 0.5, h * 0.85, w * 0.05,
      w * 0.5, h * 0.5, w * 0.7
    );
    const teamTint = this._tintGreen(this._teamColors.primary, 0.08);
    grassGrad.addColorStop(0, '#2e7d32');
    grassGrad.addColorStop(0.4, teamTint);
    grassGrad.addColorStop(1, '#1b5e20');
    ctx.fillStyle = grassGrad;

    // Outfield arc shape
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.85, w * 0.72, Math.PI * 1.18, Math.PI * 1.82);
    ctx.lineTo(w * 0.5, h * 0.85);
    ctx.closePath();
    ctx.fill();

    // ── Mow lines (alternating light/dark stripes)
    this._drawMowLines(ctx, w, h);

    // ── Outfield warning track
    ctx.strokeStyle = '#5d4037';
    ctx.lineWidth = w * 0.018;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.85, w * 0.70, Math.PI * 1.19, Math.PI * 1.81);
    ctx.stroke();

    // ── Outfield wall/fence
    ctx.strokeStyle = '#1a3a1a';
    ctx.lineWidth = w * 0.012;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.85, w * 0.72, Math.PI * 1.18, Math.PI * 1.82);
    ctx.stroke();
    // Fence shadow
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = w * 0.006;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.85, w * 0.725, Math.PI * 1.18, Math.PI * 1.82);
    ctx.stroke();

    // ── Dirt infield (diamond)
    this._drawDirtInfield(ctx, w, h);

    // ── Base paths (white lines)
    this._drawBasePaths(ctx, w, h);

    // ── Foul lines extending to outfield
    this._drawFoulLines(ctx, w, h);

    // ── Pitcher's mound
    this._drawPitcherMound(ctx, w, h);

    // ── Bases
    this._drawBases(ctx, w, h);

    // ── Batter's boxes and home plate area
    this._drawHomePlateArea(ctx, w, h);

    // ── Coach's boxes
    this._drawCoachBoxes(ctx, w, h);

    // ── On-deck circles
    this._drawOnDeckCircles(ctx, w, h);
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

  /* ── Drawing subroutines ─────────────────────────────────────────── */

  _drawMowLines(ctx, w, h) {
    ctx.save();
    ctx.globalAlpha = 0.06;
    const center = this._px(0.5, 0.85);
    const stripeCount = 14;
    const maxR = w * 0.68;
    const stripeW = maxR / stripeCount;
    for (let i = 0; i < stripeCount; i += 2) {
      ctx.beginPath();
      ctx.arc(center.x, center.y, stripeW * (i + 1), Math.PI * 1.2, Math.PI * 1.8);
      ctx.arc(center.x, center.y, stripeW * i, Math.PI * 1.8, Math.PI * 1.2, true);
      ctx.closePath();
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    ctx.restore();
  }

  _drawDirtInfield(ctx, w, h) {
    const home = this._px(0.5, 0.85);
    const first = this._px(0.7, 0.6);
    const second = this._px(0.5, 0.45);
    const third = this._px(0.3, 0.6);

    // Dirt gradient
    const dirtGrad = ctx.createRadialGradient(
      home.x, second.y + (home.y - second.y) * 0.4, w * 0.02,
      home.x, second.y + (home.y - second.y) * 0.4, w * 0.32
    );
    dirtGrad.addColorStop(0, '#c9a96e');
    dirtGrad.addColorStop(0.6, '#b5915a');
    dirtGrad.addColorStop(1, '#8d6e43');

    // Infield dirt shape — slightly rounded diamond + expanded around bases
    ctx.beginPath();
    const pad = w * 0.06;
    ctx.moveTo(home.x, home.y + pad * 0.4);
    // Right side — toward first
    ctx.quadraticCurveTo(first.x + pad, first.y + pad * 0.3, first.x + pad * 0.5, first.y - pad * 0.5);
    // Top right — toward second
    ctx.quadraticCurveTo(first.x + pad * 0.2, second.y - pad * 0.3, second.x, second.y - pad);
    // Top left — toward third
    ctx.quadraticCurveTo(third.x - pad * 0.2, second.y - pad * 0.3, third.x - pad * 0.5, third.y - pad * 0.5);
    // Left side — toward home
    ctx.quadraticCurveTo(third.x - pad, third.y + pad * 0.3, home.x, home.y + pad * 0.4);
    ctx.closePath();
    ctx.fillStyle = dirtGrad;
    ctx.fill();

    // Grass cutout (infield grass circle)
    const cx = (home.x + second.x) / 2;
    const cy = (home.y + second.y) / 2 - h * 0.01;
    const grassR = w * 0.115;
    ctx.beginPath();
    ctx.arc(cx, cy, grassR, 0, Math.PI * 2);
    const innerGrass = ctx.createRadialGradient(cx, cy, 0, cx, cy, grassR);
    innerGrass.addColorStop(0, '#2e8b34');
    innerGrass.addColorStop(1, '#267a2e');
    ctx.fillStyle = innerGrass;
    ctx.fill();
  }

  _drawBasePaths(ctx, w, h) {
    const home = this._px(0.5, 0.85);
    const first = this._px(0.7, 0.6);
    const second = this._px(0.5, 0.45);
    const third = this._px(0.3, 0.6);

    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = Math.max(2, w * 0.004);
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.moveTo(home.x, home.y);
    ctx.lineTo(first.x, first.y);
    ctx.lineTo(second.x, second.y);
    ctx.lineTo(third.x, third.y);
    ctx.closePath();
    ctx.stroke();
  }

  _drawFoulLines(ctx, w, h) {
    const home = this._px(0.5, 0.85);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = Math.max(2, w * 0.003);

    // Left foul line — home to left-field corner
    const lfCorner = this._px(0.05, 0.13);
    ctx.beginPath();
    ctx.moveTo(home.x, home.y);
    ctx.lineTo(lfCorner.x, lfCorner.y);
    ctx.stroke();

    // Right foul line — home to right-field corner
    const rfCorner = this._px(0.95, 0.13);
    ctx.beginPath();
    ctx.moveTo(home.x, home.y);
    ctx.lineTo(rfCorner.x, rfCorner.y);
    ctx.stroke();
  }

  _drawPitcherMound(ctx, w, h) {
    const mound = this._px(0.5, 0.62);
    const moundR = w * 0.028;

    // Mound circle (raised dirt)
    const moundGrad = ctx.createRadialGradient(
      mound.x, mound.y - moundR * 0.15, moundR * 0.1,
      mound.x, mound.y, moundR
    );
    moundGrad.addColorStop(0, '#d4b07a');
    moundGrad.addColorStop(1, '#a07a4a');
    ctx.beginPath();
    ctx.arc(mound.x, mound.y, moundR, 0, Math.PI * 2);
    ctx.fillStyle = moundGrad;
    ctx.fill();

    // Pitching rubber (white rectangle)
    const rubberW = w * 0.018;
    const rubberH = w * 0.004;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(mound.x - rubberW / 2, mound.y - rubberH / 2, rubberW, rubberH);
  }

  _drawBases(ctx, w, h) {
    const baseSize = w * 0.016;
    const bases = [
      { pos: this._px(0.7, 0.6), name: '1st' },
      { pos: this._px(0.5, 0.45), name: '2nd' },
      { pos: this._px(0.3, 0.6), name: '3rd' },
    ];

    bases.forEach(b => {
      ctx.save();
      ctx.translate(b.pos.x, b.pos.y);
      ctx.rotate(Math.PI / 4);
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(-baseSize / 2 + 2, -baseSize / 2 + 2, baseSize, baseSize);
      // Base
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-baseSize / 2, -baseSize / 2, baseSize, baseSize);
      ctx.restore();
    });
  }

  _drawHomePlateArea(ctx, w, h) {
    const home = this._px(0.5, 0.85);
    const plateW = w * 0.018;

    // Home plate (pentagon)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(home.x, home.y + plateW * 0.6);            // bottom point
    ctx.lineTo(home.x - plateW * 0.5, home.y + plateW * 0.15);
    ctx.lineTo(home.x - plateW * 0.5, home.y - plateW * 0.35);
    ctx.lineTo(home.x + plateW * 0.5, home.y - plateW * 0.35);
    ctx.lineTo(home.x + plateW * 0.5, home.y + plateW * 0.15);
    ctx.closePath();
    ctx.fill();

    // Batter's boxes (left and right)
    const boxW = w * 0.025;
    const boxH = w * 0.05;
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = Math.max(1, w * 0.002);
    // Left box
    ctx.strokeRect(home.x - plateW * 0.5 - boxW - w * 0.006, home.y - boxH / 2, boxW, boxH);
    // Right box
    ctx.strokeRect(home.x + plateW * 0.5 + w * 0.006, home.y - boxH / 2, boxW, boxH);

    // Catcher's box
    const catchBoxW = w * 0.04;
    const catchBoxH = w * 0.035;
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.strokeRect(home.x - catchBoxW / 2, home.y + plateW * 0.7, catchBoxW, catchBoxH);

    // Dirt circle around home
    ctx.beginPath();
    ctx.arc(home.x, home.y, w * 0.055, 0, Math.PI * 2);
    const homeDirt = ctx.createRadialGradient(home.x, home.y, 0, home.x, home.y, w * 0.055);
    homeDirt.addColorStop(0, 'rgba(185,150,100,0.4)');
    homeDirt.addColorStop(1, 'rgba(185,150,100,0)');
    ctx.fillStyle = homeDirt;
    ctx.fill();
  }

  _drawCoachBoxes(ctx, w, h) {
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = Math.max(1, w * 0.002);
    const boxW = w * 0.03;
    const boxH = w * 0.045;

    // First base coach box
    ctx.strokeRect(w * 0.74, h * 0.68, boxW, boxH);
    // Third base coach box
    ctx.strokeRect(w * 0.23, h * 0.68, boxW, boxH);
  }

  _drawOnDeckCircles(ctx, w, h) {
    const circleR = w * 0.014;
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = Math.max(1, w * 0.002);

    // Left on-deck
    ctx.beginPath();
    ctx.arc(w * 0.35, h * 0.92, circleR, 0, Math.PI * 2);
    ctx.stroke();

    // Right on-deck
    ctx.beginPath();
    ctx.arc(w * 0.65, h * 0.92, circleR, 0, Math.PI * 2);
    ctx.stroke();
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

  _tintGreen(hex, amount) {
    const { r, g, b } = this._hexToRgb(hex);
    const gr = Math.round(lerp(46, r, amount));
    const gg = Math.round(lerp(125, g, amount));
    const gb = Math.round(lerp(50, b, amount));
    return `rgb(${gr},${gg},${gb})`;
  }

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
