/**
 * Diamond IQ — Review Mode UI
 * Displays a scrollable summary of all decisions, color-coded grades, and total IQ score.
 */

/**
 * Grade thresholds vary by tier — harder tiers are more forgiving.
 * Returns { letter, label, color } based on percentage of max IQ earned.
 */
function computeGrade(totalIQ, maxIQ, tier) {
  // Tier adjustment: harder tiers curve the grade up slightly
  const tierBonus = {
    tball: 0,
    rookie: 2,
    minors: 4,
    majors: 6,
    'the-show': 8,
  };
  const bonus = tierBonus[tier] || 0;
  const pct = maxIQ > 0 ? ((totalIQ / maxIQ) * 100) + bonus : 0;
  const clamped = Math.min(pct, 100);

  if (clamped >= 97) return { letter: 'A+', label: 'Diamond Mind', color: '#FFD700' };
  if (clamped >= 93) return { letter: 'A', label: 'All-Star IQ', color: '#4CAF50' };
  if (clamped >= 90) return { letter: 'A-', label: 'Sharp', color: '#66BB6A' };
  if (clamped >= 87) return { letter: 'B+', label: 'Solid', color: '#42A5F5' };
  if (clamped >= 83) return { letter: 'B', label: 'Good Instincts', color: '#2196F3' };
  if (clamped >= 80) return { letter: 'B-', label: 'Getting There', color: '#64B5F6' };
  if (clamped >= 77) return { letter: 'C+', label: 'Room to Grow', color: '#FFA726' };
  if (clamped >= 73) return { letter: 'C', label: 'Average', color: '#FF9800' };
  if (clamped >= 70) return { letter: 'C-', label: 'Needs Work', color: '#FFB74D' };
  if (clamped >= 60) return { letter: 'D', label: 'Keep Practicing', color: '#EF5350' };
  return { letter: 'F', label: 'Back to the Basics', color: '#E53935' };
}

/**
 * Map outcome grade strings to a left-border color.
 */
function gradeColor(grade) {
  switch ((grade || '').toLowerCase()) {
    case 'great': return '#4CAF50';
    case 'good': return '#2196F3';
    case 'okay': return '#FFC107';
    case 'bad': return '#F44336';
    default: return '#9E9E9E';
  }
}

export class ReviewMode {
  /**
   * @param {HTMLElement} container — DOM element to render into
   * @param {Function} [onPlayAgain] — callback when "Play Again" is clicked
   */
  constructor(container, onPlayAgain) {
    this.container = container;
    this.onPlayAgain = onPlayAgain || null;
    this._injectStyles();
  }

