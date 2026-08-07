/**
 * hyper.js — Lògica i renderitzat de la Porra-League Hypermotion
 *
 * Font de dades de partits: TheSportDB (free tier, clau "3")
 * Font de pronòstics i resultats: Supabase
 */

import { calculateHyperMatchPoints, getHyperBadgeColor, calculateHyperUserTotal } from './hyper-scoring.js';
import { getTeamInfo, HYPER_TEAMS } from './hyper-teams.js';

// ── Helpers ────────────────────────────────────────────────────────────────

/** Escapa caràcters HTML per evitar XSS. */
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** Validates an URL as http(s)-only to prevent javascript: scheme injection. */
function safeSrc(url) {
  return /^https?:\/\//.test(url ?? '') ? url : '';
}

const CACHE_KEY = 'tsdb_league_next_matches';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hores

// ── TheSportDB API ─────────────────────────────────────────────────────────
const TSDB_BASE = 'https://www.thesportsdb.com/api/v1/json/3';

// Petita pausa per no cremar el rate limit de la clau gratuïta (~30 req/min)
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Serialitza el Map a un objecte pla per poder-lo desar a localStorage.
 */
function serializeCache(eventsByTeam) {
  return {
    timestamp: Date.now(),
    data: Object.fromEntries(eventsByTeam),
  };
}

function deserializeCache(raw) {
  return new Map(Object.entries(raw.data));
}

/**
 * Retorna el cache de propers partits de la lliga, refrescant-lo
 * automàticament si ha caducat o no existeix.
 */
export async function getLeagueEventsCache(allTeamIds, { forceRefresh = false } = {}) {
  if (!forceRefresh) {
    const cachedRaw = localStorage.getItem(CACHE_KEY);
    if (cachedRaw) {
      try {
        const parsed = JSON.parse(cachedRaw);
        const age = Date.now() - parsed.timestamp;
        if (age < CACHE_TTL_MS) {
          return deserializeCache(parsed);
        }
      } catch (e) {
        console.warn('Cache de TheSportsDB corrupte, es regenera', e);
      }
    }
  }

  // Cache absent, caducat o forçat: el regenerem
  const freshData = await fetchAllUpcomingLeagueMatches(allTeamIds);
  localStorage.setItem(CACHE_KEY, JSON.stringify(serializeCache(freshData)));
  return freshData;
}

/**
 * Obté el proper partit "local" de cada equip de la lliga (allTeamIds),
 * i en dedueix la llista completa de propers partits sense repetir crides
 * quan el partit ja ha aparegut com a proper partit d'un altre equip.
 *
 * @param {string[]|number[]} allTeamIds - IDs de tots els equips de la lliga
 * @param {number} delayMs - pausa entre crides per no saturar el rate limit
 * @returns {Promise<Map<string, object>>} Map<idEvent, event>
 */
export async function fetchAllUpcomingLeagueMatches(allTeamIds, delayMs = 250) {
  const eventsByTeam = new Map();     // idTeam -> event (proper partit com a local)
  const knownEventIds = new Set();    // idEvent ja capturats (com a local o com a visitant)
  const pendingTeamIds = new Set(allTeamIds.map(String));

  for (const teamId of allTeamIds) {
    const key = String(teamId);

    // Si aquest equip ja apareix com a visitant en un partit que ja tenim,
    // ens estalviem la crida.
    if (!pendingTeamIds.has(key)) continue;

    const res = await fetch(`${TSDB_BASE}/eventsnext.php?id=${teamId}`);
    if (!res.ok) {
      console.warn(`TheSportDB error ${res.status} per a l'equip ${teamId}`);
      pendingTeamIds.delete(key);
      continue;
    }
    const json = await res.json();
    const events = json.events ?? [];

    pendingTeamIds.delete(key);

    for (const ev of events) {
      if (knownEventIds.has(ev.idEvent)) continue;
      knownEventIds.add(ev.idEvent);
      eventsByTeam.set(String(ev.idHomeTeam), ev);

      // El rival d'aquest partit ja té el seu "proper partit" resolt
      // (és aquest mateix), així que el traiem de la cua pendent.
      if (ev.idAwayTeam) {
        pendingTeamIds.delete(String(ev.idAwayTeam));
      }
    }

    await sleep(delayMs);
  }

  return eventsByTeam; // idTeam (local) -> event
}

