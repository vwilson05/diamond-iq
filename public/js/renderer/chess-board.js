/**
 * PlayIQ — Chess Board Canvas Renderer
 * Draws an 8x8 board with pieces from FEN notation, coordinate labels, and highlights.
 */

const PIECE_CHARS = {
  K: '\u2654', Q: '\u2655', R: '\u2656', B: '\u2657', N: '\u2658', P: '\u2659',
  k: '\u265A', q: '\u265B', r: '\u265C', b: '\u265D', n: '\u265E', p: '\u265F',
};

const LIGHT_SQ = '#F0D9B5';
const DARK_SQ = '#B58863';
const HIGHLIGHT_SQ = 'rgba(168, 85, 247, 0.4)';
const LABEL_BG = '#1a1a2e';
const LABEL_COLOR = '#8899aa';
const MARGIN = 24; // px for coordinate labels

export class ChessBoard {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.pieces = [];
    this.highlights = [];
    this._resize();
    window.addEventListener('resize', () => this._resize());
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const maxSize = Math.min(rect.width, rect.height, 500);
    const totalSize = maxSize;
    this.canvas.width = totalSize * dpr;
    this.canvas.height = totalSize * dpr;
    this.canvas.style.width = totalSize + 'px';
    this.canvas.style.height = totalSize + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.totalSize = totalSize;
    this.boardSize = totalSize - MARGIN;
    this.sqSize = this.boardSize / 8;
    this.offsetX = MARGIN;
    this.offsetY = 0;
    this.draw();
  }

  /**
   * Parse FEN string to piece array.
   */
  setPosition(fen) {
    this.pieces = [];
    if (!fen) return;
    const ranks = fen.split(' ')[0].split('/');
    for (let rank = 0; rank < 8; rank++) {
      let file = 0;
      for (const ch of ranks[rank]) {
        if (ch >= '1' && ch <= '8') {
          file += parseInt(ch);
        } else {
          this.pieces.push({ piece: ch, file, rank });
          file++;
        }
      }
    }
    this.draw();
  }

  /**
   * Highlight squares (e.g. for last move).
   */
  setHighlights(squares) {
    this.highlights = (squares || []).map(sq => ({
      file: sq.charCodeAt(0) - 97,
      rank: 8 - parseInt(sq[1]),
    }));
    this.draw();
  }

  draw() {
    const { ctx, totalSize, boardSize, sqSize, offsetX, offsetY } = this;
    if (!totalSize) return;

    // Clear
    ctx.fillStyle = LABEL_BG;
    ctx.fillRect(0, 0, totalSize, totalSize);

    // Draw board squares
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        ctx.fillStyle = (r + f) % 2 === 0 ? LIGHT_SQ : DARK_SQ;
        ctx.fillRect(offsetX + f * sqSize, offsetY + r * sqSize, sqSize, sqSize);
      }
    }

    // Highlights
    for (const h of this.highlights) {
      ctx.fillStyle = HIGHLIGHT_SQ;
      ctx.fillRect(offsetX + h.file * sqSize, offsetY + h.rank * sqSize, sqSize, sqSize);
    }

    // File labels (a-h) along bottom
    ctx.font = `bold ${Math.max(11, sqSize * 0.22)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = LABEL_COLOR;
    for (let f = 0; f < 8; f++) {
      ctx.fillText(
        String.fromCharCode(97 + f),
        offsetX + f * sqSize + sqSize / 2,
        offsetY + boardSize + 4
      );
    }

    // Rank labels (1-8) along left side
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let r = 0; r < 8; r++) {
      ctx.fillText(
        String(8 - r),
        MARGIN / 2,
        offsetY + r * sqSize + sqSize / 2
      );
    }

    // Pieces
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const pieceSize = sqSize * 0.78;
    ctx.font = `${pieceSize}px serif`;

    for (const p of this.pieces) {
      const x = offsetX + p.file * sqSize + sqSize / 2;
      const y = offsetY + p.rank * sqSize + sqSize / 2;
      const ch = PIECE_CHARS[p.piece];
      if (!ch) continue;

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillText(ch, x + 1, y + 1);

      // Piece color
      if (p.piece === p.piece.toUpperCase()) {
        // White piece
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(ch, x, y);
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 0.5;
        ctx.strokeText(ch, x, y);
      } else {
        // Black piece
        ctx.fillStyle = '#1a1a2e';
        ctx.fillText(ch, x, y);
      }
    }
  }

  /**
   * Animate a piece move.
   */
  animateMove(from, to, durationMs = 500) {
    return new Promise(resolve => {
      const fromFile = from.charCodeAt(0) - 97;
      const fromRank = 8 - parseInt(from[1]);
      const toFile = to.charCodeAt(0) - 97;
      const toRank = 8 - parseInt(to[1]);

      const piece = this.pieces.find(p =>
        Math.round(p.file) === fromFile && Math.round(p.rank) === fromRank
      );
      if (!piece) { resolve(); return; }

      // Remove captured piece at destination
      this.pieces = this.pieces.filter(p =>
        !(Math.round(p.file) === toFile && Math.round(p.rank) === toRank && p !== piece)
      );

      const startTime = performance.now();
      const startFile = piece.file;
      const startRank = piece.rank;

      const step = (now) => {
        const elapsed = now - startTime;
        const t = Math.min(elapsed / durationMs, 1);
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

        piece.file = startFile + (toFile - startFile) * ease;
        piece.rank = startRank + (toRank - startRank) * ease;
        this.draw();

        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          piece.file = toFile;
          piece.rank = toRank;
          this.draw();
          resolve();
        }
      };

      requestAnimationFrame(step);
    });
  }
}
