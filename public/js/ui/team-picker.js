/**
 * Diamond IQ — Team Picker UI
 * Renders a responsive grid of all 30 MLB teams as selectable cards.
 */

const MLB_TEAMS = [
  { code: 'ARI', city: 'Arizona', name: 'Diamondbacks', primary: '#A71930', secondary: '#E3D4AD' },
  { code: 'ATL', city: 'Atlanta', name: 'Braves', primary: '#CE1141', secondary: '#13274F' },
  { code: 'BAL', city: 'Baltimore', name: 'Orioles', primary: '#DF4601', secondary: '#27251F' },
  { code: 'BOS', city: 'Boston', name: 'Red Sox', primary: '#BD3039', secondary: '#0C2340' },
  { code: 'CHC', city: 'Chicago', name: 'Cubs', primary: '#0E3386', secondary: '#CC3433' },
  { code: 'CWS', city: 'Chicago', name: 'White Sox', primary: '#27251F', secondary: '#C4CED4' },
  { code: 'CIN', city: 'Cincinnati', name: 'Reds', primary: '#C6011F', secondary: '#000000' },
  { code: 'CLE', city: 'Cleveland', name: 'Guardians', primary: '#00385D', secondary: '#E50022' },
  { code: 'COL', city: 'Colorado', name: 'Rockies', primary: '#33006F', secondary: '#C4CED4' },
  { code: 'DET', city: 'Detroit', name: 'Tigers', primary: '#0C2340', secondary: '#FA4616' },
  { code: 'HOU', city: 'Houston', name: 'Astros', primary: '#002D62', secondary: '#EB6E1F' },
  { code: 'KC', city: 'Kansas City', name: 'Royals', primary: '#004687', secondary: '#BD9B60' },
  { code: 'LAA', city: 'Los Angeles', name: 'Angels', primary: '#BA0021', secondary: '#003263' },
  { code: 'LAD', city: 'Los Angeles', name: 'Dodgers', primary: '#005A9C', secondary: '#EF3E42' },
  { code: 'MIA', city: 'Miami', name: 'Marlins', primary: '#00A3E0', secondary: '#EF3340' },
  { code: 'MIL', city: 'Milwaukee', name: 'Brewers', primary: '#FFC52F', secondary: '#12284B' },
  { code: 'MIN', city: 'Minnesota', name: 'Twins', primary: '#002B5C', secondary: '#D31145' },
  { code: 'NYM', city: 'New York', name: 'Mets', primary: '#002D72', secondary: '#FF5910' },
  { code: 'NYY', city: 'New York', name: 'Yankees', primary: '#003087', secondary: '#C4CED4' },
  { code: 'OAK', city: 'Oakland', name: 'Athletics', primary: '#003831', secondary: '#EFB21E' },
  { code: 'PHI', city: 'Philadelphia', name: 'Phillies', primary: '#E81828', secondary: '#002D72' },
  { code: 'PIT', city: 'Pittsburgh', name: 'Pirates', primary: '#27251F', secondary: '#FDB827' },
  { code: 'SD', city: 'San Diego', name: 'Padres', primary: '#2F241D', secondary: '#FFC425' },
  { code: 'SF', city: 'San Francisco', name: 'Giants', primary: '#FD5A1E', secondary: '#27251F' },
  { code: 'SEA', city: 'Seattle', name: 'Mariners', primary: '#0C2C56', secondary: '#005C5C' },
  { code: 'STL', city: 'St. Louis', name: 'Cardinals', primary: '#C41E3A', secondary: '#0C2340' },
  { code: 'TB', city: 'Tampa Bay', name: 'Rays', primary: '#092C5C', secondary: '#8FBCE6' },
  { code: 'TEX', city: 'Texas', name: 'Rangers', primary: '#003278', secondary: '#C0111F' },
  { code: 'TOR', city: 'Toronto', name: 'Blue Jays', primary: '#134A8E', secondary: '#1D2D5C' },
  { code: 'WSH', city: 'Washington', name: 'Nationals', primary: '#AB0003', secondary: '#14225A' },
];

export class TeamPicker {
  /**
   * @param {HTMLElement} container — DOM element to render into
   * @param {Function} onSelect — callback(team) when a team is chosen
   */
  constructor(container, onSelect) {
    this.container = container;
    this.onSelect = onSelect;
    this.selectedCode = null;
    this._injectStyles();
    this.render();
  }

  _injectStyles() {
    if (document.getElementById('team-picker-styles')) return;
    const style = document.createElement('style');
    style.id = 'team-picker-styles';
    style.textContent = `
      .tp-heading {
        text-align: center;
        font-size: 1.75rem;
        font-weight: 700;
        margin-bottom: 1.25rem;
        color: #1a1a2e;
      }
      .tp-grid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 12px;
        max-width: 900px;
        margin: 0 auto;
        padding: 0 16px;
      }
      @media (max-width: 768px) {
        .tp-grid { grid-template-columns: repeat(3, 1fr); }
      }
      @media (max-width: 480px) {
        .tp-grid { grid-template-columns: repeat(2, 1fr); }
      }
      .tp-card {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 16px 8px;
        border-radius: 10px;
        cursor: pointer;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
        border: 3px solid transparent;
        min-height: 80px;
        text-align: center;
        user-select: none;
      }
      .tp-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 6px 20px rgba(0,0,0,0.25);
      }
      .tp-card.selected {
        border-color: #FFD700;
        box-shadow: 0 0 0 2px #FFD700, 0 6px 20px rgba(255,215,0,0.4);
        transform: translateY(-3px);
      }
      .tp-city {
        font-size: 0.7rem;
        font-weight: 400;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        opacity: 0.85;
        margin-bottom: 2px;
      }
      .tp-name {
        font-size: 0.95rem;
        font-weight: 700;
      }
    `;
    document.head.appendChild(style);
  }

  render() {
    this.container.innerHTML = '';

    const heading = document.createElement('h2');
    heading.className = 'tp-heading';
    heading.textContent = 'Pick Your Team';
    this.container.appendChild(heading);

    const grid = document.createElement('div');
    grid.className = 'tp-grid';

    for (const team of MLB_TEAMS) {
      const card = document.createElement('div');
      card.className = 'tp-card';
      if (this.selectedCode === team.code) {
        card.classList.add('selected');
      }
      card.style.backgroundColor = team.primary;
      card.style.color = team.secondary;

      const city = document.createElement('div');
      city.className = 'tp-city';
      city.textContent = team.city;

      const name = document.createElement('div');
      name.className = 'tp-name';
      name.textContent = team.name;

      card.appendChild(city);
      card.appendChild(name);

      card.addEventListener('click', () => {
        this.selectedCode = team.code;
        // Re-render to show selection highlight
        this.render();
        if (this.onSelect) {
          this.onSelect({
            code: team.code,
            city: team.city,
            name: team.name,
            primaryColor: team.primary,
            secondaryColor: team.secondary,
          });
        }
      });

      grid.appendChild(card);
    }

    this.container.appendChild(grid);
  }
}
