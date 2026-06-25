import { formatPlaceholder, teamWithFlag } from './flags.js';
import { calculateGroupPointsDetailed } from './scoring.js';

const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard';
const ESPN_STANDINGS = 'https://site.web.api.espn.com/apis/v2/sports/soccer/fifa.world/standings';

const ESPN_STATUS_MAP = {
  STATUS_SCHEDULED: 'SCHEDULED',
  STATUS_IN_PROGRESS: 'IN_PLAY',
  STATUS_HALFTIME: 'PAUSED',
  STATUS_FULL_TIME: 'FINISHED',
  STATUS_FINAL_ET: 'FINISHED',
  STATUS_FINAL_PEN: 'FINISHED',
  STATUS_POSTPONED: 'POSTPONED',
  STATUS_CANCELED: 'CANCELLED',
  STATUS_SUSPENDED: 'POSTPONED',
};

const ESPN_SLUG_MAP = {
  'group-stage': 'GROUP_STAGE',
  'round-of-32': 'ROUND_OF_32',
  'round-of-16': 'ROUND_OF_16',
  'quarterfinals': 'QUARTER_FINALS',
  'semifinals': 'SEMI_FINALS',
  '3rd-place-match': 'THIRD_PLACE',
  'final': 'FINAL',
};

export const STAGE_LABELS = {
  GROUP_STAGE: 'Fase de Grups',
  ROUND_OF_32: 'Setzens de Final',
  ROUND_OF_16: 'Vuitens de Final',
  QUARTER_FINALS: 'Quarts de Final',
  SEMI_FINALS: 'Semifinals',
  THIRD_PLACE: '3r i 4t Lloc',
  FINAL: 'Final',
};

export const STATUS_LABELS = {
  SCHEDULED: 'Programat',
  TIMED: 'Programat',
  IN_PLAY: '⚽ En joc',
  PAUSED: 'Descans',
  FINISHED: 'Acabat',
  POSTPONED: 'Ajornat',
  CANCELLED: 'Cancel·lat',
};

const STAGE_ORDER = ['GROUP_STAGE', 'ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'];

/**
 * Comprova si un nom d'equip és un placeholder d'ESPN (ex: "Group A Winner").
 * Útil per saber si un partit eliminatori té els contendents definits.
 */
export function isPlaceholderName(name) {
  if (!name) return false;
  return /^(Group [A-L]|Round of \d+|Quarterfinal \d+|Semifinal \d+|Third Place Group)/.test(name);
}

export function formatMatchDateTime(utcDate) {
  if (!utcDate) return '';
  const d = new Date(utcDate);
  const opts = { timeZone: 'Europe/Madrid' };
  const weekday = d.toLocaleDateString('ca', { ...opts, weekday: 'short' });
  const day     = d.toLocaleDateString('ca', { ...opts, day: '2-digit' });
  const month   = d.toLocaleDateString('ca', { ...opts, month: 'short' });
  const time    = d.toLocaleTimeString('ca', { ...opts, hour: '2-digit', minute: '2-digit' });
  return `${weekday} ${day} ${month} · ${time}`;
}

export function getMatchDisplayScore(match) {
  const { status, score, utcDate } = match;
  const live = status === 'IN_PLAY' || status === 'PAUSED';
  const finished = status === 'FINISHED';
  if (finished || live) {
    const home = score?.fullTime?.home ?? '-';
    const away = score?.fullTime?.away ?? '-';
    return `${home} - ${away}`;
  }
  return formatMatchDateTime(utcDate);
}

export function groupMatchesByStage(matches) {
  return matches.reduce((acc, match) => {
    const stage = match.stage ?? 'OTHER';
    if (!acc[stage]) acc[stage] = [];
    acc[stage].push(match);
    return acc;
  }, {});
}

export function filterActiveMatches(matches, now = new Date()) {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const dayAfterTomorrow = new Date(today);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

  return matches.filter((m) => {
    if (m.status === 'IN_PLAY' || m.status === 'PAUSED') return true;
    if (m.status === 'SCHEDULED' || m.status === 'TIMED') {
      const d = new Date(m.utcDate);
      return d >= today && d < dayAfterTomorrow;
    }
    return false;
  });
}

