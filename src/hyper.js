/**
 * hyper.js — Lògica i renderitzat de la Porra-League Hypermotion
 *
 * Font de dades de partits: ESPN API (Spanish LALIGA 2 - esp.2)
 * Font de pronòstics i resultats: Supabase
 */

import { calculateHyperMatchPoints, getHyperBadgeColor, calculateHyperUserTotal } from './hyper-scoring.js';
import { getTeamInfo, getTeamBadgeUrl, HYPER_TEAMS } from './hyper-teams.js';
import HYPER_JORNADES_SCHEDULE from './schedule.json' with { type: 'json' };
export { HYPER_JORNADES_SCHEDULE };

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

const CACHE_KEY = 'espn_league_matches';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hores

// ── ESPN API Endpoints & Cache ─────────────────────────────────────────────
const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.2/scoreboard';
const ESPN_STANDINGS = 'https://site.web.api.espn.com/apis/v2/sports/soccer/esp.2/standings';
const ESPN_TEAM_BASE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/esp.2/teams';


const tsdbMemoryCache = new Map();
let memoryLeagueMatchesCache = null;
let memoryLeagueMatchesTimestamp = 0;

function getTsdbCache(key, ttlMs) {
  const mem = tsdbMemoryCache.get(key);
  if (mem && Date.now() - mem.timestamp < ttlMs) {
    return mem.data;
  }
  try {
    const raw = sessionStorage.getItem(`tsdb_cache_${key}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Date.now() - parsed.timestamp < ttlMs) {
        tsdbMemoryCache.set(key, parsed);
        return parsed.data;
      }
    }
  } catch (e) {
    // Ignore storage issues
  }
  return null;
}

function setTsdbCache(key, data) {
  const item = { timestamp: Date.now(), data };
  tsdbMemoryCache.set(key, item);
  try {
    sessionStorage.setItem(`tsdb_cache_${key}`, JSON.stringify(item));
  } catch (e) {
    // Ignore storage issues
  }
}

/**
 * Converteix un esdeveniment d'ESPN en l'estructura estàndard de partit d'Hypermotion.
 * @param {object} e  Esdeveniment d'ESPN
 * @returns {object|null}
 */
export function espnEventToHyperMatch(e) {
  if (!e) return null;
  const comp = e.competitions?.[0];
  const home = comp?.competitors?.find(c => c.homeAway === 'home');
  const away = comp?.competitors?.find(c => c.homeAway === 'away');
  const isFinished = e.status?.type?.completed === true;
  const isLive = e.status?.type?.state === 'in';
  const dateStr = e.date ? e.date.slice(0, 10) : '';
  const timeStr = e.date ? (e.date.slice(11, 16) + ':00') : '00:00:00';
  const timeMs = e.date ? (Date.parse(e.date) || 0) : 0;

  return {
    idEvent: String(e.id),
    strHomeTeam: home?.team?.name || home?.team?.displayName || '',
    strAwayTeam: away?.team?.name || away?.team?.displayName || '',
    idHomeTeam: String(home?.team?.id || ''),
    idAwayTeam: String(away?.team?.id || ''),
    strDate: dateStr,
    dateEvent: dateStr,
    strTime: timeStr,
    strTimestamp: e.date || '',
    timeMs,
    intHomeScore: isFinished || isLive ? String(home?.score ?? '0') : null,
    intAwayScore: isFinished || isLive ? String(away?.score ?? '0') : null,
    strHomeBadge: home?.team?.logo || '',
    strAwayBadge: away?.team?.logo || '',
    idLeague: 'esp.2',
    strLeague: 'LaLiga Hypermotion',
    status: e.status?.type?.name || 'STATUS_SCHEDULED',
  };
}

/**
 * Consulta l'API d'ESPN per obtenir el calendari complet de partits.
 * @returns {Promise<Array>}
 */
export async function fetchEspnLeagueMatches() {
  try {
    const res = await fetch(`${ESPN_SCOREBOARD}?dates=20260801-20270630&limit=300`);
    if (!res.ok) return [];
    const json = await res.json();
    const events = json.events ?? [];
    return events.map(espnEventToHyperMatch).filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Consulta l'API d'ESPN per obtenir els partits de la jornada actual (tots els 11 partits).
 * @returns {Promise<{ matchdayNumber: number, matches: Array }>}
 */
export async function fetchMatchdayMatches() {
  try {
    const matches = await fetchEspnLeagueMatches();
    if (!Array.isArray(matches) || matches.length === 0) {
      return { matchdayNumber: 1, matches: [] };
    }

    const now = Date.now();
    let targetIndex = matches.findIndex(m => {
      const matchTime = m.timeMs || (m.dateEvent ? new Date(m.dateEvent).getTime() : 0);
      return matchTime >= now - 4 * 60 * 60 * 1000;
    });

    if (targetIndex === -1) {
      targetIndex = matches.length - 1;
    }

    const matchdayIndex = Math.floor(targetIndex / 11);
    const startIndex = matchdayIndex * 11;
    const matchdayMatches = matches.slice(startIndex, startIndex + 11);

    return {
      matchdayNumber: matchdayIndex + 1,
      matches: matchdayMatches,
    };
  } catch {
    return { matchdayNumber: 1, matches: [] };
  }
}

/**
 * Retorna el cache de partits de la lliga des d'ESPN.
 */
export async function getLeagueEventsCache(allTeamIds, { forceRefresh = false } = {}) {
  const now = Date.now();
  if (!forceRefresh && memoryLeagueMatchesCache && (now - memoryLeagueMatchesTimestamp < CACHE_TTL_MS)) {
    return memoryLeagueMatchesCache;
  }

  if (!forceRefresh && typeof localStorage !== 'undefined') {
    const cachedRaw = localStorage.getItem(CACHE_KEY);
    if (cachedRaw) {
      try {
        const parsed = JSON.parse(cachedRaw);
        const age = now - parsed.timestamp;
        if (age < CACHE_TTL_MS && Array.isArray(parsed.data)) {
          memoryLeagueMatchesCache = parsed.data;
          memoryLeagueMatchesTimestamp = parsed.timestamp;
          return parsed.data;
        }
      } catch (e) {
        console.warn('Cache d’ESPN corrupte, es regenera', e);
      }
    }
  }

  const freshData = await fetchEspnLeagueMatches();
  memoryLeagueMatchesCache = freshData;
  memoryLeagueMatchesTimestamp = now;

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: now, data: freshData }));
  }
  return freshData;
}

/**
 * Calcula la jornada associada a una data de partit basant-se en el literal de referència.
 * Assigna la jornada del diumenge més proper a la data del partit.
 * @param {string} matchDateStr Data en format YYYY-MM-DD
 * @returns {number} Número de jornada (1-42)
 */
function getJornadaFromLiteral(matchDateStr) {
  if (!matchDateStr) return 1;
  const matchMs = new Date(matchDateStr).getTime();

  let minDiff = Infinity;
  let bestJornada = 1;

  for (const item of HYPER_JORNADES_SCHEDULE) {
    const refMs = new Date(item.dateRef).getTime();
    const diff = Math.abs(matchMs - refMs);
    if (diff < minDiff) {
      minDiff = diff;
      bestJornada = item.jornada;
    }
  }

  return bestJornada;
}

/**
 * Sincronitza els resultats finalitzats d'ESPN a la taula `hyper_results` de Supabase.
 * Inclou la columna `jornada`, calculada a partir de la posició del partit al calendari
 * complet (grups de 11 partits per jornada).
 * @param {object} dbClient Client de Supabase
 * @returns {Promise<boolean>}
 */
export async function syncHyperResults(dbClient) {
  if (!dbClient) return false;
  try {
    const matches = await fetchEspnLeagueMatches();
    if (!Array.isArray(matches) || matches.length === 0) return false;

    const finishedMatches = matches.filter(m => m.intHomeScore != null && m.intAwayScore != null);
    if (finishedMatches.length === 0) return false;

    const indexMap = new Map(matches.map((m, i) => [m, i]));
    const rowsToUpsert = finishedMatches.map(m => {
      // Si el partit ja porta la jornada d'origen s'usa, si no la calculem amb el literal
      const jornada = m.jornada ? Number(m.jornada) : getJornadaFromLiteral(m.strDate);
      const idx = indexMap.get(m) ?? 0;
      return {
        match_key: String(m.idEvent),
        home_team: m.strHomeTeam,
        away_team: m.strAwayTeam,
        home_goals: parseInt(m.intHomeScore, 10),
        away_goals: parseInt(m.intAwayScore, 10),
        match_date: m.strDate || null,
        jornada,
      };
    });

    const { error } = await dbClient
      .from('hyper_results')
      .upsert(rowsToUpsert, { onConflict: 'match_key' });

    if (error) {
      console.error('Error sincronitzant hyper_results des d\'ESPN:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error en syncHyperResults:', err);
    return false;
  }
}

export async function getLeagueLastEventsCache(allTeamIds, options = {}) {
  return getLeagueEventsCache(allTeamIds, options);
}

/**
 * Obté els pròxims partits de cada equip de la lliga (compatibilitat).
 */
export async function fetchAllUpcomingLeagueMatches(allTeamIds) {
  const matches = await getLeagueEventsCache(allTeamIds);
  const eventsByTeam = new Map();
  if (Array.isArray(matches)) {
    for (const m of matches) {
      if (m.intHomeScore == null) {
        if (!eventsByTeam.has(m.idHomeTeam)) eventsByTeam.set(m.idHomeTeam, m);
        if (!eventsByTeam.has(m.idAwayTeam)) eventsByTeam.set(m.idAwayTeam, m);
      }
    }
  }
  return eventsByTeam;
}

/**
 * Obté els últims partits de cada equip de la lliga (compatibilitat).
 */
export async function fetchAllPastLeagueMatches(allTeamIds) {
  const matches = await getLeagueEventsCache(allTeamIds);
  const eventsByTeam = new Map();
  if (Array.isArray(matches)) {
    for (const m of matches) {
      if (m.intHomeScore != null) {
        if (!eventsByTeam.has(m.idHomeTeam)) eventsByTeam.set(m.idHomeTeam, []);
        if (!eventsByTeam.has(m.idAwayTeam)) eventsByTeam.set(m.idAwayTeam, []);
        eventsByTeam.get(m.idHomeTeam).push(m);
        eventsByTeam.get(m.idAwayTeam).push(m);
      }
    }
  }
  return eventsByTeam;
}

export function dedupeEvents(eventsByTeam) {
  const seen = new Map();
  if (eventsByTeam instanceof Map) {
    for (const ev of eventsByTeam.values()) {
      if (Array.isArray(ev)) {
        for (const item of ev) {
          if (item?.idEvent) seen.set(item.idEvent, item);
        }
      } else if (ev?.idEvent) {
        seen.set(ev.idEvent, ev);
      }
    }
  } else if (Array.isArray(eventsByTeam)) {
    for (const ev of eventsByTeam) {
      if (ev?.idEvent) seen.set(ev.idEvent, ev);
    }
  }
  return [...seen.values()];
}

export function getNextMatchesForTeam(eventsByTeam, teamId) {
  const info = getTeamInfo(teamId);
  const espnId = info?.id ? String(info.id) : String(teamId);
  const tsdbId = info?.tsdbId ? String(info.tsdbId) : null;
  const teamLabel = info?.displayName || teamId;

  if (Array.isArray(eventsByTeam)) {
    return eventsByTeam.filter(
      m => (m.idHomeTeam === espnId || m.idAwayTeam === espnId || (tsdbId && (m.idHomeTeam === tsdbId || m.idAwayTeam === tsdbId)) || m.strHomeTeam === teamLabel || m.strAwayTeam === teamLabel) && m.intHomeScore == null
    );
  }
  if (eventsByTeam instanceof Map) {
    const found = [];
    for (const ev of eventsByTeam.values()) {
      const list = Array.isArray(ev) ? ev : [ev];
      for (const m of list) {
        if (!m) continue;
        if (m.intHomeScore == null && (m.idHomeTeam === espnId || m.idAwayTeam === espnId || (tsdbId && (m.idHomeTeam === tsdbId || m.idAwayTeam === tsdbId)) || m.strHomeTeam === teamLabel || m.strAwayTeam === teamLabel)) {
          found.push(m);
        }
      }
    }
    return dedupeEvents(found);
  }
  return [];
}

export function getLastMatchesForTeam(eventsByTeam, teamId) {
  const info = getTeamInfo(teamId);
  const espnId = info?.id ? String(info.id) : String(teamId);
  const tsdbId = info?.tsdbId ? String(info.tsdbId) : null;
  const teamLabel = info?.displayName || teamId;

  if (Array.isArray(eventsByTeam)) {
    return eventsByTeam.filter(
      m => (m.idHomeTeam === espnId || m.idAwayTeam === espnId || (tsdbId && (m.idHomeTeam === tsdbId || m.idAwayTeam === tsdbId)) || m.strHomeTeam === teamLabel || m.strAwayTeam === teamLabel) && m.intHomeScore != null
    );
  }
  if (eventsByTeam instanceof Map) {
    const found = [];
    for (const ev of eventsByTeam.values()) {
      const list = Array.isArray(ev) ? ev : [ev];
      for (const m of list) {
        if (!m) continue;
        if (m.intHomeScore != null && (m.idHomeTeam === espnId || m.idAwayTeam === espnId || (tsdbId && (m.idHomeTeam === tsdbId || m.idAwayTeam === tsdbId)) || m.strHomeTeam === teamLabel || m.strAwayTeam === teamLabel)) {
          found.push(m);
        }
      }
    }
    return dedupeEvents(found);
  }
  return [];
}

const ALL_TEAM_IDS = Object.values(HYPER_TEAMS).map(team => team.id);

/**
 * Obté els pròxims partits d'un equip des d'ESPN.
 * @param {string} teamId  ID d'ESPN / TSDB o nom intern
 * @returns {Promise<Array>}
 */
export async function fetchTeamNextMatches(teamId) {
  if (!teamId) return [];
  const info = getTeamInfo(teamId);
  const espnId = info?.id ? String(info.id) : String(teamId);
  const tsdbId = info?.tsdbId ? String(info.tsdbId) : null;
  const teamLabel = info?.displayName || teamId;

  const cacheKey = `next_team_${espnId}`;
  const cached = getTsdbCache(cacheKey, 5 * 60 * 1000);
  if (cached) return cached;

  const allMatches = await getLeagueEventsCache(ALL_TEAM_IDS);
  const matches = allMatches
    .filter(m =>
      m.idHomeTeam === espnId ||
      m.idAwayTeam === espnId ||
      (tsdbId && (m.idHomeTeam === tsdbId || m.idAwayTeam === tsdbId)) ||
      m.strHomeTeam === teamLabel ||
      m.strAwayTeam === teamLabel
    )
    .filter(m => m.intHomeScore == null)
    .sort((a, b) => (a.timeMs || 0) - (b.timeMs || 0));

  setTsdbCache(cacheKey, matches);
  return matches;
}

/**
 * Obté els últims partits d'un equip des d'ESPN.
 * @param {string} teamId  ID d'ESPN / TSDB o nom intern
 * @returns {Promise<Array>}
 */
export async function fetchTeamLastMatches(teamId) {
  if (!teamId) return [];
  const info = getTeamInfo(teamId);
  const espnId = info?.id ? String(info.id) : String(teamId);
  const tsdbId = info?.tsdbId ? String(info.tsdbId) : null;
  const teamLabel = info?.displayName || teamId;

  const cacheKey = `last_${espnId}`;
  const cached = getTsdbCache(cacheKey, 5 * 60 * 1000);
  if (cached) return cached;

  const allMatches = await getLeagueEventsCache(ALL_TEAM_IDS);
  const matches = allMatches
    .filter(m =>
      m.idHomeTeam === espnId ||
      m.idAwayTeam === espnId ||
      (tsdbId && (m.idHomeTeam === tsdbId || m.idAwayTeam === tsdbId)) ||
      m.strHomeTeam === teamLabel ||
      m.strAwayTeam === teamLabel
    )
    .filter(m => m.intHomeScore != null)
    .sort((a, b) => (b.timeMs || 0) - (a.timeMs || 0));

  setTsdbCache(cacheKey, matches);
  return matches;
}

/**
 * Obté els detalls d'un equip des d'ESPN API.
 * @param {string} teamId  ID d'ESPN / TSDB o nom intern
 * @returns {Promise<object|null>}
 */
export async function fetchTeamDetails(teamId) {
  if (!teamId) return null;
  const info = getTeamInfo(teamId);
  const espnId = info?.id ? String(info.id) : String(teamId);

  const cacheKey = `details_${espnId}`;
  const cached = getTsdbCache(cacheKey, 60 * 60 * 1000);
  if (cached) return cached;

  try {
    const res = await fetch(`${ESPN_TEAM_BASE}/${espnId}`);
    if (!res.ok) return null;
    const json = await res.json();
    const team = json.team || {};

    const clubhouseLink = team.links?.find(l => l.rel?.includes('clubhouse') && l.rel?.includes('desktop'))?.href || '';
    const statsLink = team.links?.find(l => l.rel?.includes('stats') && l.rel?.includes('desktop'))?.href || '';
    const fixturesLink = team.links?.find(l => l.rel?.includes('schedule') && l.rel?.includes('desktop'))?.href || '';

    const teamObj = {
      idTeam: espnId,
      strTeam: team.displayName || info?.displayName || '',
      strName: team.name || '',
      strLocation: team.location || info?.city || '',
      strAbbreviation: team.abbreviation || info?.shortName || '',
      strBadge: team.logos?.[0]?.href || '',
      strBadgeDark: team.logos?.find(l => l.rel?.includes('dark'))?.href || '',
      strStadium: info?.stadium || '–',
      strLeague: 'LaLiga Hypermotion',
      strColour1: team.color ? `#${team.color}` : null,
      strColour2: team.alternateColor ? `#${team.alternateColor}` : null,
      recordSummary: team.record?.items?.[0]?.summary || '',
      nextEventName: team.nextEvent?.[0]?.name || '',
      strWebsite: clubhouseLink,
      statsUrl: statsLink,
      fixturesUrl: fixturesLink,
      links: [
        clubhouseLink && { label: 'Fitxa ESPN', icon: '🌐', url: clubhouseLink },
        statsLink && { label: 'Estadístiques', icon: '📊', url: statsLink },
        fixturesLink && { label: 'Calendari', icon: '📅', url: fixturesLink },
      ].filter(Boolean),
    };
    setTsdbCache(cacheKey, teamObj);
    return teamObj;
  } catch {
    return null;
  }
}

