import { teamWithFlag } from './flags.js';

function formatBetDateTime(utcDate) {
  const d = new Date(utcDate);
  return d.toLocaleDateString('ca', { weekday: 'short', day: '2-digit', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('ca', { hour: '2-digit', minute: '2-digit' });
}

export function formatSavedBetSummary(existingBet) {
  if (!existingBet) return '';
  const result = `${existingBet.pred_home_goals} – ${existingBet.pred_away_goals}`;
  return existingBet.tie_winner ? `${result} · Passa ${existingBet.tie_winner}` : result;
}

export function buildBetFormCard(match, existingBet = null) {
  const dateStr = formatBetDateTime(match.utcDate);
  const hasSavedBet = !!existingBet;
  const isDrawBet = hasSavedBet && existingBet.pred_home_goals === existingBet.pred_away_goals;
  const savedSummary = formatSavedBetSummary(existingBet);

  return `
    <form class="bet-form card ${hasSavedBet ? 'bet-form-saved' : ''}" data-match-id="${match.id}" data-round="${match.stage}"
          data-home="${match.homeTeam.name}" data-away="${match.awayTeam.name}" data-has-bet="${hasSavedBet ? '1' : '0'}">
      <div class="bet-header">
        <span class="bet-round">${match.stage?.replace(/_/g,' ') ?? ''}</span>
        <span class="bet-date muted">${dateStr}</span>
      </div>
      ${hasSavedBet ? `<div class="bet-last-saved">
        <span class="bet-last-saved-label">Últim pronòstic enviat</span>
        <strong class="bet-last-saved-score">${savedSummary}</strong>
      </div>` : ''}
      <div class="bet-teams">
        <span class="bet-team-name">${teamWithFlag(match.homeTeam.name)}</span>
        <div class="bet-score-inputs">
          <input class="bet-home bet-goal-input" type="number" min="0" max="20" placeholder="0" value="${existingBet?.pred_home_goals ?? ''}" required />
          <span class="bet-dash">–</span>
          <input class="bet-away bet-goal-input" type="number" min="0" max="20" placeholder="0" value="${existingBet?.pred_away_goals ?? ''}" required />
        </div>
        <span class="bet-team-name right">${teamWithFlag(match.awayTeam.name)}</span>
      </div>
      <p class="bet-hint muted">Resultat final (incloent pròrroga si n'hi ha)</p>
      <div class="tie-winner-group ${isDrawBet ? '' : 'hidden'}">
        <label>En cas d'empat, qui passa?
          <select class="tie-winner-select">
            <option value="">-- Selecciona equip --</option>
            <option value="${match.homeTeam.name}" ${existingBet?.tie_winner === match.homeTeam.name ? 'selected' : ''}>${match.homeTeam.name}</option>
            <option value="${match.awayTeam.name}" ${existingBet?.tie_winner === match.awayTeam.name ? 'selected' : ''}>${match.awayTeam.name}</option>
          </select>
        </label>
      </div>
      <button type="submit" class="btn-primary ${hasSavedBet ? 'btn-edit' : ''}">${hasSavedBet ? 'Edita pronòstic' : 'Envia pronòstic'}</button>
      <p class="bet-status status-msg"></p>
    </form>`;
}
