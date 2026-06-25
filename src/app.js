import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { calculateGroupPoints, calculateGroupPointsDetailed, calculateKnockoutPoints, calculateCrystalBallPoints } from './scoring.js';
import {
  fetchWCData,
  matchesSectionHtml,
  standingsHtml,
  knockoutBracketHtml,
  formatMatchDateTime,
  isPlaceholderName,
} from './mundial.js';
import { teamWithFlag, getFlag } from './flags.js';

// ── Supabase ──────────────────────────────────────────────────────────────
const cfg = window.__SUPABASE_CONFIG ?? { url: '', anonKey: '' };
const supabase = cfg.url && cfg.anonKey ? createClient(cfg.url, cfg.anonKey) : null;

// ── State ─────────────────────────────────────────────────────────────────
let currentUser = null;
let wc = null;          // cached ESPN data
let wcFetchedAt = 0;    // timestamp of last fetch
let homeRefreshTimer = null;
const WC_TTL_NORMAL = 3 * 60 * 1000;   // 3 min cache when no live match
const WC_TTL_LIVE   = 45 * 1000;        // 45 s cache when live match

// ── Auth ──────────────────────────────────────────────────────────────────
async function hashPwd(p) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(p));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function login(username, password) {
  const hash = await hashPwd(password);
  const raw = username.trim();
  const uname = raw.toUpperCase();

  // Usuari test hardcoded — sempre accessible independentment de Supabase
  const testHash = await hashPwd('TST');
  if (raw.toLowerCase() === 'TST' && hash === testHash) {
    return { username: 'TST', display_name: 'Test User' };
  }

  if (supabase) {
    // Prova uppercase (format inicials: MVF, AOG…) i lowercase com a fallback
    const { data, error } = await supabase
      .from('participants')
      .select('username, display_name')
      .eq('username', uname)
      .eq('password_hash', hash)
      .maybeSingle();
    if (error) throw new Error('Error de connexió');
    if (!data) throw new Error('Usuari o contrasenya incorrectes');
    return data;
  }

  throw new Error('Usuari o contrasenya incorrectes');
}

// ── UI helpers ────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const show = id => $(id)?.classList.remove('hidden');
const hide = id => $(id)?.classList.add('hidden');

function setStatus(id, msg, isErr = false) {
  const el = $(id);
  if (!el) return;
  el.textContent = msg;
  el.className = isErr ? 'status-msg error' : 'status-msg ok';
}

