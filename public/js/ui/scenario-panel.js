/**
 * Diamond IQ — Scenario Panel UI
 * Displays narration with typewriter effect, choice buttons, and outcome cards.
 */

export class ScenarioPanel {
  /**
   * @param {HTMLElement} container — DOM element to render into
   * @param {{ primaryColor: string, secondaryColor: string }} team — selected team colors
   */
  constructor(container, team) {
    this.container = container;
    this.team = team || { primaryColor: '#003087', secondaryColor: '#FFFFFF' };
    this._typewriterTimer = null;
    this._injectStyles();
  }

  _injectStyles() {
    if (document.getElementById('sp-styles')) return;
    const style = document.createElement('style');
    style.id = 'sp-styles';
    style.textContent = `
      .sp-narration {
        font-size: 1.15rem;
        line-height: 1.7;
        color: #1a1a2e;
        margin-bottom: 1.5rem;
        min-height: 3em;
        padding: 0 8px;
      }
      .sp-narration .sp-cursor {
        display: inline-block;
        width: 2px;
        height: 1.1em;
        background: #1a1a2e;
        margin-left: 2px;
        animation: sp-blink 0.7s step-end infinite;
        vertical-align: text-bottom;
      }
      @keyframes sp-blink {
        50% { opacity: 0; }
      }
      .sp-choices {
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-width: 600px;
        margin: 0 auto;
        padding: 0 8px;
      }
      .sp-choice-btn {
        padding: 16px 20px;
        border: none;
        border-radius: 10px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: transform 0.12s ease, box-shadow 0.12s ease, filter 0.12s ease;
        text-align: left;
        line-height: 1.4;
      }
      .sp-choice-btn:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 14px rgba(0,0,0,0.25);
        filter: brightness(1.1);
      }
      .sp-choice-btn:active {
        transform: translateY(0);
      }
      .sp-outcome {
        max-width: 600px;
        margin: 0 auto;
        padding: 0 8px;
      }
      .sp-outcome-headline {
        font-size: 1.6rem;
        font-weight: 800;
        margin-bottom: 0.75rem;
        color: #1a1a2e;
      }
      .sp-outcome-explanation {
        font-size: 1.05rem;
        line-height: 1.65;
        color: #333;
        margin-bottom: 1.25rem;
      }
      .sp-remember-box {
        background: #FFFDE7;
        border-left: 5px solid #FFC107;
        border-radius: 8px;
        padding: 16px 20px;
        margin-bottom: 1.25rem;
        display: flex;
        gap: 12px;
        align-items: flex-start;
      }
      .sp-remember-icon {
        font-size: 1.5rem;
        flex-shrink: 0;
        line-height: 1;
        margin-top: 2px;
      }
      .sp-remember-label {
        font-weight: 700;
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #F57F17;
        margin-bottom: 4px;
      }
      .sp-remember-text {
        font-size: 1rem;
        line-height: 1.5;
        color: #333;
      }
      .sp-iq-earned {
        text-align: center;
        font-size: 1.3rem;
        font-weight: 700;
        padding: 12px;
        border-radius: 8px;
        margin-top: 0.5rem;
      }
      .sp-transition {
        text-align: center;
        font-size: 1.1rem;
        color: #555;
        font-style: italic;
        padding: 2rem 1rem;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Display narration text with a typewriter effect.
   * @param {string} text
   * @returns {Promise<void>} resolves when typing is complete
   */
  showNarration(text) {
    this._cancelTypewriter();
    const el = document.createElement('div');
    el.className = 'sp-narration';
    this.container.appendChild(el);

    return new Promise((resolve) => {
      let i = 0;
      const cursor = document.createElement('span');
      cursor.className = 'sp-cursor';

      const type = () => {
        if (i < text.length) {
          // Remove cursor, add next char, re-add cursor
          if (cursor.parentNode) cursor.remove();
          el.textContent = text.slice(0, i + 1);
          el.appendChild(cursor);
          i++;
          this._typewriterTimer = setTimeout(type, 30);
        } else {
          // Done typing — remove cursor after a short delay
          setTimeout(() => {
            if (cursor.parentNode) cursor.remove();
          }, 600);
          resolve();
        }
      };

      type();
    });
  }

  /**
   * Render choice buttons.
   * @param {Array<{ id: string, text: string }>} choices
   * @param {Function} callback — called with choiceId on click
   */
  showChoices(choices, callback) {
    const wrapper = document.createElement('div');
    wrapper.className = 'sp-choices';

    for (const choice of choices) {
      const btn = document.createElement('button');
      btn.className = 'sp-choice-btn';
      btn.textContent = choice.text;
      btn.style.backgroundColor = this.team.primaryColor;
      btn.style.color = this.team.secondaryColor;

      btn.addEventListener('click', () => {
        // Disable all buttons after a choice
        const allBtns = wrapper.querySelectorAll('.sp-choice-btn');
        allBtns.forEach((b) => {
          b.disabled = true;
          b.style.opacity = '0.5';
          b.style.cursor = 'default';
        });
        btn.style.opacity = '1';
        btn.style.boxShadow = '0 0 0 3px #FFD700';

        if (callback) callback(choice.id);
      });

      wrapper.appendChild(btn);
    }

    this.container.appendChild(wrapper);
  }

  /**
   * Display the outcome of a decision.
   * @param {{ headline: string, explanation: string, remember: string, iqPoints: number, grade?: string }} outcome
   */
  showOutcome(outcome) {
    const wrapper = document.createElement('div');
    wrapper.className = 'sp-outcome';

    // Headline
    const headline = document.createElement('div');
    headline.className = 'sp-outcome-headline';
    headline.textContent = outcome.headline;
    wrapper.appendChild(headline);

    // Explanation
    const explanation = document.createElement('div');
    explanation.className = 'sp-outcome-explanation';
    explanation.textContent = outcome.explanation;
    wrapper.appendChild(explanation);

    // What to Remember box
    if (outcome.remember) {
      const box = document.createElement('div');
      box.className = 'sp-remember-box';

      const icon = document.createElement('div');
      icon.className = 'sp-remember-icon';
      icon.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 2C9 2 7 4 7 6.5C5.5 7 4 8.5 4 10.5c0 1.5.8 2.8 2 3.5 0 2 1 3.5 2.5 4.5L9 22h6l.5-3.5C17 17.5 18 16 18 14c1.2-.7 2-2 2-3.5 0-2-1.5-3.5-3-4C17 4 15 2 12 2z" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M12 6v10M9 9h6M9 13h6" stroke="currentColor" stroke-width="1" opacity="0.5"/></svg>`;

      const content = document.createElement('div');

      const label = document.createElement('div');
      label.className = 'sp-remember-label';
      label.textContent = 'What to Remember';

      const text = document.createElement('div');
      text.className = 'sp-remember-text';
      text.textContent = outcome.remember;

      content.appendChild(label);
      content.appendChild(text);
      box.appendChild(icon);
      box.appendChild(content);
      wrapper.appendChild(box);
    }