export function matchCardHtml(match) {
  const status = STATUS_LABELS[match.status] ?? match.status;
  const live = match.status === 'IN_PLAY' || match.status === 'PAUSED';
  const finished = match.status === 'FINISHED';
  const scheduled = !live && !finished;
  const homeScore = match.score?.fullTime?.home;
  const awayScore = match.score?.fullTime?.away;
  const cardClass = live ? 'live' : finished ? 'finished' : 'scheduled';
  const badgeLabel = live ? '🔴 EN JOC' : status;

  if (scheduled) {
    const timeStr = formatMatchDateTime(match.utcDate);
    return `<div class="match-card scheduled">
      <div class="match-teams">
        <div class="match-team-row">
          <span class="match-team">${teamWithFlag(match.homeTeam?.name)}</span>
          <span class="match-vs">vs</span>
          <span class="match-team right">${teamWithFlag(match.awayTeam?.name)}</span>
        </div>
        <div class="match-datetime">${timeStr}</div>
      </div>
      <span class="match-status-badge scheduled">${badgeLabel}</span>
    </div>`;
  }

  return `<div class="match-card ${cardClass}">
    <div class="match-teams">
      <div class="match-team-row">
        <span class="match-team">${teamWithFlag(match.homeTeam?.name)}</span>
        <span class="match-score ${homeScore > awayScore ? 'winner-score' : ''}">${homeScore ?? '–'}</span>
      </div>
      <div class="match-team-row">
        <span class="match-team">${teamWithFlag(match.awayTeam?.name)}</span>
        <span class="match-score ${awayScore > homeScore ? 'winner-score' : ''}">${awayScore ?? '–'}</span>
      </div>
    </div>
    <span class="match-status-badge ${cardClass}">${badgeLabel}</span>
  </div>`;
}

export function standingsGroupHtml(group, predictions = {}) {
  const sortedTable = [...(group.table ?? [])].sort((a, b) => (a.position || 99) - (b.position || 99));
  const rows = sortedTable
    .map(
      (row, i) => {
        const teamName = row.team?.name ?? '';
        const pred = predictions[teamName];

        const p = pred?.points ?? 0;
        const predPos = pred?.predicted ?? '–';
        let dotClass = 'dot-red';
        if (p >= 10) dotClass = 'dot-green';
        else if (p >= 5) dotClass = 'dot-yellow';

        return `<tr class="${i < 2 ? 'qualified' : ''}">
      <td class="std-pos">${row.position}</td>
      <td>${teamWithFlag(teamName)}</td>
      <td class="std-pred-cell"><span class="pred-dot ${dotClass}"></span>${predPos}</td>
      <td>${row.playedGames}</td>
      <td class="${row.won > 0 ? 'std-w' : ''}">${row.won}</td>
      <td class="${row.draw > 0 ? 'std-d' : ''}">${row.draw}</td>
      <td class="${row.lost > 0 ? 'std-l' : ''}">${row.lost}</td>
      <td>${row.goalsFor}</td>
      <td>${row.goalsAgainst}</td>
      <td>${row.goalDifference > 0 ? '+' : ''}${row.goalDifference}</td>
      <td class="standings-pts">${row.points}</td>
    </tr>`;
      },
    )
    .join('');

  return `<div class="standings-group">
    <div class="standings-group-name">${group.group ?? 'Grup'}</div>
    <div class="standings-table-wrap">
    <table class="standings-table">
      <thead><tr>
        <th title="Posició real">#</th>
        <th>Equip</th>
        <th title="Pronòstic">Pron.</th>
        <th title="Partits jugats">PJ</th>
        <th title="Victòries">V</th>
        <th title="Empats">E</th>
        <th title="Derrotes">D</th>
        <th title="Gols a favor">GF</th>
        <th title="Gols en contra">GC</th>
        <th title="Diferència">DG</th>
        <th title="Punts">Pts</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    </div>
  </div>`;
}

export function standingsHtml(standings, allPredictions = {}) {
  if (!standings?.length) return '<p class="muted">No hi ha dades de classificació.</p>';
  const groups = standings.filter((s) => s.type === 'TOTAL');
  if (!groups.length) return '<p class="muted">No hi ha dades de grups disponibles.</p>';
  return groups.map(s => {
    // Normalitza "Group A" o "Grup A" a "A" per fer lookup
    const groupKey = (s.group ?? '').replace(/^(Group|Grup)\s+/i, '');
    const groupPreds = allPredictions[groupKey] ?? {};
    return standingsGroupHtml(s, groupPreds);
  }).join('');
}