// ── Navigation ────────────────────────────────────────────────────────────
function navigate(section) {
  ['principal', 'porra', 'mundial'].forEach(s => {
    document.getElementById(`screen-${s}`)?.classList.toggle('hidden', s !== section);
  });
  document.querySelectorAll('.nav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.nav === section));

  // Cancel home auto-refresh when leaving
  if (section !== 'principal' && homeRefreshTimer) {
    clearTimeout(homeRefreshTimer);
    homeRefreshTimer = null;
  }

  if (section === 'mundial') loadMundial();
  if (section === 'porra') loadPorra();
  if (section === 'principal') loadHome();
}

window.navigate = navigate; // make accessible from inline onclick

// ── Screen: Login ─────────────────────────────────────────────────────────
function showLogin() {
  hide('app');
  show('login-screen');
  $('login-username')?.focus();
}

function showApp(user) {
  currentUser = user;
  localStorage.setItem('gp_session', JSON.stringify(user));
  hide('login-screen');
  show('app');
  $('user-avatar').textContent = user.username.slice(0, 2);
  $('user-label').textContent = user.display_name || user.username;
  navigate('principal');
}

$('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const btn = e.submitter;
  btn.disabled = true;
  btn.textContent = 'Entrant…';
  try {
    const user = await login($('login-username').value, $('login-password').value);
    showApp(user);
  } catch (err) {
    $('login-error').textContent = err.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
});

$('logout-btn').addEventListener('click', () => {
  currentUser = null;
  localStorage.removeItem('gp_session');
  showLogin();
});

$('info-btn').addEventListener('click', toggleInfo);

function toggleInfo() {
  const infoEl = $('home-info');
  if (!infoEl) return;
  const hidden = infoEl.classList.toggle('hidden');
  if (!hidden) {
    infoEl.innerHTML = `<div class="info-card card">
      <h2>📋 Com funciona Gisceporra</h2>
      <h3>Fase de Grups</h3>
      <p>Per cada grup (A–L), has predit quins equips quedaran <strong>1r, 2n i 3r</strong>. Quan un grup acabi (3 partits per equip), es calculen els punts:</p>
      <ul>
        <li>Equip al <strong>top 3</strong> (posició incorrecta): <span class="pts-badge pts-yellow">5</span> punts</li>
        <li>Equip al top 3 <strong>en la posició exacta</strong>: <span class="pts-badge pts-green">10</span> punts</li>
      </ul>

      <h3>Fase Eliminatòria</h3>
      <p>Un cop definits els emparellaments, pots predir el resultat final de cada partit (incloent pròrroga). Si predius empat, has d'escollir qui passa als penals.</p>
      <table class="info-tbl">
        <thead><tr><th>Ronda</th><th>Guanyador</th><th>Resultat exacte</th></tr></thead>
        <tbody>
          <tr><td>Setzens/Vuitens</td><td>10 pts</td><td>20 pts</td></tr>
          <tr><td>Quarts de final</td><td>15 pts</td><td>30 pts</td></tr>
          <tr><td>Semifinals</td><td>20 pts</td><td>40 pts</td></tr>
          <tr><td>Final</td><td>30 pts</td><td>50 pts</td></tr>
        </tbody>
      </table>

      <h3>🔮 Bola de Cristal</h3>
      <p>Si vas predir el <strong>campió del món</strong> a la fase de grups i l'encertes: <strong class="pts-badge pts-green" style="display:inline-block;margin:0 4px">+100</strong> punts extra!</p>

      <h3>📊 Consulta els teus pronòstics</h3>
      <p>A la pestanya <strong>Mundial → Grups</strong> pots veure les teves prediccions amb colors: <span class="pred-dot dot-green"></span> encert exacte (10pts), <span class="pred-dot dot-yellow"></span> al top3 (5pts), <span class="pred-dot dot-red"></span> sense punts.</p>

      <p class="info-close"><button class="btn-primary btn-done" onclick="document.getElementById('home-info').classList.add('hidden')">Entès!</button></p>
    </div>`;
    navigate('principal');
  }
}

// ── Screen: Principal ─────────────────────────────────────────────────────
async function fetchWCCached() {
  const hasLive = wc?.matches?.some(m => m.status === 'IN_PLAY' || m.status === 'PAUSED');
  const ttl = hasLive ? WC_TTL_LIVE : WC_TTL_NORMAL;
  if (!wc || Date.now() - wcFetchedAt > ttl) {
    wc = await fetchWCData().catch(() => ({ matches: [], standings: [], errors: [] }));
    wcFetchedAt = Date.now();
  }
  return wc;
}

async function loadHome() {
  const { matches } = await fetchWCCached();

  const live = matches.filter(m => m.status === 'IN_PLAY' || m.status === 'PAUSED');
  const upcoming = matches
    .filter(m => m.status === 'SCHEDULED' || m.status === 'TIMED')
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));
  const past = matches.filter(m => m.status === 'FINISHED')
    .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate))
    .slice(0, 5);

  // ── User mini-ranking widget ──────────────────────────────────────────
  loadUserWidget();

  // ── Live / Next match ─────────────────────────────────────────────────
  if (live.length > 0) {
    $('home-live').innerHTML = `
      <div class="live-alert">
        <div class="live-badge"><span class="live-dot"></span> EN JOC ARA</div>
        ${live.map(m => `
          <div class="live-match-row">
            <span class="lm-team">${teamWithFlag(m.homeTeam.name)}</span>
            <span class="lm-score">${m.score.fullTime.home ?? '·'} – ${m.score.fullTime.away ?? '·'}</span>
            <span class="lm-team right">${teamWithFlag(m.awayTeam.name)}</span>
          </div>`).join('')}
      </div>`;
  } else if (upcoming[0]) {
    const n = upcoming[0];
    const d = new Date(n.utcDate);
    $('home-live').innerHTML = `
      <div class="next-match-card">
        <p class="tag">Pròxim partit</p>
        <div class="nm-row">
          <span>${teamWithFlag(n.homeTeam.name)}</span>
          <span class="vs">vs</span>
          <span>${teamWithFlag(n.awayTeam.name)}</span>
        </div>
        <p class="nm-time">${d.toLocaleDateString('ca',{weekday:'short',day:'2-digit',month:'short'})} · ${d.toLocaleTimeString('ca',{hour:'2-digit',minute:'2-digit'})}</p>
      </div>`;
  } else {
    $('home-live').innerHTML = '';
  }

  // Auto-refresh: 45s si hi ha partit en viu, 3min si no
  if (homeRefreshTimer) clearTimeout(homeRefreshTimer);
  const refreshIn = live.length > 0 ? WC_TTL_LIVE : WC_TTL_NORMAL;
  homeRefreshTimer = setTimeout(() => {
    if (!document.getElementById('screen-principal')?.classList.contains('hidden')) {
      wc = null; // força re-fetch
      loadHome();
    }
  }, refreshIn);

  // Pending bets alert (exclou partits amb contendents per definir)
  if (currentUser && supabase) {
    const knockoutUpcoming = upcoming.filter(m => m.stage && m.stage !== 'GROUP_STAGE');
    if (knockoutUpcoming.length > 0) {
      const { data: myBets } = await supabase.from('pronostics').select('match_key').eq('username', currentUser.username);
      const betKeys = new Set((myBets ?? []).map(b => b.match_key));
      const pending = knockoutUpcoming.filter(m => !betKeys.has(String(m.id)) &&
        !isPlaceholderName(m.homeTeam.name) && !isPlaceholderName(m.awayTeam.name));
      const placeholder = knockoutUpcoming.filter(m => !betKeys.has(String(m.id)) &&
        (isPlaceholderName(m.homeTeam.name) || isPlaceholderName(m.awayTeam.name)));
      if (pending.length > 0) {
        $('home-alerts').innerHTML = `
          <button class="pending-alert" onclick="navigate('porra')">
            <span>⚠️</span>
            <div><strong>${pending.length} pronòstic${pending.length > 1 ? 's' : ''} pendent${pending.length > 1 ? 's' : ''}!</strong>
            <br><small>Ves a Porra per predir</small></div>
            <span>→</span>
          </button>`;
      } else if (placeholder.length > 0) {
        $('home-alerts').innerHTML = '<p class="ok-msg">⏳ Esperant emparellaments de l\'eliminatòria</p>';
      } else {
        $('home-alerts').innerHTML = '<p class="ok-msg">✅ Apostes al dia</p>';
      }
    } else {
      $('home-alerts').innerHTML = '';
    }
  }

  // Recent results
  $('home-recent').innerHTML = past.length ? `
    <h3 class="section-h">Últims resultats</h3>
    ${past.map(m => `
      <div class="result-row">
        <span class="rt">${teamWithFlag(m.homeTeam.name)}</span>
        <span class="rs">${m.score.fullTime.home} – ${m.score.fullTime.away}</span>
        <span class="rt right">${teamWithFlag(m.awayTeam.name)}</span>
      </div>`).join('')}` : '';
}

