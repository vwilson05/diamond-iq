/**
 * PlayIQ — Player Auth UI
 * Login/signup for players. Stores player_id in localStorage.
 * Supports guest mode (skip login).
 */

// SVG icon definitions for avatars — no emojis, pure vector
const AVATAR_SVGS = {
  slugger: `<svg viewBox="0 0 32 32" fill="none"><rect x="14" y="2" width="4" height="24" rx="2" fill="currentColor"/><rect x="12" y="24" width="8" height="4" rx="1" fill="currentColor" opacity="0.7"/><circle cx="16" cy="4" r="2" fill="currentColor"/></svg>`,
  glove: `<svg viewBox="0 0 32 32" fill="none"><path d="M8 18c0-6 3-14 8-14s8 8 8 14c0 4-3 8-8 8s-8-4-8-8z" stroke="currentColor" stroke-width="2" fill="none"/><path d="M12 12c0-3 1.5-6 4-6s4 3 4 6" stroke="currentColor" stroke-width="1.5" fill="none"/><ellipse cx="16" cy="20" rx="5" ry="4" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`,
  cap: `<svg viewBox="0 0 32 32" fill="none"><path d="M6 18c0-6 4.5-10 10-10s10 4 10 10" stroke="currentColor" stroke-width="2" fill="none"/><rect x="4" y="17" width="24" height="4" rx="2" fill="currentColor"/><path d="M4 19h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><line x1="16" y1="8" x2="16" y2="14" stroke="currentColor" stroke-width="1.5"/></svg>`,
  diamond: `<svg viewBox="0 0 32 32" fill="none"><path d="M16 2L30 16L16 30L2 16Z" stroke="currentColor" stroke-width="2" fill="none"/><path d="M16 8L24 16L16 24L8 16Z" stroke="currentColor" stroke-width="1.5" fill="none" opacity="0.5"/></svg>`,
  homeplate: `<svg viewBox="0 0 32 32" fill="none"><path d="M8 6h16l0 12l-8 10l-8-10z" stroke="currentColor" stroke-width="2" fill="none"/></svg>`,
  ball: `<svg viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="12" stroke="currentColor" stroke-width="2" fill="none"/><path d="M10 6c2 3 2 7 0 10s-2 7 0 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M22 6c-2 3-2 7 0 10s2 7 0 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  trophy: `<svg viewBox="0 0 32 32" fill="none"><path d="M10 4h12v10c0 4-2.5 7-6 7s-6-3-6-7V4z" stroke="currentColor" stroke-width="2" fill="none"/><path d="M10 8H6c0 4 2 6 4 6" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M22 8h4c0 4-2 6-4 6" stroke="currentColor" stroke-width="1.5" fill="none"/><rect x="13" y="21" width="6" height="3" rx="1" fill="currentColor" opacity="0.6"/><rect x="11" y="24" width="10" height="3" rx="1" fill="currentColor"/></svg>`,
  star: `<svg viewBox="0 0 32 32" fill="none"><path d="M16 3l3.7 7.5L28 12l-6 5.8 1.4 8.2L16 22l-7.4 4 1.4-8.2L4 12l8.3-1.5z" stroke="currentColor" stroke-width="2" fill="none"/></svg>`,
};

const AVATARS = [
  { key: 'slugger', label: 'Slugger' },
  { key: 'glove', label: 'Gold Glove' },
  { key: 'cap', label: 'Cap' },
  { key: 'diamond', label: 'Diamond' },
  { key: 'homeplate', label: 'Home Plate' },
  { key: 'ball', label: 'Ball' },
  { key: 'trophy', label: 'Champ' },
  { key: 'star', label: 'All-Star' },
];

export { AVATAR_SVGS };

export class PlayerAuth {
  constructor() {
    this.player = null;
    this.onComplete = null;
  }

  /**
   * Check localStorage for existing player. Returns player or null.
   */
  async autoLogin() {
    const playerId = localStorage.getItem('diamond_iq_player_id');
    if (!playerId) return null;

    try {
      const res = await fetch(`/api/players/${playerId}`);
      if (!res.ok) {
        localStorage.removeItem('diamond_iq_player_id');
        return null;
      }
      this.player = await res.json();
      return this.player;
    } catch {
      return null;
    }
  }