    // IQ Points earned
    if (typeof outcome.iqPoints === 'number') {
      const iq = document.createElement('div');
      iq.className = 'sp-iq-earned';

      const isPositive = outcome.iqPoints >= 0;
      iq.style.backgroundColor = isPositive ? '#E8F5E9' : '#FFEBEE';
      iq.style.color = isPositive ? '#2E7D32' : '#C62828';
      iq.textContent = `${isPositive ? '+' : ''}${outcome.iqPoints} IQ Points`;

      wrapper.appendChild(iq);
    }

    this.container.appendChild(wrapper);
  }

  /**
   * Show a brief transition message before auto-advancing.
   * @param {string} text
   * @param {number} [durationMs=2000] — how long to show before resolving
   * @returns {Promise<void>}
   */
  showTransition(text, durationMs = 2000) {
    const el = document.createElement('div');
    el.className = 'sp-transition';
    el.textContent = text;
    this.container.appendChild(el);

    return new Promise((resolve) => {
      setTimeout(resolve, durationMs);
    });
  }

  /**
   * Clear all panel content.
   */
  clear() {
    this._cancelTypewriter();
    this.container.innerHTML = '';
  }

  /**
   * Update team colors (e.g., after team re-selection).
   * @param {{ primaryColor: string, secondaryColor: string }} team
   */
  setTeam(team) {
    this.team = team;
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  _cancelTypewriter() {
    if (this._typewriterTimer) {
      clearTimeout(this._typewriterTimer);
      this._typewriterTimer = null;
    }
  }
}