// ── User widget (posició i punts a la pàgina principal) ───────────────────
async function loadUserWidget() {
  const el = $('home-user-widget');
  if (!el || !currentUser) return;

  if (!supabase) {
    el.innerHTML = `<div class="user-widget"><span class="uw-name">${currentUser.display_name || currentUser.username}</span><span class="uw-pts">0 pts · <span class="uw-pos">#–</span></span></div>`;
    return;
  }

  try {
    const [partRes, grpResRes, champPredRes, participRes] = await Promise.all([
      supabase.from('group_predictions').select('*'),
      supabase.from('group_results').select('*'),
      supabase.from('champion_predictions').select('*'),
      supabase.from('participants').select('username, display_name'),
    ]);

    const allPreds = partRes.data ?? [];
    const grpResults = grpResRes.data ?? [];
    const champPreds = champPredRes.data ?? [];
    const participants = participRes.data ?? [];
    const finishedKO = (wc?.matches ?? []).filter(m => m.status === 'FINISHED' && m.stage !== 'GROUP_STAGE');
    const campioRow = grpResults.find(r => r.group_name === 'campio');
    const actualChampion = campioRow?.actual_1st ?? null;

    const ranking = participants.map(p => {
      let pts = 0;
      for (const pred of allPreds.filter(pr => pr.username === p.username)) {
        const res = grpResults.find(r => r.group_name === pred.group_name);
        if (res) pts += calculateGroupPoints(
          [pred.pred_1st, pred.pred_2nd, pred.pred_3rd].filter(Boolean),
          [res.actual_1st, res.actual_2nd, res.actual_3rd].filter(Boolean)
        );
      }
      const myChamp = champPreds.find(c => c.username === p.username);
      if (myChamp?.champion && actualChampion) pts += calculateCrystalBallPoints(myChamp.champion, actualChampion);
      return { username: p.username, displayName: p.display_name, points: pts };
    }).sort((a, b) => b.points - a.points);

    const myPos = ranking.findIndex(r => r.username === currentUser.username) + 1;
    const myPts = ranking.find(r => r.username === currentUser.username)?.points ?? 0;
    const total = ranking.length;

    el.innerHTML = `
      <div class="user-widget" onclick="navigate('porra')" role="button">
        <div class="uw-left">
          <div class="uw-avatar">${currentUser.username.slice(0,2)}</div>
          <div>
            <div class="uw-name">${currentUser.display_name || currentUser.username}</div>
            <div class="uw-sub">Toca per veure ranking complet</div>
          </div>
        </div>
        <div class="uw-right">
          <div class="uw-pts">${myPts} <span class="pts-label">pts</span></div>
          <div class="uw-pos">${myPos > 0 ? `#${myPos} / ${total}` : '–'}</div>
        </div>
      </div>`;
  } catch {
    el.innerHTML = '';
  }
}

// ── Screen: Porra (Ranking + Apostes) ────────────────────────────────────
async function loadPorra() {
  await Promise.all([loadRanking(), loadBetForm()]);
}

async function loadRanking() {
  const el = $('porra-ranking');
  if (!el) return;
  el.innerHTML = '<p class="muted">Calculant classificació…</p>';

  try {
    let ranking = [];
    const closedGroups = new Set();

    if (supabase) {
      const [partRes, grpResRes, champPredRes, apostesRes, participRes] = await Promise.all([
        supabase.from('group_predictions').select('*'),
        supabase.from('group_results').select('*'),
        supabase.from('champion_predictions').select('*'),
        supabase.from('pronostics').select('*'),
        supabase.from('participants').select('username, display_name'),
      ]);

      const allPreds = partRes.data ?? [];
      const grpResults = grpResRes.data ?? [];
      const champPreds = champPredRes.data ?? [];
      const apostes = apostesRes.data ?? [];
      const participantsList = (participRes.data ?? []).filter(p => p.username !== 'TST' || currentUser?.username === 'TST');

      // Get actual champion from group_results where group_name = 'campió'
      const campioRow = grpResults.find(r => r.group_name === 'campio');
      const actualChampion = campioRow?.actual_1st ?? null;

      // Get match results for knockout (from ESPN or partidos)
      if (!wc) wc = await fetchWCData().catch(() => ({ matches: [], standings: [], errors: [] }));
      const finishedMatches = wc.matches.filter(m => m.status === 'FINISHED' && m.stage !== 'GROUP_STAGE');

      // Build map of actual top3 per closed group from ESPN standings
      const actualTop3ByGroup = {};
      const closedGroups = new Set();
      for (const s of (wc.standings ?? [])) {
        if (s.type !== 'TOTAL') continue;
        const groupKey = (s.group ?? '').replace(/^(Group |Grup )/i, '');
        const table = s.table ?? [];
        const allPlayed3 = table.every(t => t.playedGames === 3);
        if (allPlayed3 && table.length >= 4) closedGroups.add(groupKey);
      }

      for (const s of (wc.standings ?? [])) {
        if (s.type !== 'TOTAL') continue;
        const groupKey = (s.group ?? '').replace(/^(Group |Grup )/i, '');
        if (!closedGroups.has(groupKey)) continue;
        actualTop3ByGroup[groupKey] = (s.table ?? [])
          .filter(t => t.position >= 1 && t.position <= 3)
          .map(t => t.team?.name)
          .filter(Boolean);
      }

      ranking = participantsList.map(p => {
        let pts = 0;

        // Group stage points (from ESPN standings)
        const myPreds = allPreds.filter(pr => pr.username === p.username);
        for (const pred of myPreds) {
          const actualTop3 = actualTop3ByGroup[pred.group_name];
          if (!actualTop3 || !actualTop3.length) continue;
          pts += calculateGroupPoints(
            [pred.pred_1st, pred.pred_2nd, pred.pred_3rd].filter(Boolean),
            actualTop3
          );
        }

        // Knockout points
        const myApostes = apostes.filter(a => a.username === p.username);
        for (const bet of myApostes) {
          const match = finishedMatches.find(m => String(m.id) === bet.match_key);
          if (!match) continue;
          pts += calculateKnockoutPoints(
            { homeGoals: bet.pred_home_goals, awayGoals: bet.pred_away_goals, tieWinner: bet.tie_winner },
            {
              round: bet.round,
              winner: match.winner,
              homeGoals: match.score.fullTime.home,
              awayGoals: match.score.fullTime.away,
              homeTeam: match.homeTeam.name,
              awayTeam: match.awayTeam.name,
            }
          );
        }

        // Champion (Bola de Cristal)
        const myChamp = champPreds.find(c => c.username === p.username);
        if (myChamp?.champion && actualChampion) {
          pts += calculateCrystalBallPoints(myChamp.champion, actualChampion);
        }

        return { username: p.username, displayName: p.display_name, points: pts };
      }).sort((a, b) => b.points - a.points);

    } else {
      ranking = [{ username: 'TST', displayName: 'Test User', points: 0 }];
    }

    el.innerHTML = rankingHtml(ranking, currentUser?.username);

    // Update cache tables in background
    saveRankingCache(ranking, closedGroups);

  } catch (err) {
    el.innerHTML = `<p class="muted">Error: ${err.message}</p>`;
  }
}

// ── Cache: save ranking and group results to Supabase ────────────────────
async function saveRankingCache(ranking, closedGroups) {
  if (!supabase || !wc) return;
  try {
    // Save final group standings for closed groups
    for (const s of (wc.standings ?? [])) {
      if (s.type !== 'TOTAL') continue;
      const groupKey = (s.group ?? '').replace(/^(Group |Grup )/i, '');
      if (!closedGroups.has(groupKey)) continue;
      const top3 = (s.table ?? []).filter(t => t.position >= 1 && t.position <= 3);
      const fourth = (s.table ?? []).find(t => t.position === 4);

      await supabase.from('group_results').upsert({
        group_name: groupKey,
        actual_1st: top3[0]?.team?.name ?? null,
        actual_2nd: top3[1]?.team?.name ?? null,
        actual_3rd: top3[2]?.team?.name ?? null,
        actual_4th: fourth?.team?.name ?? null,
      }, { onConflict: 'group_name' });
    }

    // Save ranking
    for (const r of ranking) {
      await supabase.from('clasificacion').upsert({
        username: r.username,
        puntos: r.points,
      }, { onConflict: 'username' });
    }
  } catch (e) {
    // Non-critical: fail silently
  }
}

function rankingHtml(ranking, me) {
  if (!ranking.length) return '<p class="muted">No hi ha participants.</p>';

  const medals = ['🥇', '🥈', '🥉'];
  const top3 = ranking.slice(0, 3);

  let html = '<div class="podium">';
  // Reorder: 2nd left, 1st center, 3rd right
  const podiumOrder = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3;
  const podiumPos   = top3.length === 3 ? [2, 1, 3] : [1, 2, 3];
  podiumOrder.forEach((e, i) => {
    const isMe = e.username === me;
    const pos = podiumPos[i];
    html += `<div class="podium-item rank-${pos} ${isMe ? 'is-me' : ''}">
      <div class="podium-medal">${medals[pos - 1]}</div>
      <div class="podium-name">${e.displayName || e.username}</div>
      <div class="podium-pts">${e.points} pts</div>
    </div>`;
  });
  html += '</div>';

  html += '<ol class="ranking-list">';
  ranking.forEach((e, i) => {
    const isMe = e.username === me;
    html += `<li class="ranking-item ${isMe ? 'is-me' : ''}">
      <span class="rank-num">${i + 1}</span>
      <span class="rank-name">${e.displayName || e.username}</span>
      <span class="rank-pts">${e.points} <span class="pts-label">pts</span></span>
      ${isMe ? '<span class="rank-you">Tu</span>' : ''}
    </li>`;
  });
  html += '</ol>';

  return html;
}

// ── Bet Form (Fase Eliminatòria) ──────────────────────────────────────────
async function loadBetForm() {
  const container = $('bet-container');
  if (!container) return;

  if (!wc) wc = await fetchWCData().catch(() => ({ matches: [], standings: [], errors: [] }));

  const knockoutMatches = wc.matches
    .filter(m => m.stage && m.stage !== 'GROUP_STAGE')
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate));

  if (!knockoutMatches.length) {
    container.innerHTML = '<p class="muted">Fase eliminatòria no disponible encara.</p>';
    return;
  }

  let betKeys = new Set();
  if (supabase && currentUser) {
    const { data } = await supabase.from('pronostics').select('match_key').eq('username', currentUser.username);
    betKeys = new Set((data ?? []).map(b => b.match_key));
  }

  const pending = knockoutMatches.filter(m => !betKeys.has(String(m.id)) &&
    (m.status === 'SCHEDULED' || m.status === 'TIMED'));
  const done = knockoutMatches.filter(m => betKeys.has(String(m.id)));

  // Partits amb placeholders — NO editables
  const placeholder = pending.filter(m => isPlaceholderName(m.homeTeam.name) || isPlaceholderName(m.awayTeam.name));
  const editable = pending.filter(m => !isPlaceholderName(m.homeTeam.name) && !isPlaceholderName(m.awayTeam.name));

  // Funció per comprovar si un partit encara es pot modificar (2h abans)
  function canEdit(match) {
    if (match.status === 'FINISHED' || match.status === 'IN_PLAY' || match.status === 'PAUSED') return false;
    if (!match.utcDate) return false;
    return new Date(match.utcDate).getTime() - Date.now() > 2 * 60 * 60 * 1000;
  }

  let html = '';

  // 1. Pronòstics pendents (sense enviar)
  if (editable.length > 0) {
    html += '<h3 class="section-h">Pronòstics pendents</h3>';
    html += editable.map(m => betFormCard(m)).join('');
  } else if (pending.length > 0) {
    html += '<p class="ok-msg">✅ Tots els pronòstics fets!</p>';
  }

  // 2. Pronòstics enviats (editable si >2h, sinó bloquejat)
  if (done.length > 0) {
    const editableBets = done.filter(m => canEdit(m));
    const lockedBets = done.filter(m => !canEdit(m));
    if (editableBets.length > 0) {
      html += '<h3 class="section-h">Pronòstics per revisar</h3>';
      html += editableBets.map(m => betFormCard(m)).join('');
      html += '<p class="muted edit-hint">⏳ Pots modificar-los fins 2h abans del partit</p>';
    }
    if (lockedBets.length > 0) {
      html += `<details class="done-bets"><summary>Pronòstics tancats (${lockedBets.length})</summary>`;
      html += lockedBets.map(m => `<div class="done-bet-row">
        <span>${teamWithFlag(m.homeTeam.name)} vs ${teamWithFlag(m.awayTeam.name)}</span>
        <span class="muted">🔒 tancat</span>
      </div>`).join('');
      html += '</details>';
    }
  }

  // 3. Emparellaments per definir
  if (placeholder.length > 0) {
    html += '<h3 class="section-h">Emparellaments per definir</h3>';
    html += placeholder.map(m => betPlaceholderCard(m)).join('');
  }

  container.innerHTML = html;

  // Wire up bet forms (only real <form> elements, not placeholder divs)
  container.querySelectorAll('form.bet-form').forEach(form => {
    const homeIn = form.querySelector('.bet-home');
    const awayIn = form.querySelector('.bet-away');
    const tieGroup = form.querySelector('.tie-winner-group');

    function updateTie() {
      const h = parseInt(homeIn.value);
      const a = parseInt(awayIn.value);
      if (!isNaN(h) && !isNaN(a) && h === a) {
        tieGroup.classList.remove('hidden');
        tieGroup.querySelector('select').required = true;
      } else {
        tieGroup.classList.add('hidden');
        tieGroup.querySelector('select').required = false;
      }
    }

    homeIn.addEventListener('input', updateTie);
    awayIn.addEventListener('input', updateTie);

    form.addEventListener('submit', async e => {
      e.preventDefault();
      await saveBet(form);
    });
  });
}

function betPlaceholderCard(match) {
  const d = new Date(match.utcDate);
  const dateStr = d.toLocaleDateString('ca', { weekday: 'short', day: '2-digit', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('ca', { hour: '2-digit', minute: '2-digit' });
  return `
    <div class="bet-form card placeholder-bet">
      <div class="bet-header">
        <span class="bet-round">${match.stage?.replace(/_/g,' ') ?? ''}</span>
        <span class="bet-date muted">${dateStr}</span>
      </div>
      <div class="bet-teams">
        <span class="bet-team-name">${teamWithFlag(match.homeTeam.name)}</span>
        <div class="bet-score-inputs">
          <span class="placeholder-score">?</span>
          <span class="bet-dash">–</span>
          <span class="placeholder-score">?</span>
        </div>
        <span class="bet-team-name right">${teamWithFlag(match.awayTeam.name)}</span>
      </div>
      <p class="placeholder-hint muted">⏳ Emparellament per definir</p>
    </div>`;
}

function betFormCard(match) {
  const d = new Date(match.utcDate);
  const dateStr = d.toLocaleDateString('ca', { weekday: 'short', day: '2-digit', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('ca', { hour: '2-digit', minute: '2-digit' });
  return `
    <form class="bet-form card" data-match-id="${match.id}" data-round="${match.stage}"
          data-home="${match.homeTeam.name}" data-away="${match.awayTeam.name}">
      <div class="bet-header">
        <span class="bet-round">${match.stage?.replace(/_/g,' ') ?? ''}</span>
        <span class="bet-date muted">${dateStr}</span>
      </div>
      <div class="bet-teams">
        <span class="bet-team-name">${teamWithFlag(match.homeTeam.name)}</span>
        <div class="bet-score-inputs">
          <input class="bet-home bet-goal-input" type="number" min="0" max="20" placeholder="0" required />
          <span class="bet-dash">–</span>
          <input class="bet-away bet-goal-input" type="number" min="0" max="20" placeholder="0" required />
        </div>
        <span class="bet-team-name right">${teamWithFlag(match.awayTeam.name)}</span>
      </div>
      <p class="bet-hint muted">Resultat final (incloent pròrroga si n'hi ha)</p>
      <div class="tie-winner-group hidden">
        <label>En cas d'empat, qui passa?
          <select class="tie-winner-select">
            <option value="">-- Selecciona equip --</option>
            <option value="${match.homeTeam.name}">${match.homeTeam.name}</option>
            <option value="${match.awayTeam.name}">${match.awayTeam.name}</option>
          </select>
        </label>
      </div>
      <button type="submit" class="btn-primary">Enviar aposta</button>
      <p class="bet-status status-msg"></p>
    </form>`;
}

async function saveBet(form) {
  const btn = form.querySelector('button[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Guardant…';
  const statusEl = form.querySelector('.bet-status');

  try {
    if (!currentUser) throw new Error('Cal estar autenticat');
    const matchId = String(form.dataset.matchId);
    const homeGoals = parseInt(form.querySelector('.bet-home').value);
    const awayGoals = parseInt(form.querySelector('.bet-away').value);
    const round = form.dataset.round;
    const homeTeam = form.dataset.home;
    const awayTeam = form.dataset.away;
    let tieWinner = null;

    if (homeGoals === awayGoals) {
      tieWinner = form.querySelector('.tie-winner-select')?.value || null;
      if (!tieWinner) throw new Error('Has de seleccionar quin equip passa als penals');
    }

    const bet = {
      username: currentUser.username,
      match_key: matchId,
      home_team: homeTeam,
      away_team: awayTeam,
      pred_home_goals: homeGoals,
      pred_away_goals: awayGoals,
      tie_winner: tieWinner,
      round,
    };

    if (supabase) {
      const { error } = await supabase.from('pronostics').upsert(bet, { onConflict: 'username,match_key' });
      if (error) throw error;
    }

    statusEl.textContent = '✅ Aposta guardada!';
    statusEl.className = 'bet-status status-msg ok';
    btn.textContent = '✓ Enviada';
    btn.classList.add('btn-done');

    // Refresh home alerts after a short delay
    setTimeout(() => loadHome(), 1500);

  } catch (err) {
    statusEl.textContent = `❌ ${err.message}`;
    statusEl.className = 'bet-status status-msg error';
    btn.disabled = false;
    btn.textContent = 'Enviar aposta';
  }
}

// ── Screen: Mundial ───────────────────────────────────────────────────────
async function loadMundial() {
  const statusEl = $('mundial-status');
  if (statusEl) statusEl.textContent = 'Carregant…';

  try {
    wc = await fetchWCData().catch(() => ({ matches: [], standings: [], errors: [] }));
    wcFetchedAt = Date.now();
  } catch (err) {
    if (statusEl) statusEl.textContent = `Error: ${err.message}`;
    return;
  }

  renderMundialActiveTab();
  const time = new Date().toLocaleTimeString('ca', { hour: '2-digit', minute: '2-digit' });
  if (statusEl) statusEl.textContent = `Actualitzat a les ${time}`;
}

function renderMundialActiveTab() {
  const activeTab = document.querySelector('#screen-mundial .tab-btn.active')?.dataset.tab ?? 'partits';
  renderMundialTab(activeTab);
}

function renderMundialTab(tab) {
  if (!wc) return;
  const { matches, standings } = wc;
  if (tab === 'partits') $('tab-partits').innerHTML = matchesSectionHtml(matches);
  else if (tab === 'grups') {
    if (!supabase || !currentUser) {
      $('tab-grups').innerHTML = standingsHtml(standings);
    } else {
      loadGroupStandingsWithPredictions(standings);
    }
  }
  else if (tab === 'bracket') $('tab-bracket').innerHTML = knockoutBracketHtml(matches);
}

async function loadGroupStandingsWithPredictions(standings) {
  const el = $('tab-grups');
  try {
    const partRes = await supabase.from('group_predictions').select('*').eq('username', currentUser.username);
    const predictions = partRes.data ?? [];

    // Saber quins grups estan tancats (tots els equips han jugat 3 partits)
    const closedGroups = new Set();
    if (wc) {
      for (const s of standings) {
        if (s.type !== 'TOTAL') continue;
        const table = s.table ?? [];
        // Un grup està tancat si tots els seus equips tenen playedGames == 3
        // i cap partit d'aquest grup està pendent o en joc
        const allPlayed3 = table.every(t => t.playedGames === 3);
        if (!allPlayed3) continue;
        const groupKey = (s.group ?? '').replace(/^(Group |Grup )/i, '');
        closedGroups.add(groupKey);
      }
    }

    // Build predictions lookup per grup i equip
    const predLookup = {};
    for (const pred of predictions) {
      const g = pred.group_name;
      const closed = closedGroups.has(g);
      predLookup[g] = {};
      const pMap = { 1: pred.pred_1st, 2: pred.pred_2nd, 3: pred.pred_3rd };
      for (const [pos, team] of Object.entries(pMap)) {
        if (team) {
          predLookup[g][team] = { predicted: Number(pos), points: 0, closed };
        }
      }
    }

    // Calcular punts per equip només per grups tancats
    for (const group of standings) {
      if (group.type !== 'TOTAL') continue;
      const groupKey = (group.group ?? '').replace(/^(Group |Grup )/i, '');
      const groupPreds = predLookup[groupKey];
      if (!groupPreds) continue;
      const closed = closedGroups.has(groupKey);
      if (!closed) continue;

      const table = group.table ?? [];
      const actualTop3 = table
        .filter(t => t.position >= 1 && t.position <= 3)
        .map(t => t.team?.name);

      for (const row of table) {
        const team = row.team?.name;
        if (!team || !groupPreds[team]) continue;
        const predPos = groupPreds[team].predicted;
        const inTop3 = actualTop3.includes(team);
        const exact = predPos === row.position;
        let pts = 0;
        if (inTop3) pts += 5;
        if (exact) pts += 5;
        groupPreds[team].points = pts;
      }
    }

    el.innerHTML = standingsHtml(standings, predLookup);
  } catch {
    el.innerHTML = standingsHtml(standings);
  }
}

// Tab switching for Mundial
document.querySelectorAll('#screen-mundial .tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#screen-mundial .tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('#screen-mundial .tab-content').forEach(c => c.classList.add('hidden'));
    btn.classList.add('active');
    $(`tab-${btn.dataset.tab}`)?.classList.remove('hidden');
    renderMundialTab(btn.dataset.tab);
  });
});

$('refresh-mundial')?.addEventListener('click', async () => {
  wc = null;
  await loadMundial();
});

// Bottom nav
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => navigate(btn.dataset.nav));
});

// ── Init ──────────────────────────────────────────────────────────────────
(function init() {
  const saved = localStorage.getItem('gp_session');
  if (saved) {
    try {
      showApp(JSON.parse(saved));
    } catch {
      showLogin();
    }
  } else {
    showLogin();
  }
})();