/**
 * Obté la plantilla de l'equip des d'ESPN API.
 * @param {string} teamId  ID d'ESPN / TSDB o nom intern
 * @returns {Promise<Array>}
 */
export async function fetchTeamPlayers(teamId) {
  if (!teamId) return [];
  const info = getTeamInfo(teamId);
  const espnId = info?.id ? String(info.id) : String(teamId);

  const cacheKey = `players_${espnId}`;
  const cached = getTsdbCache(cacheKey, 60 * 60 * 1000);
  if (cached) return cached;

  try {
    const res = await fetch(`${ESPN_TEAM_BASE}/${espnId}/roster`);
    if (!res.ok) return [];
    const json = await res.json();
    const rawAthletes = json.athletes || json.entries || [];
    const players = rawAthletes.map(a => {
      let pos = a.position?.name || '';
      if (pos === 'Midfielder') pos = 'Midfield';
      return {
        strPlayer: a.fullName || a.displayName || '',
        strPosition: pos,
        strNumber: a.jersey || '–',
        strNationality: a.citizenship || a.citizenshipCountry?.abbreviation || '',
      };
    });
    setTsdbCache(cacheKey, players);
    return players;
  } catch {
    return [];
  }
}

/**
 * Obté la classificació de la lliga des d'ESPN API.
 * @param {string} leagueId
 * @param {string} leagueYear
 * @returns {Promise<Array>}
 */