/**
 * Retorna els propers partits d'un equip concret a partir del cache
 * generat per fetchAllUpcomingLeagueMatches.
 */
export function getNextMatchesForTeam(eventsByTeam, teamId) {
  const key = String(teamId);
  const asHome = eventsByTeam.get(key);
  if (asHome) return [asHome];

  // L'equip no té partit com a local en el cache: busquem si apareix
  // com a visitant en algun dels events capturats.
  for (const ev of eventsByTeam.values()) {
    if (String(ev.idAwayTeam) === key) return [ev];
  }
  return [];
}

const ALL_TEAM_IDS = Object.values(HYPER_TEAMS).map(team => team.id);

/**
 * Obté els pròxims partits d'un equip (màx. 15 de theSportDB free tier).
 * @param {string} teamId  ID de theSportDB
 * @returns {Promise<Array>}
 */
export async function fetchTeamNextMatches(teamId) {
  if (!teamId) return [];
  // Cachejat, per exemple cada 6-12h
  const leagueEventsCache = await getLeagueEventsCache(ALL_TEAM_IDS);
  return getNextMatchesForTeam(leagueEventsCache, teamId);
}

/**
 * Obté els últims partits d'un equip.
 * @param {string} teamId  ID de theSportDB
 * @returns {Promise<Array>}
 */
export async function fetchTeamLastMatches(teamId) {
  if (!teamId) return [];
  const res = await fetch(`${TSDB_BASE}/eventslast.php?id=${teamId}`);
  if (!res.ok) throw new Error(`TheSportDB error ${res.status}`);
  const json = await res.json();
  return json.results ?? [];
}

/**
 * Obté els detalls d'un equip.
 * @param {string} teamId  ID de theSportDB
 * @returns {Promise<object|null>}
 */
export async function fetchTeamDetails(teamId) {
  if (!teamId) return null;
  const res = await fetch(`${TSDB_BASE}/lookupteam.php?id=${teamId}`);
  if (!res.ok) throw new Error(`TheSportDB error ${res.status}`);
  const json = await res.json();
  return json.teams?.[0] ?? null;
}

/**
 * Obté la plantilla de l'equip.
 * @param {string} teamId  ID de theSportDB
 * @returns {Promise<Array>}
 */
export async function fetchTeamPlayers(teamId) {
  if (!teamId) return [];
  try {
    const res = await fetch(`${TSDB_BASE}/lookup_all_players.php?id=${teamId}`);
    if (!res.ok) return [];
    const json = await res.json();
    return json.player ?? [];
  } catch {
    return [];
  }
}

export async function fetchHyperStandings(leagueId = '4400', leagueYear = '2026-2027') {
  const res = await fetch(`${TSDB_BASE}/lookuptable.php?l=${leagueId}&s=${leagueYear}`);
  const data = await res.json();
  return data.table ?? [];
}

// ── Helpers de format ──────────────────────────────────────────────────────

/**
 * Formata una data de theSportDB (format: "2025-09-13 20:00:00") en català.
 * @param {string} dateStr
 * @param {string} timeStr
 * @returns {string}
 */