export function matchesSectionHtml(matches) {
  if (!matches?.length) return '<p class="muted">No hi ha dades de partits disponibles.</p>';

  const live = matches.filter(m => m.status === 'IN_PLAY' || m.status === 'PAUSED');
  const upcoming = matches
    .filter(m => m.status === 'SCHEDULED' || m.status === 'TIMED')
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
  const past = matches
    .filter(m => m.status === 'FINISHED')
    .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate));

  let html = '';

  if (live.length > 0) {
    html += '<div class="stage-section"><p class="stage-title">🔴 En Joc</p>';
    html += live.map(matchCardHtml).join('');
    html += '</div>';
  }

  if (upcoming.length > 0) {
    html += '<div class="stage-section"><p class="stage-title">📅 Propers Partits</p>';
    html += upcoming.slice(0, 10).map(matchCardHtml).join('');
    if (upcoming.length > 10) {
      html += `<p class="muted" style="text-align:center;padding:.5rem 0">+${upcoming.length - 10} partits més</p>`;
    }
    html += '</div>';
  }

  if (past.length > 0) {
    const byStage = groupMatchesByStage(past);
    for (const stage of [...STAGE_ORDER].reverse()) {
      const stageMatches = byStage[stage];
      if (!stageMatches?.length) continue;
      html += `<div class="stage-section"><p class="stage-title">${STAGE_LABELS[stage] ?? stage} – Resultats</p>`;
      if (stage === 'GROUP_STAGE') {
        html += stageMatches.slice(0, 12).map(matchCardHtml).join('');
        if (stageMatches.length > 12) html += `<p class="muted" style="text-align:center;padding:.5rem 0">+${stageMatches.length - 12} partits</p>`;
      } else {
        html += stageMatches.map(matchCardHtml).join('');
      }
      html += '</div>';
    }
  }

  return html || '<p class="muted">No hi ha partits per mostrar.</p>';
}

const KNOCKOUT_STAGES = ['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'];

export function knockoutBracketHtml(matches) {
  if (!matches?.length) return '<p class="muted">No hi ha dades disponibles.</p>';
  const knockout = matches.filter(m => m.stage && m.stage !== 'GROUP_STAGE');
  if (!knockout.length) return '<p class="muted">La fase eliminatòria encara no ha començat.</p>';

  const byStage = groupMatchesByStage(knockout);
  let html = '';

  for (const stage of KNOCKOUT_STAGES) {
    const stageMatches = byStage[stage];
    if (!stageMatches?.length) continue;

    html += `<div class="bracket-round">
      <p class="bracket-round-name">${STAGE_LABELS[stage] ?? stage}</p>`;

    for (const m of stageMatches) {
      const finished = m.status === 'FINISHED';
      const hGoals = m.score?.fullTime?.home;
      const aGoals = m.score?.fullTime?.away;
      const hWin = finished && hGoals != null && aGoals != null && hGoals > aGoals;
      const aWin = finished && hGoals != null && aGoals != null && aGoals > hGoals;
      const dateStr = !finished ? formatMatchDateTime(m.utcDate) : '';
      html += `<div class="bracket-match">
        <div class="bracket-team ${hWin ? 'winner' : ''}">
          <span>${teamWithFlag(m.homeTeam?.name)}</span>
          <span class="bracket-team-score">${finished ? (hGoals ?? '–') : dateStr}</span>
        </div>
        <div class="bracket-team ${aWin ? 'winner' : ''}">
          <span>${teamWithFlag(m.awayTeam?.name)}</span>
          <span class="bracket-team-score">${finished ? (aGoals ?? '–') : ''}</span>
        </div>
      </div>`;
    }
    html += '</div>';
  }

  return html;
}