export async function fetchHyperStandings(leagueId = 'esp.2', leagueYear = '2026-2027') {
  const cacheKey = `standings_${leagueId}_${leagueYear}`;
  const cached = getTsdbCache(cacheKey, 15 * 60 * 1000);
  if (cached) return cached;

  try {
    const res = await fetch(ESPN_STANDINGS);
    if (!res.ok) throw new Error(`ESPN standings error ${res.status}`);
    const json = await res.json();
    const entries = json.children?.[0]?.standings?.entries || json.standings?.entries || [];
    const table = entries.map(entry => {
      const getStat = (name) => {
        const s = entry.stats?.find(x => x.name === name);
        return s ? Number(s.value) : 0;
      };
      return {
        idTeam: String(entry.team?.id || ''),
        strTeam: entry.team?.name || entry.team?.displayName || '',
        strTeamBadge: entry.team?.logos?.[0]?.href || '',
        intRank: getStat('rank'),
        intPlayed: getStat('gamesPlayed'),
        intWin: getStat('wins'),
        intDraw: getStat('ties'),
        intLoss: getStat('losses'),
        intGoalDifference: getStat('pointDifferential'),
        intPoints: getStat('points'),
      };
    });
    setTsdbCache(cacheKey, table);
    return table;
  } catch {
    return [];
  }
}

