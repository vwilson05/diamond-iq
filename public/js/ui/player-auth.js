/**
 * Diamond IQ — Player Auth UI
 * Login/signup for players. Stores player_id in localStorage.
 * Supports guest mode (skip login).
 */

const AVATARS = [
  { key: 'slugger', emoji: '\u26BE', label: 'Slugger' },
  { key: 'rocket', emoji: '\uD83D\uDE80', label: 'Rocket Arm' },
  { key: 'glove', emoji: '\uD83E\uDD4E', label: 'Gold Glove' },
  { key: 'lightning', emoji: '\u26A1', label: 'Speed Demon' },
  { key: 'fire', emoji: '\uD83D\uDD25', label: 'On Fire' },
  { key: 'star', emoji: '\u2B50', label: 'All-Star' },
  { key: 'diamond', emoji: '\uD83D\uDC8E', label: 'Diamond' },
  { key: 'trophy', emoji: '\uD83C\uDFC6', label: 'Champ' },
];

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
        <h1 class="logo">DIAMOND <span class="logo-accent">IQ</span></h1>
        <p class="tagline">Think like a pro. Play like a pro.</p>
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
      btn.innerHTML = `<span class="avatar-emoji">${av.emoji}</span><span class="avatar-label">${av.label}</span>`;
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