function espnEventToMatch(event) {
  const comp = event.competitions?.[0] ?? {};
  const competitors = comp.competitors ?? [];
  const home = competitors.find((c) => c.homeAway === 'home') ?? competitors[0] ?? {};
  const away = competitors.find((c) => c.homeAway === 'away') ?? competitors[1] ?? {};
  const statusName = comp.status?.type?.name ?? 'STATUS_SCHEDULED';
  const status = ESPN_STATUS_MAP[statusName] ?? 'SCHEDULED';
  const slug = event.season?.slug ?? '';
  const stage = ESPN_SLUG_MAP[slug] ?? 'GROUP_STAGE';
  const note = comp.altGameNote ?? '';
  const groupMatch = note.match(/Group ([A-Z])/);
  const group = groupMatch ? `Grup ${groupMatch[1]}` : null;
  const homeScore = home.score !== undefined ? Number(home.score) : null;
  const awayScore = away.score !== undefined ? Number(away.score) : null;
  return {
    id: event.id,
    homeTeam: { name: home.team?.displayName ?? '?' },
    awayTeam: { name: away.team?.displayName ?? '?' },
    status,
    score: { fullTime: { home: homeScore, away: awayScore } },
    stage,
    group,
    matchday: group,
    utcDate: event.date,
  };
}

function espnGroupToStanding(group) {
  const entries = (group.standings?.entries ?? []).map((entry, i) => {
    const stat = (name) => {
      const s = entry.stats?.find((x) => x.name === name);
      return s ? Number(s.value) : 0;
    };
    return {
      position: stat('rank') || i + 1,
      team: { name: entry.team?.displayName ?? '?' },
      playedGames: stat('gamesPlayed'),
      won: stat('wins'),
      draw: stat('ties'),
      lost: stat('losses'),
      goalsFor: stat('pointsFor'),
      goalsAgainst: stat('pointsAgainst'),
      goalDifference: stat('pointDifferential'),
      points: stat('points'),
    };
  });
  return { type: 'TOTAL', group: group.name, table: entries };
}

export async function fetchWCData() {
  const [eventsResult, standingsResult] = await Promise.allSettled([
    fetch(`${ESPN_SCOREBOARD}?limit=200&dates=20260611-20260719`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`ESPN scoreboard ${r.status}`)))),
    fetch(`${ESPN_STANDINGS}?season=2026&seasontype=1`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`ESPN standings ${r.status}`)))),
  ]);

  const matches = eventsResult.status === 'fulfilled'
    ? (eventsResult.value.events ?? []).map(espnEventToMatch)
    : [];
  const standings = standingsResult.status === 'fulfilled'
    ? (standingsResult.value.children ?? []).map(espnGroupToStanding)
    : [];
  const errors = [
    eventsResult.status === 'rejected' ? eventsResult.reason : null,
    standingsResult.status === 'rejected' ? standingsResult.reason : null,
  ].filter(Boolean);

  return { matches, standings, errors };
}

export function initMundial() {
  const section = document.getElementById('mundial-section');
  if (!section) return;

  const statusEl = section.querySelector('#mundial-status');
  const tabPartits = section.querySelector('#tab-partits');
  const tabGrups = section.querySelector('#tab-grups');

  section.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      section.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      section.querySelectorAll('.tab-content').forEach((c) => c.classList.add('hidden'));
      btn.classList.add('active');
      section.querySelector(`#tab-${btn.dataset.tab}`)?.classList.remove('hidden');
    });
  });

  async function loadData() {
    if (statusEl) statusEl.textContent = 'Carregant dades del Mundial 2026...';
    try {
      const { matches, standings, errors } = await fetchWCData();
      if (tabPartits) tabPartits.innerHTML = matchesSectionHtml(matches);
      if (tabGrups) tabGrups.innerHTML = standingsHtml(standings);
      const time = new Date().toLocaleTimeString('ca', { hour: '2-digit', minute: '2-digit' });
      if (statusEl) {
        const errMsg = errors.length ? ` · ⚠️ ${errors.map((e) => e.message).join('; ')}` : '';
        statusEl.textContent = `Actualitzat a les ${time}${errMsg}`;
      }
    } catch (err) {
      if (statusEl) statusEl.textContent = `Error: ${err.message}`;
      if (tabPartits) tabPartits.innerHTML = "<p class=\"muted\">No s'han pogut carregar les dades.</p>";
    }
  }

  section.querySelector('#refresh-mundial')?.addEventListener('click', loadData);
  loadData();
  setInterval(loadData, 2 * 60 * 1000);
}