// ── Helpers de format ──────────────────────────────────────────────────────

/**
 * Formata una data (format: "2025-09-13" o ISO) en català.
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

/**
 * Genera el HTML d'una secció plegable (collapsible).
 */
function renderCollapsibleSection(id, title, contentHtml, defaultOpen = true) {
  if (!contentHtml) return '';
  return `<div class="collapsible-section ${defaultOpen ? '' : 'collapsed'}" id="${id}">
    <div class="collapsible-header" onclick="toggleSection('${id}')">
      <h3 class="section-h">${title}</h3>
      <span class="collapse-icon">▼</span>
    </div>
    <div class="collapsible-content">
      ${contentHtml}
    </div>
  </div>`;
}

if (typeof window !== 'undefined') {
  window.toggleSection = function(id) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('collapsed');
  };
}

function getMatchStatusBadge(locked, pred, isHypermotion = true) {
  if (!isHypermotion) return '';
  if (locked) {
    return pred
      ? `<span class="hyper-pred-locked">🔒 ${pred.pred_home}–${pred.pred_away}</span>`
      : `<span class="hyper-badge-warn">⚠️ Sense pronòstic</span>`;
  }
  return pred
    ? `<span class="hyper-badge-ok">✅ Pronòstic fet: ${pred.pred_home}–${pred.pred_away}</span>`
    : `<span class="hyper-badge-warn">⚠️ Pronòstic pendent</span>`;
}

