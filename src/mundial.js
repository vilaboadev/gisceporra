const FD_API_BASE = 'https://api.football-data.org/v4';

export const STAGE_LABELS = {
  GROUP_STAGE: 'Fase de Grups',
  ROUND_OF_16: 'Setzens de Final',
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

const STAGE_ORDER = ['GROUP_STAGE', 'ROUND_OF_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'THIRD_PLACE', 'FINAL'];

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

async function fdFetch(path, token) {
  const res = await fetch(`${FD_API_BASE}${path}`, {
    headers: { 'X-Auth-Token': token },
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`Error API (${res.status}): ${msg}`);
  }
  return res.json();
}

export async function fetchWCData(token) {
  const [matchesResult, standingsResult] = await Promise.allSettled([
    fdFetch('/competitions/WC/matches', token),
    fdFetch('/competitions/WC/standings', token),
  ]);

  return {
    matches: matchesResult.status === 'fulfilled' ? (matchesResult.value.matches ?? []) : [],
    standings: standingsResult.status === 'fulfilled' ? (standingsResult.value.standings ?? []) : [],
    errors: [
      matchesResult.status === 'rejected' ? matchesResult.reason : null,
      standingsResult.status === 'rejected' ? standingsResult.reason : null,
    ].filter(Boolean),
  };
}

export function initMundial() {
  const section = document.getElementById('mundial-section');
  if (!section) return;

  const token = window.__FOOTBALL_DATA_TOKEN;
  const statusEl = section.querySelector('#mundial-status');

  if (!token) {
    if (statusEl) statusEl.textContent = 'Cal configurar window.__FOOTBALL_DATA_TOKEN a index.html';
    return;
  }

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
      const { matches, standings, errors } = await fetchWCData(token);
      if (tabPartits) tabPartits.innerHTML = matchesSectionHtml(matches);
      if (tabGrups) tabGrups.innerHTML = standingsHtml(standings);
      const time = new Date().toLocaleTimeString('ca', { hour: '2-digit', minute: '2-digit' });
      if (statusEl) {
        statusEl.textContent = `Actualitzat a les ${time}${errors.length ? ' (algunes dades no disponibles)' : ''}`;
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