export function formatHyperMatchDate(dateStr, timeStr = '') {
  if (!dateStr) return '';
  const isoStr = timeStr ? `${dateStr}T${timeStr}Z` : `${dateStr}T00:00:00Z`;
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return dateStr;
  const datePart = d.toLocaleDateString('ca', { weekday: 'short', day: '2-digit', month: 'short' });
  if (!timeStr || timeStr === '00:00:00') return datePart;
  const timePart = d.toLocaleTimeString('ca', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

/**
 * Retorna si un partit ja ha passat la finestra de predicció (1h abans).
 * @param {string} dateStr  "YYYY-MM-DD"
 * @param {string} timeStr  "HH:MM:SS"
 * @returns {boolean}
 */
const HYPER_PREDICTION_LOCKOUT_MS = 60 * 60 * 1000; // 1 hora en ms

export function isPredictionLocked(dateStr, timeStr = '00:00:00') {
  if (!dateStr) return true;
  const isoStr = `${dateStr}T${timeStr}Z`;
  const matchTime = new Date(isoStr).getTime();
  return Date.now() > matchTime - HYPER_PREDICTION_LOCKOUT_MS;
}

// ── Renderitzat: Pantalla d'Inici ──────────────────────────────────────────

function getMatchStatusBadge(locked, pred) {
  if (locked) {
    return pred
      ? `<span class="hyper-pred-locked">🔒 ${pred.pred_home}–${pred.pred_away}</span>`
      : `<span class="hyper-badge-warn">⚠️ Sense pronòstic</span>`;
  }
  return pred
    ? `<span class="hyper-badge-ok">✅ Pronòstic fet: ${pred.pred_home}–${pred.pred_away}</span>`
    : `<span class="hyper-badge-warn">⚠️ Pronòstic pendent</span>`;
}

function getPredictButton(m, key, locked, pred) {
  if (locked) return '';
  const label = pred ? 'Edita pronòstic' : 'Predir resultat';
  const extraClass = pred ? ' btn-edit' : '';
  return `<button class="btn-primary${extraClass} hyper-predict-btn" data-event="${key}" data-home="${m.strHomeTeam}" data-away="${m.strAwayTeam}" data-date="${m.dateEvent}" data-time="${m.strTime ?? ''}">${label}</button>`;
}

/**
 * Genera el HTML de la pantalla d'inici de Hypermotion.
 * @param {Array}  nextMatches       Pròxims partits del teu equip (theSportDB)
 * @param {Array}  lastMatches       Últims partits (theSportDB)
 * @param {Map}    predictionsByKey  Mapa match_key → predicció de l'usuari
 * @param {string} teamName          Nom intern de l'equip assignat
 * @returns {string} HTML
 */
export function hyperInfoHtml(nextMatches = [], lastMatches = [], predictionsByKey = new Map(), teamName = '', standings = []) {
  const teamInfo = getTeamInfo(teamName);
  const teamLabel = teamInfo?.displayName ?? teamName ?? 'Equip no assignat';

  let html = '';

  // Capçalera de l'equip
  html += `<div class="hyper-team-banner card">
    <div class="htb-crest">${teamInfo?.crest ?? '⚽'}</div>
    <div class="htb-info">
      <div class="htb-name">${teamLabel}</div>
      <div class="htb-sub muted">El teu equip · Liga Hypermotion 2025-26</div>
    </div>
  </div>`;

  // Pròxims partits (màx. 4)
  const upcomingRaw = nextMatches
    .filter(m => m.dateEvent)
    .slice(0, 4);

  if (upcomingRaw.length > 0) {
    html += '<h3 class="section-h">Pròxims partits</h3>';
    html += upcomingRaw.map(m => {
      const key = m.idEvent;
      const pred = predictionsByKey.get(String(key));
      const locked = isPredictionLocked(m.dateEvent, m.strTime);
      const dateLabel = formatHyperMatchDate(m.dateEvent, m.strTime);
      const isHome = m.idHomeTeam === (teamInfo?.id ?? teamName);
      const opponent = isHome ? m.strAwayTeam : m.strHomeTeam;

      const statusBadge = getMatchStatusBadge(locked, pred);

      return `<div class="hyper-match-card card ${locked ? 'locked' : ''}">
        <div class="hmc-header">
          <span class="hmc-date muted">${dateLabel}</span>
          ${statusBadge}
        </div>
        <div class="hmc-teams">
          <span class="hmc-team ${isHome ? 'hmc-mine' : ''}">${m.strHomeTeam}</span>
          <span class="hmc-vs">vs</span>
          <span class="hmc-team ${!isHome ? 'hmc-mine' : ''}">${m.strAwayTeam}</span>
        </div>
        ${getPredictButton(m, key, locked, pred)}
      </div>`;
    }).join('');
  } else {
    html += '<p class="muted">No hi ha pròxims partits disponibles.</p>';
  }

  // Últims resultats
  const finishedRaw = lastMatches.filter(m => m.intHomeScore != null).slice(0, 5);
  if (finishedRaw.length > 0) {
    html += '<h3 class="section-h">Últims resultats</h3>';
    html += finishedRaw.map(m => {
      const key = m.idEvent;
      const pred = predictionsByKey.get(String(key));
      const pts = pred ? calculateHyperMatchPoints(
        { pred_home: pred.pred_home, pred_away: pred.pred_away },
        { home_goals: Number(m.intHomeScore), away_goals: Number(m.intAwayScore) }
      ) : null;
      const color = pts !== null ? getHyperBadgeColor(pts) : '';
      const dateLabel = formatHyperMatchDate(m.strDate, m.strTime);

      return `<div class="hyper-result-card card">
        <div class="hrc-header">
          <span class="hrc-date muted">${dateLabel}</span>
          ${pts !== null ? `<span class="pts-badge ${color}">${pts}</span>` : ''}
        </div>
        <div class="hrc-match">
          <span class="hrc-team">${m.strHomeTeam}</span>
          <span class="hrc-score">${m.intHomeScore} – ${m.intAwayScore}</span>
          <span class="hrc-team right">${m.strAwayTeam}</span>
        </div>
        ${pred ? `<div class="hrc-pred muted">Pronòstic: ${pred.pred_home}–${pred.pred_away}</div>` : ''}
      </div>`;
    }).join('');
  }

  // Classificació de la lliga
  if (standings.length > 0) {
    html += '<h3 class="section-h">Classificació</h3>';
    html += `<div class="hyper-standings-card card">
      <table class="hyper-standings-table" style="width:100%;border-collapse:collapse;font-size:0.85em;">
        <thead>
          <tr style="text-align:left;opacity:0.7;">
            <th style="padding:4px 6px;">#</th>
            <th style="padding:4px 6px;">Equip</th>
            <th style="padding:4px 6px;text-align:center;">PJ</th>
            <th style="padding:4px 6px;text-align:center;">G</th>
            <th style="padding:4px 6px;text-align:center;">E</th>
            <th style="padding:4px 6px;text-align:center;">P</th>
            <th style="padding:4px 6px;text-align:center;">DG</th>
            <th style="padding:4px 6px;text-align:center;">Pts</th>
          </tr>
        </thead>
        <tbody>
          ${standings.map(row => {
            const isMine = row.idTeam === (teamInfo?.id ?? '') || row.strTeam === teamLabel;
            return `<tr style="${isMine ? 'background:rgba(255,255,255,0.08);font-weight:600;' : ''}border-top:1px solid rgba(255,255,255,0.08);">
              <td style="padding:5px 6px;">${row.intRank}</td>
              <td style="padding:5px 6px;display:flex;align-items:center;gap:6px;">
                ${row.strTeamBadge ? `<img src="${row.strTeamBadge}" alt="" style="width:16px;height:16px;object-fit:contain;" />` : ''}
                ${row.strTeam}
              </td>
              <td style="padding:5px 6px;text-align:center;">${row.intPlayed}</td>
              <td style="padding:5px 6px;text-align:center;">${row.intWin}</td>
              <td style="padding:5px 6px;text-align:center;">${row.intDraw}</td>
              <td style="padding:5px 6px;text-align:center;">${row.intLoss}</td>
              <td style="padding:5px 6px;text-align:center;">${row.intGoalDifference}</td>
              <td style="padding:5px 6px;text-align:center;">${row.intPoints}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
  }

  return html;
}

// ── Renderitzat: Pantalla de Classificació ─────────────────────────────────

/**
 * Genera el HTML de la classificació Hypermotion.
 * @param {Array<{ username, displayName, teamName, points }>} ranking
 * @param {string} currentUsername
 * @returns {string}
 */
export function hyperRankingHtml(ranking = [], currentUsername = '') {
  if (!ranking.length) return '<p class="muted">No hi ha participants a la classificació.</p>';

  const medals = ['🥇', '🥈', '🥉'];

  let html = '<div class="hyper-ranking">';

  ranking.forEach((entry, i) => {
    const isMe = entry.username === currentUsername;
    const teamInfo = getTeamInfo(entry.teamName);
    const crest = teamInfo?.crest ?? '⚽';
    const medal = i < 3 ? medals[i] : '';
    html += `<div class="hyper-rank-item ${isMe ? 'is-me' : ''}">
      <span class="hri-pos">${medal || (i + 1)}</span>
      <span class="hri-crest">${crest}</span>
      <div class="hri-info">
        <span class="hri-name">${entry.displayName || entry.username}</span>
        <span class="hri-team muted">${teamInfo?.displayName ?? entry.teamName ?? ''}</span>
      </div>
      <span class="hri-pts">${entry.points} <span class="pts-label">pts</span></span>
      ${isMe ? '<span class="rank-you">Tu</span>' : ''}
    </div>`;
  });

  html += '</div>';
  return html;
}

// ── Renderitzat: Classificació detallada amb historial de partits ──────────

/**
 * Genera el HTML de la classificació amb el detall de partits de cada jugador.
 * @param {Array<{username, displayName, teamName, predictions: Array, results: Array}>} entries
 * @param {string} currentUsername
 * @param {number} nowMs  Timestamp actual (per detectar si un partit ja va passar la finestra)
 * @returns {string}
 */
export function hyperRankingDetailedHtml(entries = [], currentUsername = '', nowMs = Date.now()) {
  if (!entries.length) return '<p class="muted">No hi ha participants a la classificació.</p>';

  const sorted = [...entries].sort((a, b) => b.points - a.points);
  const medals = ['🥇', '🥈', '🥉'];

  let html = '';

  sorted.forEach((entry, i) => {
    const isMe = entry.username === currentUsername;
    const teamInfo = getTeamInfo(entry.teamName);
    const crest = teamInfo?.crest ?? '⚽';
    const medal = i < 3 ? medals[i] : '';

    // Partits: mostra les prediccions un cop passada la finestra (1h) o acabats
    const visibleMatches = (entry.predictions ?? []).filter(pred => {
      const result = (entry.results ?? []).find(r => r.match_key === pred.match_key);
      const locked = pred.match_date ? isPredictionLocked(pred.match_date, pred.match_time ?? '') : true;
      return locked || result?.home_goals != null;
    });

    const matchRows = visibleMatches.map(pred => {
      const result = (entry.results ?? []).find(r => r.match_key === pred.match_key);
      const pts = result?.home_goals != null
        ? calculateHyperMatchPoints(pred, result)
        : null;
      const color = pts !== null ? getHyperBadgeColor(pts) : 'pts-grey';
      const hasResult = result?.home_goals != null;

      return `<div class="hrd-match-row">
        <span class="hrd-teams">${pred.home_team ?? '?'} vs ${pred.away_team ?? '?'}</span>
        <span class="hrd-pred">${pred.pred_home}–${pred.pred_away}</span>
        ${hasResult
          ? `<span class="hrd-result">${result.home_goals}–${result.away_goals}</span><span class="pts-badge ${color}">${pts}</span>`
          : '<span class="hrd-result muted">–</span><span class="pts-badge pts-grey">?</span>'
        }
      </div>`;
    }).join('');

    html += `<div class="hyper-rank-item ${isMe ? 'is-me' : ''}">
      <span class="hri-pos">${medal || (i + 1)}</span>
      <span class="hri-crest">${crest}</span>
      <div class="hri-info">
        <span class="hri-name">${entry.displayName || entry.username}</span>
        <span class="hri-team muted">${teamInfo?.displayName ?? entry.teamName ?? ''}</span>
      </div>
      <span class="hri-pts">${entry.points} <span class="pts-label">pts</span></span>
      ${isMe ? '<span class="rank-you">Tu</span>' : ''}
    </div>
    ${matchRows ? `<div class="hrd-matches">${matchRows}</div>` : ''}`;
  });

  return `<div class="hyper-ranking">${html}</div>`;
}

// ── Renderitzat: Pantalla del Club ─────────────────────────────────────────

/**
 * Genera el HTML de la pantalla del Club assignat.
 * @param {object|null} tsdbTeam  Dades de theSportDB (lookupteam)
 * @param {string}      teamName  Nom intern (clau a HYPER_TEAMS)
 * @param {Array}       players   Plantilla de theSportDB
 * @returns {string}
 */
export function hyperClubHtml(tsdbTeam = null, teamName = '', players = []) {
  const localInfo = getTeamInfo(teamName);
  const displayName = tsdbTeam?.strTeam ?? localInfo?.displayName ?? teamName ?? '–';
  const stadium = tsdbTeam?.strStadium ?? localInfo?.stadium ?? '–';
  const stadiumCapacity = tsdbTeam?.intStadiumCapacity ? Number(tsdbTeam.intStadiumCapacity).toLocaleString('ca') : '–';
  const location = tsdbTeam?.strLocation ?? localInfo?.city ?? '–';
  const formed = tsdbTeam?.intFormedYear ?? '–';
  const country = tsdbTeam?.strCountry ?? 'Espanya';
  const description = tsdbTeam?.strDescriptionCA || tsdbTeam?.strDescriptionES || tsdbTeam?.strDescriptionEN || '';
  const badgeUrl = tsdbTeam?.strBadge ?? '';
  const crest = localInfo?.crest ?? '⚽';
  const accent = tsdbTeam?.strColour1 ?? null;

  const leagues = [1, 2, 3, 4, 5, 6, 7]
    .map(n => n === 1 ? tsdbTeam?.strLeague : tsdbTeam?.[`strLeague${n}`])
    .filter(l => l && l.trim() !== '');

  const normalizeUrl = (u) => (u ? (u.startsWith('http') ? u : `https://${u}`) : null);
  const links = [
    tsdbTeam?.strWebsite && { label: 'Web', icon: '🌐', url: normalizeUrl(tsdbTeam.strWebsite) },
    tsdbTeam?.strTwitter && { label: 'X', icon: '🐦', url: normalizeUrl(tsdbTeam.strTwitter) },
    tsdbTeam?.strInstagram && { label: 'Instagram', icon: '📷', url: normalizeUrl(tsdbTeam.strInstagram) },
    tsdbTeam?.strFacebook && { label: 'Facebook', icon: '📘', url: normalizeUrl(tsdbTeam.strFacebook) },
    tsdbTeam?.strYoutube && { label: 'YouTube', icon: '▶️', url: normalizeUrl(tsdbTeam.strYoutube) },
  ].filter(Boolean);

  let html = `<div class="hyper-club-card card"${accent ? ` style="border-left:4px solid ${accent}"` : ''}>
    <div class="hcc-header">
      ${badgeUrl
        ? `<img class="hcc-badge" src="${badgeUrl}" alt="${displayName}" />`
        : `<div class="hcc-crest-emoji">${crest}</div>`
      }
      <div class="hcc-titles">
        <h2 class="hcc-name">${displayName}</h2>
        <p class="hcc-sub muted">${location} · ${country}</p>
      </div>
    </div>
    <div class="hcc-details">
      <div class="hcc-row"><span class="hcc-label">Competicions</span><span>${leagues.join(' · ') || '–'}</span></div>
      <div class="hcc-row"><span class="hcc-label">Estadi</span><span>${stadium}</span></div>
      <div class="hcc-row"><span class="hcc-label">Aforament</span><span>${stadiumCapacity}</span></div>
      <div class="hcc-row"><span class="hcc-label">Fundat</span><span>${formed}</span></div>
    </div>`;

  if (description) {
    html += `<p class="hcc-desc">${description.slice(0, 600)}${description.length > 600 ? '…' : ''}</p>`;
  }

  if (links.length > 0) {
    html += `<div class="hcc-links" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;">
      ${links.map(l => `<a class="hcc-link" href="${l.url}" target="_blank" rel="noopener noreferrer"
          style="display:inline-flex;align-items:center;gap:6px;padding:5px 12px;border-radius:999px;
                 background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);
                 color:inherit;text-decoration:none;font-size:0.85em;">
          <span>${l.icon}</span><span>${l.label}</span>
        </a>`).join('')}
    </div>`;
  }

  html += `</div>`;

  // Plantilla
  if (players.length > 0) {
    const goalkeepers = players.filter(p => p.strPosition === 'Goalkeeper');
    const defenders   = players.filter(p => p.strPosition === 'Defender');
    const midfielders = players.filter(p => p.strPosition === 'Midfield');
    const forwards    = players.filter(p => p.strPosition === 'Forward');
    const others      = players.filter(p => !['Goalkeeper','Defender','Midfield','Forward'].includes(p.strPosition));

    const renderGroup = (label, group) => {
      if (!group.length) return '';
      return `<div class="hcc-squad-group">
        <h4 class="hcc-squad-pos">${label}</h4>
        ${group.map(p => `<div class="hcc-player">
          <span class="hcc-player-num">${p.strNumber ?? '–'}</span>
          <span class="hcc-player-name">${p.strPlayer}</span>
          <span class="hcc-player-nat muted">${p.strNationality ?? ''}</span>
        </div>`).join('')}
      </div>`;
    };

    html += `<div class="hyper-club-card card">
      <h3 class="section-h">Plantilla</h3>
      ${renderGroup('Porters', goalkeepers)}
      ${renderGroup('Defensors', defenders)}
      ${renderGroup('Migcampistes', midfielders)}
      ${renderGroup('Davanters', forwards)}
      ${renderGroup('Altres', others)}
    </div>`;
  }

  return html;
}

// ── Renderitzat: Pantalla de Com Funciona ──────────────────────────────────

export function hyperHowToHtml() {
  return `<div class="info-card card">
    <h2>⚽ Com funciona la Porra-League Hypermotion</h2>

    <h3>El teu equip</h3>
    <p>Cada participant té assignat un equip de la <strong>Liga Hypermotion</strong> (2ª Divisió espanyola). L'equip t'és assignat a l'inici de la competició i no canvia.</p>

    <h3>Pronòstics</h3>
    <p>Pots predir el resultat dels partits del teu equip fins a <strong>1 hora abans</strong> de la hora d'inici del partit. Un cop tancat el termini, el pronòstic no es pot modificar.</p>
    <p>Apareixerà el pronòstic dels altres participants 1 hora abans del seu respectiu partit, de manera que es pot veure allò que van posar <em>abans</em> que comenci (i s'acabi i es sàpiga el resultat).</p>

    <h3>Puntuació</h3>
    <table class="info-tbl">
      <thead><tr><th>Condició</th><th>Punts</th></tr></thead>
      <tbody>
        <tr>
          <td>Resultat exacte (ex: predia 2-1, queda 2-1)</td>
          <td><span class="pts-badge pts-green">3</span></td>
        </tr>
        <tr>
          <td>Signe correcte (ex: predia 0-0, queda 1-1)</td>
          <td><span class="pts-badge pts-orange">1</span></td>
        </tr>
        <tr>
          <td>Signe incorrecte</td>
          <td><span class="pts-badge pts-grey">0</span></td>
        </tr>
      </tbody>
    </table>

    <h3>Indicadors de color</h3>
    <ul>
      <li><span class="pts-badge pts-green">●</span> Verd → Resultat exacte (3 pts)</li>
      <li><span class="pts-badge pts-orange">●</span> Taronja → Signe correcte (1 pt)</li>
      <li><span class="pts-badge pts-grey">●</span> Gris → Cap punt (0 pts)</li>
    </ul>

    <p class="info-close"><button class="btn-primary btn-done" onclick="hyperNavigate('info')">Entès!</button></p>
  </div>`;
}

// ── Renderitzat: Formulari de Predicció ────────────────────────────────────

/**
 * Genera el HTML del formulari per predir un partit.
 * @param {{ idEvent, strHomeTeam, strAwayTeam, strDate, strTime }} match
 * @param {{ pred_home, pred_away }|null} existingPred
 * @returns {string}
 */
export function hyperPredictFormHtml(match, existingPred = null) {
  const dateLabel = formatHyperMatchDate(match.strDate, match.strTime ?? '');
  const hasPred = !!existingPred;

  return `<form class="hyper-predict-form card" id="hyper-pred-form-${match.idEvent}"
    data-event="${match.idEvent}"
    data-home="${match.strHomeTeam}"
    data-away="${match.strAwayTeam}"
    data-date="${match.strDate}"
    data-time="${match.strTime ?? ''}">
    <div class="hpf-header">
      <span class="hpf-teams">${match.strHomeTeam} <span class="muted">vs</span> ${match.strAwayTeam}</span>
      <span class="muted hpf-date">${dateLabel}</span>
    </div>
    ${hasPred ? `<div class="bet-last-saved">
      <span class="bet-last-saved-label">Pronòstic guardat</span>
      <strong class="bet-last-saved-score">${existingPred.pred_home}–${existingPred.pred_away}</strong>
    </div>` : ''}
    <div class="bet-teams">
      <span class="bet-team-name">${match.strHomeTeam}</span>
      <div class="bet-score-inputs">
        <input class="bet-home bet-goal-input" type="number" min="0" max="20" placeholder="0" value="${existingPred?.pred_home ?? ''}" required />
        <span class="bet-dash">–</span>
        <input class="bet-away bet-goal-input" type="number" min="0" max="20" placeholder="0" value="${existingPred?.pred_away ?? ''}" required />
      </div>
      <span class="bet-team-name right">${match.strAwayTeam}</span>
    </div>
    <button type="submit" class="btn-primary ${hasPred ? 'btn-edit' : ''}">${hasPred ? 'Edita pronòstic' : 'Envia pronòstic'}</button>
    <p class="bet-status status-msg"></p>
  </form>`;
}