function getPredictButton(m, key, locked, pred, isHypermotion = true) {
  if (!isHypermotion || locked) return '';
  const label = pred ? 'Edita pronòstic' : 'Predir resultat';
  const extraClass = pred ? ' btn-edit' : '';
  const matchDate = m.dateEvent || m.strDate || '';
  return `<button class="btn-primary${extraClass} hyper-predict-btn" data-event="${key}" data-home="${escHtml(m.strHomeTeam)}" data-away="${escHtml(m.strAwayTeam)}" data-date="${escHtml(matchDate)}" data-time="${escHtml(m.strTime ?? '')}">${label}</button>`;
}

/**
 * Genera el HTML de la pantalla d'inici de Hypermotion.
 * @param {Array}  nextMatches       Pròxims partits del teu equip
 * @param {Array}  lastMatches       Últims partits
 * @param {Map}    predictionsByKey  Mapa match_key → predicció de l'usuari
 * @param {string} teamName          Nom intern de l'equip assignat
 * @param {Array}  standings         Classificació de la lliga
 * @param {object|Array} matchdayData Objecte { matchdayNumber, matches } o array de partits
 * @returns {string} HTML
 */
export function hyperInfoHtml(nextMatches = [], lastMatches = [], predictionsByKey = new Map(), teamName = '', standings = [], matchdayData = {}) {
  const teamInfo = getTeamInfo(teamName);
  const badgeUrl = getTeamBadgeUrl(teamName);
  const teamLabel = teamInfo?.displayName ?? teamName ?? 'Equip no assignat';

  const matchdayMatches = Array.isArray(matchdayData) ? matchdayData : (matchdayData?.matches ?? []);
  const matchdayNumStr = matchdayData?.matchdayNumber ? ` ${matchdayData.matchdayNumber}` : '';
  const matchdayTitle = `Partits de la jornada${matchdayNumStr}`;

  let html = '';

  const crestHtml = badgeUrl
    ? `<img src="${escHtml(badgeUrl)}" alt="${escHtml(teamLabel)}" class="htb-badge-img" style="width:36px;height:36px;object-fit:contain;" />`
    : `${teamInfo?.crest ?? '⚽'}`;

  // Capçalera de l'equip
  html += `<div class="hyper-team-banner card">
    <div class="htb-crest">${crestHtml}</div>
    <div class="htb-info">
      <div class="htb-name">${escHtml(teamLabel)}</div>
      <div class="htb-sub muted">El teu equip · Liga Hypermotion</div>
    </div>
  </div>`;

  // 1. Pròxims partits
  const upcomingRaw = nextMatches
    .filter(m => m.dateEvent || m.strDate)
    .slice(0, 4);

  let upcomingHtml = '';
  if (upcomingRaw.length > 0) {
    upcomingHtml = '<div class="hyper-matches-grid">' + upcomingRaw.map(m => {
      const key = m.idEvent;
      const matchDate = m.dateEvent || m.strDate || '';
      const pred = predictionsByKey.get(String(key));
      const isHypermotion = String(m.idLeague ?? '') === 'esp.2' || String(m.idLeague ?? '') === '4400';
      const locked = isPredictionLocked(matchDate, m.strTime);
      const dateLabel = formatHyperMatchDate(matchDate, m.strTime);
      const isHome = m.idHomeTeam === (teamInfo?.id ?? teamName) || m.strHomeTeam === teamLabel;

      const statusBadge = getMatchStatusBadge(locked, pred, isHypermotion);
      const predictBtn = getPredictButton(m, key, locked, pred, isHypermotion);

      return `<div class="hyper-match-card card ${locked || !isHypermotion ? 'locked' : ''}">
        <div class="hmc-header">
          <div class="hmc-meta-row">
            <span class="hmc-date muted">${dateLabel}</span>
            <span class="hmc-league muted">${escHtml(m.strLeague ?? '')}</span>
          </div>
          <div class="hmc-status-row">
            ${statusBadge}
          </div>
        </div>
        <div class="hmc-teams">
          <span class="hmc-team ${isHome ? 'hmc-mine' : ''}">${escHtml(m.strHomeTeam)}</span>
          <span class="hmc-vs">vs</span>
          <span class="hmc-team ${!isHome ? 'hmc-mine' : ''}">${escHtml(m.strAwayTeam)}</span>
        </div>
        ${predictBtn}
      </div>`;
    }).join('') + '</div>';
  } else {
    upcomingHtml = '<p class="muted">No hi ha pròxims partits disponibles.</p>';
  }
  html += renderCollapsibleSection('hyper-sec-upcoming', 'Pròxims partits', upcomingHtml, true);

  // 2. Últims resultats
  const finishedRaw = lastMatches.filter(m => m.intHomeScore != null).slice(0, 5);
  let finishedHtml = '';
  if (finishedRaw.length > 0) {
    finishedHtml = '<div class="hyper-results-grid">' + finishedRaw.map(m => {
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
          <span class="hrc-team">${escHtml(m.strHomeTeam)}</span>
          <span class="hrc-score">${m.intHomeScore} – ${m.intAwayScore}</span>
          <span class="hrc-team right">${escHtml(m.strAwayTeam)}</span>
        </div>
        ${pred ? `<div class="hrc-pred muted">Pronòstic: ${pred.pred_home}–${pred.pred_away}</div>` : ''}
      </div>`;
    }).join('') + '</div>';
  } else {
    finishedHtml = '<p class="muted">No hi ha resultats recents.</p>';
  }
  html += renderCollapsibleSection('hyper-sec-last', 'Últims resultats', finishedHtml, true);

  // 3. Classificació de la lliga
  if (standings.length > 0) {
    const standingsHtml = `<div class="hyper-standings-card card">
      <table class="hyper-standings-table">
        <thead>
          <tr>
            <th class="hst-rank">#</th>
            <th class="hst-team">Equip</th>
            <th class="hst-pj">PJ</th>
            <th class="hst-opt">G</th>
            <th class="hst-opt">E</th>
            <th class="hst-opt">P</th>
            <th class="hst-opt">DG</th>
            <th class="hst-pts">Pts</th>
          </tr>
        </thead>
        <tbody>
          ${standings.map(row => {
            const isMine = row.idTeam === (teamInfo?.id ?? '') || row.strTeam === teamLabel;
            return `<tr class="${isMine ? 'is-mine' : ''}">
              <td class="hst-rank">${row.intRank}</td>
              <td class="hst-team">
                ${row.strTeamBadge ? `<img class="hst-badge" src="${row.strTeamBadge}" alt="" />` : ''}
                <span class="hst-name">${escHtml(row.strTeam)}</span>
              </td>
              <td class="hst-pj">${row.intPlayed}</td>
              <td class="hst-opt">${row.intWin}</td>
              <td class="hst-opt">${row.intDraw}</td>
              <td class="hst-opt">${row.intLoss}</td>
              <td class="hst-opt">${row.intGoalDifference}</td>
              <td class="hst-pts">${row.intPoints}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
    html += renderCollapsibleSection('hyper-sec-standings', 'Classificació', standingsHtml, true);
  }

  // 4. Partits de la jornada (a sota de tot) — llistat informatiu en una sola card
  if (matchdayMatches && matchdayMatches.length > 0) {
    const matchdayHtml = `<div class="hyper-matchday-container card">
      ${matchdayMatches.map(m => {
        const key = m.idEvent;
        const pred = predictionsByKey.get(String(key));
        const dateLabel = formatHyperMatchDate(m.strDate, m.strTime);

        const homeBadge = m.strHomeBadge || getTeamBadgeUrl(m.idHomeTeam || m.strHomeTeam);
        const awayBadge = m.strAwayBadge || getTeamBadgeUrl(m.idAwayTeam || m.strAwayTeam);

        const isFinished = m.intHomeScore != null;
        const pts = (isFinished && pred) ? calculateHyperMatchPoints(
          { pred_home: pred.pred_home, pred_away: pred.pred_away },
          { home_goals: Number(m.intHomeScore), away_goals: Number(m.intAwayScore) }
        ) : null;
        const color = pts !== null ? getHyperBadgeColor(pts) : '';

        return `<div class="hmc-row">
          <div class="hmc-row-header">
            <span class="hmc-date muted">${dateLabel}</span>
            ${isFinished && pts !== null ? `<span class="pts-badge ${color}">${pts} pts</span>` : ''}
          </div>
          <div class="hmc-row-main">
            <div class="hmc-team-box home">
              ${homeBadge ? `<img src="${escHtml(homeBadge)}" alt="" class="hmc-badge" />` : ''}
              <span class="hmc-team-name">${escHtml(m.strHomeTeam)}</span>
            </div>
            <div class="hmc-score-box">
              ${isFinished
                ? `<span class="hmc-score-num">${m.intHomeScore} – ${m.intAwayScore}</span>`
                : `<span class="hmc-vs">vs</span>`
              }
            </div>
            <div class="hmc-team-box away">
              <span class="hmc-team-name">${escHtml(m.strAwayTeam)}</span>
              ${awayBadge ? `<img src="${escHtml(awayBadge)}" alt="" class="hmc-badge" />` : ''}
            </div>
          </div>
          ${pred ? `<div class="hmc-row-pred muted">El teu pronòstic: ${pred.pred_home}–${pred.pred_away}</div>` : ''}
        </div>`;
      }).join('')}
    </div>`;

    html += renderCollapsibleSection('hyper-sec-matchday', matchdayTitle, matchdayHtml, true);
  }

  return html;
}

// ── Renderitzat: Pantalla de Classificació ─────────────────────────────────

/**
 * Genera l'HTML de l'avatar d'un usuari amb la imatge/inicials i l'escut de l'API.
 * @param {object} params
 * @param {string} params.username
 * @param {string} [params.avatarUrl]
 * @param {string} [params.teamName]
 * @returns {string}
 */
export function hyperAvatarHtml({ username = '', avatarUrl = '', teamName = '' } = {}) {
  const rawAvatarUrl = avatarUrl ?? '';
  const safeAvatarUrl = /^https?:\/\//.test(rawAvatarUrl) ? rawAvatarUrl : '';
  const initials = (username || '').slice(0, 2);
  const teamInfo = getTeamInfo(teamName);
  const badgeUrl = getTeamBadgeUrl(teamName);
  const fallbackCrest = teamInfo?.crest ?? '';

  const avatarContentHtml = safeAvatarUrl
    ? `<img src="${escHtml(safeAvatarUrl)}" alt="avatar" class="ha-avatar-img" />`
    : escHtml(initials);

  const crestBadgeHtml = badgeUrl
    ? `<img src="${escHtml(badgeUrl)}" alt="" class="ha-crest-img" />`
    : fallbackCrest;

  const bgStyle = safeAvatarUrl ? ' style="background:var(--card-bg, #12141c);"' : '';

  return `<div class="avatar hyper-avatar-wrap">
    <div class="ha-initials"${bgStyle}>${avatarContentHtml}</div>
    <div class="ha-crest">${crestBadgeHtml}</div>
  </div>`;
}

/**
 * Genera el HTML de la classificació Hypermotion.
 * @param {Array<{ username, displayName, teamName, avatarUrl, points }>} ranking
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
    const medal = i < 3 ? medals[i] : '';
    const avatarHtml = hyperAvatarHtml({
      username: entry.username,
      avatarUrl: entry.avatarUrl ?? entry.avatar_url,
      teamName: entry.teamName
    });

    html += `<div class="hyper-rank-item ${isMe ? 'is-me' : ''}">
      <span class="hri-pos">${medal || (i + 1)}</span>
      ${avatarHtml}
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
 * @param {Array<{username, displayName, teamName, avatarUrl, predictions: Array, results: Array}>} entries
 * @param {string} currentUsername
 * @param {number} nowMs  Timestamp actual (per detectar si un partit ja va passar la finestra)
 * @returns {string}
 */
export function hyperRankingDetailedHtml(entries = [], currentUsername = '', nowMs = Date.now()) {
  if (!entries.length) return '<p class="muted">No hi ha participants a la classificació.</p>';

  const sorted = [...entries].sort((a, b) => b.points - a.points);
  const medals = ['🥇', '🥈', '🥉'];

  let html = '';

  html += `<div class="hyper-ranking-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
    <span class="section-h" style="margin:0;">Classificació</span>
    <button class="btn-link-muted hyper-toggle-all-btn" onclick="toggleAllHyperMatches()">👁️ Obrir / Tancar tots</button>
  </div>`;

  sorted.forEach((entry, i) => {
    const isMe = entry.username === currentUsername;
    const teamInfo = getTeamInfo(entry.teamName);
    const medal = i < 3 ? medals[i] : '';
    const avatarHtml = hyperAvatarHtml({
      username: entry.username,
      avatarUrl: entry.avatarUrl ?? entry.avatar_url,
      teamName: entry.teamName
    });

    // Partits: mostra les prediccions un cop passada la finestra (1h) o acabats
    const visibleMatches = (entry.predictions ?? []).filter(pred => {
      const result = (entry.results ?? []).find(r => r.match_key === pred.match_key);
      const locked = pred.match_date ? isPredictionLocked(pred.match_date, pred.match_time ?? '') : true;
      return locked || result?.home_goals != null;
    });

    const matchRowsHtml = visibleMatches.map(pred => {
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

    const panelId = `hyper-user-matches-${entry.username}`;
    const matchContent = matchRowsHtml || '<p class="muted" style="padding:.4rem 0;font-size:.8rem;text-align:center;">Sense pronòstics visibles encara.</p>';

    html += `<div class="hyper-rank-item ${isMe ? 'is-me' : ''}" onclick="toggleHyperPlayerPronos('${entry.username}')">
      <span class="hri-pos">${medal || (i + 1)}</span>
      ${avatarHtml}
      <div class="hri-info">
        <span class="hri-name">${entry.displayName || entry.username}</span>
        <span class="hri-team muted">${teamInfo?.displayName ?? entry.teamName ?? ''}</span>
      </div>
      <span class="hri-pts">${entry.points} <span class="pts-label">pts</span></span>
      ${isMe ? '<span class="rank-you">Tu</span>' : ''}
      <span class="rank-arrow muted">›</span>
    </div>
    <div class="hrd-matches hidden" id="${panelId}">
      ${matchContent}
      <button class="btn-close-panel" onclick="toggleHyperPlayerPronos('${entry.username}')">✕ Tancar</button>
    </div>`;
  });

  return `<div class="hyper-ranking">${html}</div>`;
}

// ── Renderitzat: Pantalla del Club ─────────────────────────────────────────

/**
 * Genera el HTML de la pantalla del Club assignat.
 * @param {object|null} tsdbTeam  Dades d'ESPN (lookupteam / team)
 * @param {string}      teamName  Nom intern (clau a HYPER_TEAMS)
 * @param {Array}       players   Plantilla d'ESPN
 * @returns {string}
 */
export function hyperClubHtml(tsdbTeam = null, teamName = '', players = []) {
  const localInfo = getTeamInfo(teamName);
  const displayName = tsdbTeam?.strTeam ?? localInfo?.displayName ?? teamName ?? '–';
  const stadium = localInfo?.stadium ?? tsdbTeam?.strStadium ?? '–';
  const location = tsdbTeam?.strLocation ?? localInfo?.city ?? '–';
  const country = 'Espanya';
  const badgeUrl = tsdbTeam?.strBadge || getTeamBadgeUrl(teamName) || '';
  const crest = localInfo?.crest ?? '⚽';
  const accent = tsdbTeam?.strColour1 ?? null;
  const abbreviation = tsdbTeam?.strAbbreviation ?? localInfo?.shortName ?? '';
  const record = tsdbTeam?.recordSummary ?? '';
  const nextEvent = tsdbTeam?.nextEventName ?? '';
  const links = tsdbTeam?.links ?? [];

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
      <div class="hcc-row"><span class="hcc-label">Competicions</span><span>LaLiga Hypermotion</span></div>
      <div class="hcc-row"><span class="hcc-label">Estadi</span><span>${stadium}</span></div>
      ${abbreviation ? `<div class="hcc-row"><span class="hcc-label">Codi</span><span>${abbreviation}</span></div>` : ''}
      ${record ? `<div class="hcc-row"><span class="hcc-label">Balanç</span><span>${record}</span></div>` : ''}
      ${nextEvent ? `<div class="hcc-row"><span class="hcc-label">Pròxim partit</span><span>${nextEvent}</span></div>` : ''}
    </div>`;

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
    const defenders = players.filter(p => p.strPosition === 'Defender');
    const midfielders = players.filter(p => p.strPosition === 'Midfield' || p.strPosition === 'Midfielder');
    const forwards = players.filter(p => p.strPosition === 'Forward');
    const others = players.filter(p => !['Goalkeeper', 'Defender', 'Midfield', 'Midfielder', 'Forward'].includes(p.strPosition));

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