  /**
   * Render the auth screen into a container.
   * @param {HTMLElement} container
   * @param {Function} onComplete - called with player object or null (guest)
   */
  render(container, onComplete) {
    this.onComplete = onComplete;
    container.innerHTML = '';

    const inner = document.createElement('div');
    inner.className = 'auth-screen';
    inner.innerHTML = `
      <div class="logo-header">
        <h1 class="logo">PLAY<span class="logo-accent">IQ</span></h1>
        <p class="tagline">Think the game. Play the game.</p>
      </div>

      <div class="auth-tabs">
        <button class="auth-tab active" data-tab="login">I Have an Account</button>
        <button class="auth-tab" data-tab="signup">I'm New</button>
      </div>

      <div class="auth-form-container">
        <!-- LOGIN -->
        <div class="auth-panel active" data-panel="login">
          <div class="auth-field">
            <label>Username</label>
            <input type="text" id="auth-login-username" placeholder="Enter your username" autocomplete="off" autocapitalize="off" />
          </div>
          <button class="auth-btn" id="auth-login-btn">Let's Play!</button>
          <div class="auth-error" id="auth-login-error"></div>
        </div>

        <!-- SIGNUP -->
        <div class="auth-panel" data-panel="signup">
          <div class="auth-field">
            <label>What's Your Name?</label>
            <input type="text" id="auth-signup-name" placeholder="Your name" autocomplete="off" />
          </div>
          <div class="auth-field">
            <label>Pick a Username</label>
            <input type="text" id="auth-signup-username" placeholder="Choose a username" autocomplete="off" autocapitalize="off" />
          </div>
          <div class="auth-field">
            <label>Pick Your Avatar</label>
            <div class="avatar-grid" id="auth-avatar-grid"></div>
          </div>
          <div class="auth-field">
            <label>Have a Team Code? <span class="auth-optional">(optional)</span></label>
            <input type="text" id="auth-signup-teamcode" placeholder="6-letter code from your coach" autocomplete="off" autocapitalize="characters" maxlength="6" />
          </div>
          <button class="auth-btn" id="auth-signup-btn">Create Account</button>
          <div class="auth-error" id="auth-signup-error"></div>
        </div>
      </div>

      <button class="auth-guest-btn" id="auth-guest-btn">Play as Guest</button>
    `;

    container.appendChild(inner);

    // Avatar grid
    this._selectedAvatar = 'slugger';
    const avatarGrid = inner.querySelector('#auth-avatar-grid');
    AVATARS.forEach(av => {
      const btn = document.createElement('button');
      btn.className = 'avatar-btn' + (av.key === 'slugger' ? ' selected' : '');
      btn.dataset.key = av.key;
      btn.innerHTML = `<span class="avatar-icon">${AVATAR_SVGS[av.key]}</span><span class="avatar-label">${av.label}</span>`;
      btn.addEventListener('click', () => {
        avatarGrid.querySelectorAll('.avatar-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this._selectedAvatar = av.key;
      });
      avatarGrid.appendChild(btn);
    });

    // Tab switching
    inner.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        inner.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        inner.querySelectorAll('.auth-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        inner.querySelector(`[data-panel="${tab.dataset.tab}"]`).classList.add('active');
      });
    });

    // Login
    inner.querySelector('#auth-login-btn').addEventListener('click', () => this._handleLogin(inner));
    inner.querySelector('#auth-login-username').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this._handleLogin(inner);
    });

    // Signup
    inner.querySelector('#auth-signup-btn').addEventListener('click', () => this._handleSignup(inner));

    // Guest
    inner.querySelector('#auth-guest-btn').addEventListener('click', () => {
      if (this.onComplete) this.onComplete(null);
    });
  }

  async _handleLogin(inner) {
    const username = inner.querySelector('#auth-login-username').value.trim();
    const errorEl = inner.querySelector('#auth-login-error');
    errorEl.textContent = '';

    if (!username) {
      errorEl.textContent = 'Enter your username';
      return;
    }

    try {
      const res = await fetch('/api/players/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });

      if (!res.ok) {
        const data = await res.json();
        errorEl.textContent = data.error || 'Player not found';
        return;
      }

      this.player = await res.json();
      localStorage.setItem('diamond_iq_player_id', this.player.id);
      if (this.onComplete) this.onComplete(this.player);
    } catch {
      errorEl.textContent = 'Connection error. Try again.';
    }
  }

  async _handleSignup(inner) {
    const display_name = inner.querySelector('#auth-signup-name').value.trim();
    const username = inner.querySelector('#auth-signup-username').value.trim();
    const teamCode = inner.querySelector('#auth-signup-teamcode').value.trim();
    const errorEl = inner.querySelector('#auth-signup-error');
    errorEl.textContent = '';

    if (!display_name) { errorEl.textContent = 'Enter your name'; return; }
    if (!username) { errorEl.textContent = 'Pick a username'; return; }
    if (username.length < 3) { errorEl.textContent = 'Username must be at least 3 characters'; return; }

    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          display_name,
          avatar: this._selectedAvatar,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        errorEl.textContent = data.error || 'Could not create account';
        return;
      }

      this.player = await res.json();
      localStorage.setItem('diamond_iq_player_id', this.player.id);

      // Join team if code provided
      if (teamCode) {
        try {
          await fetch(`/api/players/${this.player.id}/join-team`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ join_code: teamCode }),
          });
        } catch {
          // Non-fatal
        }
      }

      if (this.onComplete) this.onComplete(this.player);
    } catch {
      errorEl.textContent = 'Connection error. Try again.';
    }
  }

  /**
   * Get current player or null.
   */
  getPlayer() {
    return this.player;
  }

  /**
   * Logout
   */
  logout() {
    this.player = null;
    localStorage.removeItem('diamond_iq_player_id');
  }
}