  _injectStyles() {
    if (document.getElementById('rm-styles')) return;
    const style = document.createElement('style');
    style.id = 'rm-styles';
    style.textContent = `
      .rm-wrapper {
        max-width: 640px;
        margin: 0 auto;
        padding: 0 16px 40px;
      }
      .rm-score-card {
        text-align: center;
        padding: 24px;
        border-radius: 14px;
        margin-bottom: 24px;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        color: #fff;
      }
      .rm-total-iq {
        font-size: 3rem;
        font-weight: 800;
        margin-bottom: 4px;
      }
      .rm-total-label {
        font-size: 0.9rem;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        opacity: 0.7;
        margin-bottom: 12px;
      }
      .rm-grade-letter {
        font-size: 2.2rem;
        font-weight: 800;
        margin-bottom: 2px;
      }
      .rm-grade-label {
        font-size: 1rem;
        opacity: 0.8;
      }
      .rm-history-heading {
        font-size: 1.2rem;
        font-weight: 700;
        color: #1a1a2e;
        margin-bottom: 12px;
      }
      .rm-history-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 24px;
      }
      .rm-entry {
        background: #fff;
        border-radius: 10px;
        padding: 16px 16px 16px 20px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
        position: relative;
      }
      .rm-entry::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 5px;
        border-radius: 10px 0 0 10px;
      }
      .rm-entry-situation {
        font-weight: 700;
        font-size: 0.95rem;
        color: #1a1a2e;
        margin-bottom: 6px;
      }
      .rm-entry-choice {
        font-size: 0.9rem;
        color: #333;
        margin-bottom: 4px;
      }
      .rm-entry-choice strong {
        color: #1a1a2e;
      }
      .rm-entry-result {
        font-size: 0.85rem;
        color: #555;
        margin-bottom: 4px;
      }
      .rm-entry-why {
        font-size: 0.85rem;
        color: #666;
        font-style: italic;
        padding-left: 10px;
        border-left: 3px solid #e0e0e0;
        margin-top: 6px;
      }
      .rm-play-again {
        display: block;
        width: 100%;
        max-width: 300px;
        margin: 0 auto;
        padding: 16px;
        font-size: 1.1rem;
        font-weight: 700;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        color: #fff;
        transition: transform 0.12s ease, box-shadow 0.12s ease;
      }
      .rm-play-again:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Render the full review screen.
   * @param {Array} history — array of decision entries from GameState.getHistory()
   * @param {number} totalIQ — accumulated IQ points
   * @param {string} tier — difficulty tier for grade curve
   */
  show(history, totalIQ, tier) {
    this.container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'rm-wrapper';

    // --- Score card ---
    const maxIQ = this._estimateMaxIQ(history);
    const grade = computeGrade(totalIQ, maxIQ, tier);

    const scoreCard = document.createElement('div');
    scoreCard.className = 'rm-score-card';

    const totalEl = document.createElement('div');
    totalEl.className = 'rm-total-iq';
    totalEl.textContent = totalIQ;

    const totalLabel = document.createElement('div');
    totalLabel.className = 'rm-total-label';
    totalLabel.textContent = 'Total IQ Points';

    const gradeLetter = document.createElement('div');
    gradeLetter.className = 'rm-grade-letter';
    gradeLetter.style.color = grade.color;
    gradeLetter.textContent = grade.letter;

    const gradeLabel = document.createElement('div');
    gradeLabel.className = 'rm-grade-label';
    gradeLabel.textContent = grade.label;

    scoreCard.appendChild(totalEl);
    scoreCard.appendChild(totalLabel);
    scoreCard.appendChild(gradeLetter);
    scoreCard.appendChild(gradeLabel);
    wrapper.appendChild(scoreCard);

    // --- Decision history ---
    if (history.length > 0) {
      const heading = document.createElement('div');
      heading.className = 'rm-history-heading';
      heading.textContent = 'Your Decisions';
      wrapper.appendChild(heading);

      const list = document.createElement('div');
      list.className = 'rm-history-list';

      for (const entry of history) {
        const card = document.createElement('div');
        card.className = 'rm-entry';

        const entryGrade = entry.outcome ? entry.outcome.grade : null;
        card.style.setProperty('--border-color', gradeColor(entryGrade));
        card.querySelector?.('::before');
        // Use inline style on pseudo via a trick: set border-left on the card itself
        card.style.borderLeft = `5px solid ${gradeColor(entryGrade)}`;
        // Remove the pseudo-element border since we're using inline
        card.style.paddingLeft = '16px';

        // Situation
        const situation = document.createElement('div');
        situation.className = 'rm-entry-situation';
        situation.textContent = entry.situation || entry.narration || 'Scenario';
        card.appendChild(situation);

        // What was chosen
        const choice = document.createElement('div');
        choice.className = 'rm-entry-choice';
        choice.innerHTML = `<strong>You chose:</strong> ${this._escapeHtml(entry.choiceText || 'N/A')}`;
        card.appendChild(choice);

        // What happened
        if (entry.outcome) {
          const result = document.createElement('div');
          result.className = 'rm-entry-result';
          result.textContent = entry.outcome.headline || '';
          card.appendChild(result);

          // The WHY explanation
          if (entry.outcome.explanation) {
            const why = document.createElement('div');
            why.className = 'rm-entry-why';
            why.textContent = entry.outcome.explanation;
            card.appendChild(why);
          }
        }

        list.appendChild(card);
      }

      wrapper.appendChild(list);
    }

    // --- Play Again button ---
    const btn = document.createElement('button');
    btn.className = 'rm-play-again';
    btn.textContent = 'Play Again';
    btn.addEventListener('click', () => {
      if (this.onPlayAgain) this.onPlayAgain();
    });
    wrapper.appendChild(btn);

    this.container.appendChild(wrapper);
  }

  // ---------------------------------------------------------------------------
  // Internal
  // ---------------------------------------------------------------------------

  /**
   * Estimate the max possible IQ from the history (sum of best-case iqPoints).
   * Falls back to 10 * decisions if no outcome data.
   */
  _estimateMaxIQ(history) {
    let max = 0;
    let hasOutcomes = false;
    for (const entry of history) {
      if (entry.outcome && typeof entry.outcome.iqPoints === 'number') {
        // Assume the max per scenario is 10 unless we know better
        max += 10;
        hasOutcomes = true;
      }
    }
    if (!hasOutcomes) {
      max = history.length * 10;
    }
    return max || 10;
  }

  _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}
