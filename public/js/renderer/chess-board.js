/**
 * PlayIQ — Chess Board Canvas Renderer
 * Draws an 8x8 board with pieces from FEN notation.
 */

const PIECE_CHARS = {
  K: '\u2654', Q: '\u2655', R: '\u2656', B: '\u2657', N: '\u2658', P: '\u2659',
  k: '\u265A', q: '\u265B', r: '\u265C', b: '\u265D', n: '\u265E', p: '\u265F',
};

const LIGHT_SQ = '#F0D9B5';
const DARK_SQ = '#B58863';
const HIGHLIGHT_SQ = 'rgba(168, 85, 247, 0.4)';

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
    const size = Math.min(rect.width, rect.height, 500);
    this.canvas.width = size * dpr;
    this.canvas.height = size * dpr;
    this.canvas.style.width = size + 'px';
    this.canvas.style.height = size + 'px';
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.size = size;
    this.sqSize = size / 8;
    this.draw();
  }

  /**
   * Parse FEN string to piece array.
   * @param {string} fen - e.g. "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR"
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
   * Highlight squares (e.g. for last move, best move hints).
   * @param {Array<string>} squares - e.g. ["e2", "e4"]
   */
  setHighlights(squares) {
    this.highlights = (squares || []).map(sq => ({
      file: sq.charCodeAt(0) - 97,
      rank: 8 - parseInt(sq[1]),
    }));
    this.draw();
  }

  draw() {
    const { ctx, size, sqSize } = this;
    if (!size) return;

    // Board background
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, size, size);

    // Squares
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        ctx.fillStyle = (r + f) % 2 === 0 ? LIGHT_SQ : DARK_SQ;
        ctx.fillRect(f * sqSize, r * sqSize, sqSize, sqSize);
      }
    }

    // Highlights
    for (const h of this.highlights) {
      ctx.fillStyle = HIGHLIGHT_SQ;
      ctx.fillRect(h.file * sqSize, h.rank * sqSize, sqSize, sqSize);
    }

    // Coordinate labels
    ctx.font = `${sqSize * 0.18}px sans-serif`;
    for (let f = 0; f < 8; f++) {
      ctx.fillStyle = f % 2 === 0 ? DARK_SQ : LIGHT_SQ;
      ctx.textAlign = 'left';
      ctx.fillText(String.fromCharCode(97 + f), f * sqSize + 2, size - 2);
    }
    for (let r = 0; r < 8; r++) {
      ctx.fillStyle = r % 2 === 0 ? DARK_SQ : LIGHT_SQ;
      ctx.textAlign = 'right';
      ctx.fillText(String(8 - r), size - 2, r * sqSize + sqSize * 0.22);
    }

    // Pieces
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const pieceSize = sqSize * 0.75;
    ctx.font = `${pieceSize}px serif`;

    for (const p of this.pieces) {
      const x = p.file * sqSize + sqSize / 2;
      const y = p.rank * sqSize + sqSize / 2;
      const ch = PIECE_CHARS[p.piece];
      if (!ch) continue;

      // Shadow for readability
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillText(ch, x + 1, y + 1);

      // Piece
      ctx.fillStyle = p.piece === p.piece.toUpperCase() ? '#FFFFFF' : '#1a1a2e';
      ctx.fillText(ch, x, y);

      // Outline for white pieces on light squares
      if (p.piece === p.piece.toUpperCase()) {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 0.5;
        ctx.strokeText(ch, x, y);
      }
    }
  }

  /**
   * Animate a piece move.
   * @param {string} from - e.g. "e2"
   * @param {string} to - e.g. "e4"
   * @param {number} durationMs
   * @returns {Promise<void>}
   */
  animateMove(from, to, durationMs = 500) {
    return new Promise(resolve => {
      const fromFile = from.charCodeAt(0) - 97;
      const fromRank = 8 - parseInt(from[1]);
      const toFile = to.charCodeAt(0) - 97;
      const toRank = 8 - parseInt(to[1]);

      const piece = this.pieces.find(p => p.file === fromFile && p.rank === fromRank);
      if (!piece) { resolve(); return; }

      // Remove captured piece at destination
      this.pieces = this.pieces.filter(p => !(p.file === toFile && p.rank === toRank));

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
