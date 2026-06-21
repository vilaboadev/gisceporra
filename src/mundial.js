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

export function formatMatchDateTime(utcDate) {
  if (!utcDate) return '';
  const d = new Date(utcDate);
  return d.toLocaleString('ca', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
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
  const displayScore = getMatchDisplayScore(match);
  const statusClass = live ? 'status-live' : finished ? 'status-finished' : 'status-scheduled';
  const matchday = match.matchday ? `<span class="match-day">J${match.matchday}</span>` : '';
  return `<div class="match-card ${statusClass}">
    <div class="match-teams">
      <span class="team home">${match.homeTeam?.name ?? '?'}</span>
      <span class="match-score">${displayScore}</span>
      <span class="team away">${match.awayTeam?.name ?? '?'}</span>
    </div>
    <div class="match-meta">
      <span class="match-status">${status}</span>
      ${matchday}
    </div>
  </div>`;
}

export function standingsGroupHtml(group) {
  const rows = (group.table ?? [])
    .map(
      (row, i) => `<tr class="${i < 2 ? 'qualified' : ''}">
      <td class="pos">${row.position}</td>
      <td class="team-col">${row.team?.name ?? '?'}</td>
      <td>${row.playedGames}</td>
      <td>${row.won}</td>
      <td>${row.draw}</td>
      <td>${row.lost}</td>
      <td>${row.goalsFor}</td>
      <td>${row.goalsAgainst}</td>
      <td>${row.goalDifference}</td>
      <td class="points">${row.points}</td>
    </tr>`,
    )
    .join('');

  return `<div class="group-table">
    <h3 class="group-title">${group.group ?? 'Grup'}</h3>
    <table>
      <thead><tr>
        <th>#</th><th class="team-col">Equip</th>
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
  </div>`;
}

export function standingsHtml(standings) {
  if (!standings?.length) return '<p class="muted">No hi ha dades de classificació.</p>';
  const groups = standings.filter((s) => s.type === 'TOTAL');
  if (!groups.length) return '<p class="muted">No hi ha dades de grups disponibles.</p>';
  return groups.map(standingsGroupHtml).join('');
}

export function matchesSectionHtml(matches) {
  if (!matches?.length) return '<p class="muted">No hi ha dades de partits disponibles.</p>';

  const active = filterActiveMatches(matches);
  const byStage = groupMatchesByStage(matches);
  let html = '';

  if (active.length > 0) {
    html += '<h3 class="stage-title">🔴 Avui / Properament</h3>';
    html += active.map(matchCardHtml).join('');
  }

  for (const stage of [...STAGE_ORDER].reverse()) {
    const stageMatches = byStage[stage];
    if (!stageMatches?.length) continue;

    const hasResults = stageMatches.some((m) => m.status === 'FINISHED' || m.status === 'IN_PLAY');
    const hasUpcoming = stageMatches.some((m) => m.status === 'SCHEDULED' || m.status === 'TIMED');
    if (!hasResults && !hasUpcoming) continue;

    html += `<h3 class="stage-title">${STAGE_LABELS[stage] ?? stage}</h3>`;

    if (stage === 'GROUP_STAGE') {
      const byMatchday = {};
      for (const m of stageMatches) {
        const key = m.matchday ?? '?';
        if (!byMatchday[key]) byMatchday[key] = [];
        byMatchday[key].push(m);
      }
      const days = Object.keys(byMatchday).sort((a, b) => Number(b) - Number(a));
      for (const day of days.slice(0, 3)) {
        const dayMatches = byMatchday[day];
        if (dayMatches.some((m) => m.status === 'FINISHED' || m.status === 'IN_PLAY' || m.status === 'SCHEDULED')) {
          html += `<h4 class="matchday-title">Jornada ${day}</h4>`;
          html += dayMatches.map(matchCardHtml).join('');
        }
      }
    } else {
      html += stageMatches.map(matchCardHtml).join('');
    }
  }

  return html || '<p class="muted">No hi ha partits per mostrar.</p>';
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
