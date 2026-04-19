/**
 * Diamond IQ — Difficulty Picker UI
 * Renders 5 vertical tier cards styled in the selected team's colors.
 */

const TIERS = [
  {
    id: 'tball',
    name: 'T-Ball',
    emoji: '\u26be',
    description: 'Learn the basics \u2014 where to throw, where to run',
  },
  {
    id: 'rookie',
    name: 'Rookie',
    emoji: '\ud83e\udde4',
    description: 'Fundamentals \u2014 force outs, tagging up, base running',
  },
  {
    id: 'minors',
    name: 'Minors',
    emoji: '\ud83c\udfc6',
    description: 'Game IQ \u2014 cutoffs, relays, situational hitting',
  },
  {
    id: 'majors',
    name: 'Majors',
    emoji: '\ud83d\udd25',
    description: 'Advanced \u2014 double plays, pitch sequencing, defensive schemes',
  },
  {
    id: 'the-show',
    name: 'The Show',
    emoji: '\ud83c\udf1f',
    description: 'Elite \u2014 squeeze plays, shifts, pitcher/batter chess',
  },
];

export class DifficultyPicker {
  /**
   * @param {HTMLElement} container — DOM element to render into
   * @param {{ primaryColor: string, secondaryColor: string }} team — selected team colors
   * @param {Function} onSelect — callback(tierId) when a tier is chosen
   */
  constructor(container, team, onSelect) {
    this.container = container;
    this.team = team;
    this.onSelect = onSelect;
    this.selectedTier = null;
    this._injectStyles();
    this.render();
  }

  _injectStyles() {
    if (document.getElementById('diff-picker-styles')) return;
    const style = document.createElement('style');
    style.id = 'diff-picker-styles';
    style.textContent = `
      .dp-heading {
        text-align: center;
        font-size: 1.75rem;
        font-weight: 700;
        margin-bottom: 1.25rem;
        color: #1a1a2e;
      }
      .dp-stack {
        display: flex;
        flex-direction: column;
        gap: 12px;
        max-width: 520px;
        margin: 0 auto;
        padding: 0 16px;
      }
      .dp-card {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 20px 24px;
        border-radius: 12px;
        cursor: pointer;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
        border: 3px solid transparent;
        user-select: none;
      }
      .dp-card:hover {
        transform: translateX(6px);
        box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      }
      .dp-card.selected {
        border-color: #FFD700;
        box-shadow: 0 0 0 2px #FFD700, 0 4px 16px rgba(255,215,0,0.35);
      }
      .dp-emoji {
        font-size: 2rem;
        flex-shrink: 0;
      }
      .dp-info {
        display: flex;
        flex-direction: column;
      }
      .dp-tier-name {
        font-size: 1.15rem;
        font-weight: 700;
        margin-bottom: 2px;
      }
      .dp-desc {
        font-size: 0.85rem;
        opacity: 0.85;
      }
    `;
    document.head.appendChild(style);
  }

  render() {
    this.container.innerHTML = '';

    const heading = document.createElement('h2');
    heading.className = 'dp-heading';
    heading.textContent = 'Choose Your Level';
    this.container.appendChild(heading);

    const stack = document.createElement('div');
    stack.className = 'dp-stack';

    for (const tier of TIERS) {
      const card = document.createElement('div');
      card.className = 'dp-card';
      if (this.selectedTier === tier.id) {
        card.classList.add('selected');
      }
      card.style.backgroundColor = this.team.primaryColor;
      card.style.color = this.team.secondaryColor;

      const emoji = document.createElement('div');
      emoji.className = 'dp-emoji';
      emoji.textContent = tier.emoji;

      const info = document.createElement('div');
      info.className = 'dp-info';

      const name = document.createElement('div');
      name.className = 'dp-tier-name';
      name.textContent = tier.name;

      const desc = document.createElement('div');
      desc.className = 'dp-desc';
      desc.textContent = tier.description;

      info.appendChild(name);
      info.appendChild(desc);
      card.appendChild(emoji);
      card.appendChild(info);

      card.addEventListener('click', () => {
        this.selectedTier = tier.id;
        this.render();
        if (this.onSelect) {
          this.onSelect(tier.id);
        }
      });

      stack.appendChild(card);
    }

    this.container.appendChild(stack);
  }
}
