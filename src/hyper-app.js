/**
 * hyper-app.js — Punt d'entrada de la Porra-League Hypermotion
 *
 * S'executa en paral·lel a app.js. Gestiona la navegació i les accions
 * de les pantalles del mode Hypermotion.
 */

import {
  fetchTeamNextMatches,
  fetchTeamLastMatches,
  fetchTeamDetails,
  fetchTeamPlayers,
  fetchHyperStandings,
  hyperInfoHtml,
  hyperRankingDetailedHtml,
  hyperClubHtml,
  hyperHowToHtml,
  hyperPredictFormHtml,
  isPredictionLocked,
} from './hyper.js';
import { calculateHyperUserTotal } from './hyper-scoring.js';
import { getTeamInfo } from './hyper-teams.js';

// ── Helpers ────────────────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const show = id => $( id)?.classList.remove('hidden');
const hide = id => $( id)?.classList.add('hidden');

/** Escapa caràcters HTML per evitar XSS. */
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/** Mostra un missatge d'error a un element usant textContent per evitar XSS. */
function showError(el, msg) {
  if (!el) return;
  el.textContent = '';
  const p = document.createElement('p');
  p.className = 'muted';
  p.textContent = `Error: ${msg}`;
  el.appendChild(p);
}

// ── State ──────────────────────────────────────────────────────────────────
let hyperCurrentScreen = 'info';
let hyperTeamCache = null;     // dades theSportDB de l'equip
let hyperPlayersCache = null;
let hyperPredCache = null;     // Map<match_key, prediction>
let hyperResultsCache = null;  // Array de resultats (hyper_results)

// ── Accés a estat compartit (app.js) ──────────────────────────────────────
function getUser() { return window.__app?.currentUser ?? null; }
function getDb()   { return window.__app?.supabase ?? null; }

// ── Navegació ──────────────────────────────────────────────────────────────
const HYPER_SCREENS = ['info', 'ranking', 'club', 'profile', 'howto', 'predict'];

function hyperNavigate(screen) {
  hyperCurrentScreen = screen;
  HYPER_SCREENS.forEach(s => {
    $(`hyper-screen-${s}`)?.classList.toggle('hidden', s !== screen);
  });
  document.querySelectorAll('#hyper-nav .nav-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.hyperNav === screen));

  if (screen === 'info')    loadHyperInfo();
  if (screen === 'ranking') loadHyperRanking();
  if (screen === 'club')    loadHyperClub();
  if (screen === 'profile') loadHyperProfile();
  if (screen === 'howto')   loadHyperHowTo();
}

window.hyperNavigate = hyperNavigate;

// ── Pantalla: Inici ────────────────────────────────────────────────────────
async function loadHyperInfo() {
  const el = $('hyper-info-content');
  if (!el) return;

  const user = getUser();
  const db = getDb();
  if (!user) return;

  const teamId = user.hyper_team_id ?? null;
  if (!teamId) {
    el.innerHTML = '<p class="muted">Equip no assignat. Contacta amb l\'administrador.</p>';
    return;
  }

  el.innerHTML = '<p class="muted">Carregant partits…</p>';

  try {
    const [nextMatches, lastMatches, standings] = await Promise.all([
      fetchTeamNextMatches(teamId).catch(() => []),
      fetchTeamLastMatches(teamId).catch(() => []),
      fetchHyperStandings('4400').catch(() => []),
    ]);

    // Carregar prediccions de l'usuari
    let predMap = new Map();
    if (db && user) {
      const { data } = await db.from('hyper_predictions').select('*').eq('username', user.username);
      predMap = new Map((data ?? []).map(p => [String(p.match_key), p]));
      hyperPredCache = predMap;
    }

    el.innerHTML = hyperInfoHtml(nextMatches, lastMatches, predMap, user.hyper_team_id ?? '', standings);

    // Connectar botons "Predir resultat"
    el.querySelectorAll('.hyper-predict-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const match = {
          idEvent: btn.dataset.event,
          strHomeTeam: btn.dataset.home,
          strAwayTeam: btn.dataset.away,
          strDate: btn.dataset.date,
          strTime: btn.dataset.time,
        };
        openPredictForm(match);
      });
    });
  } catch (err) {
    showError(el, err.message);
  }
}

// ── Pantalla: Formulari de predicció ──────────────────────────────────────
function openPredictForm(match) {
  const el = $('hyper-predict-content');
  if (!el) return;

  const existingPred = hyperPredCache?.get(String(match.idEvent)) ?? null;
  el.innerHTML = hyperPredictFormHtml(match, existingPred);

  // Connectar formulari
  const form = el.querySelector('.hyper-predict-form');
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      await saveHyperPrediction(form);
    });
  }

  hyperNavigate('predict');
}

async function saveHyperPrediction(form) {
  const btn = form.querySelector('button[type=submit]');
  if (btn) { btn.disabled = true; btn.textContent = 'Guardant…'; }
  const statusEl = form.querySelector('.bet-status');

  try {
    const user = getUser();
    const db = getDb();
    if (!user) throw new Error('Cal estar autenticat');

    const matchKey = form.dataset.event;
    const predHome = parseInt(form.querySelector('.bet-home').value, 10);
    const predAway = parseInt(form.querySelector('.bet-away').value, 10);
    const homeTeam = form.dataset.home;
    const awayTeam = form.dataset.away;
    const matchDate = form.dataset.date;
    const matchTime = form.dataset.time;

    if (isNaN(predHome) || isNaN(predAway)) throw new Error('Introdueix els dos marcadors');

    // Comprovar si el termini de predicció ha passat
    if (isPredictionLocked(matchDate, matchTime)) {
      throw new Error('El termini per predir aquest partit ha tancat (1h abans)');
    }

    const prediction = {
      username: user.username,
      match_key: matchKey,
      home_team: homeTeam,
      away_team: awayTeam,
      pred_home: predHome,
      pred_away: predAway,
      match_date: matchDate,
      match_time: matchTime,
    };

    if (db) {
      const { error } = await db.from('hyper_predictions').upsert(prediction, { onConflict: 'username,match_key' });
      if (error) throw error;
    }

    // Actualitzar caché local
    if (!hyperPredCache) hyperPredCache = new Map();
    hyperPredCache.set(String(matchKey), prediction);

    if (statusEl) { statusEl.textContent = '✅ Pronòstic guardat!'; statusEl.className = 'bet-status status-msg ok'; }
    if (btn) { btn.textContent = '✓ Guardat'; btn.classList.add('btn-done'); }

    // Tornar a inici al cap d'un moment
    setTimeout(() => hyperNavigate('info'), 1200);

  } catch (err) {
    if (statusEl) { statusEl.textContent = `❌ ${err.message}`; statusEl.className = 'bet-status status-msg error'; }
    if (btn) { btn.disabled = false; btn.textContent = form.querySelector('.bet-last-saved') ? 'Edita pronòstic' : 'Envia pronòstic'; }
  }
}

// ── Pantalla: Classificació ────────────────────────────────────────────────
async function loadHyperRanking() {
  const el = $('hyper-ranking-content');
  if (!el) return;

  const db = getDb();
  const user = getUser();

  el.innerHTML = '<p class="muted">Calculant classificació…</p>';

  try {
    if (!db) {
      el.innerHTML = '<p class="muted">Sense connexió a la base de dades.</p>';
      return;
    }

    const [participRes, predsRes, resultsRes] = await Promise.all([
      db.from('participants').select('username, display_name, hyper_team_id').eq('porra_hyper', true),
      db.from('hyper_predictions').select('*'),
      db.from('hyper_results').select('*'),
    ]);

    const participants = (participRes.data ?? []).filter(p => p.username !== 'TST');
    const allPreds = predsRes.data ?? [];
    const allResults = resultsRes.data ?? [];
    const resultMap = new Map(allResults.map(r => [r.match_key, r]));
    const nowMs = Date.now();

    const entries = participants.map(p => {
      const preds = allPreds.filter(pred => pred.username === p.username);
      const results = preds.map(pred => resultMap.get(pred.match_key) ?? null).filter(Boolean);
      const points = calculateHyperUserTotal(preds, results);
      return {
        username: p.username,
        displayName: p.display_name,
        teamName: p.hyper_team_id ?? '',
        points,
        predictions: preds,
        results,
      };
    });

    el.innerHTML = hyperRankingDetailedHtml(entries, user?.username ?? '', nowMs);

  } catch (err) {
    showError(el, err.message);
  }
}

// ── Pantalla: El Meu Equip ─────────────────────────────────────────────────
async function loadHyperClub() {
  const el = $('hyper-club-content');
  if (!el) return;

  const user = getUser();
  if (!user) return;

  const teamId = user.hyper_team_id ?? null;
  if (!teamId) {
    el.innerHTML = '<p class="muted">Equip no assignat.</p>';
    return;
  }

  if (hyperTeamCache && hyperPlayersCache !== null) {
    el.innerHTML = hyperClubHtml(hyperTeamCache, teamId, hyperPlayersCache);
    return;
  }

  el.innerHTML = '<p class="muted">Carregant dades del club…</p>';

  try {
    const [teamData, players] = await Promise.all([
      fetchTeamDetails(teamId).catch(() => null),
      fetchTeamPlayers(teamId).catch(() => []),
    ]);
    hyperTeamCache = teamData;
    hyperPlayersCache = players;
    el.innerHTML = hyperClubHtml(teamData, teamId, players);
  } catch (err) {
    showError(el, err.message);
  }
}

// ── Pantalla: Perfil ───────────────────────────────────────────────────────
function loadHyperProfile() {
  const el = $('hyper-profile-content');
  if (!el) return;

  const user = getUser();
  if (!user) return;

  const teamInfo = getTeamInfo(user.hyper_team_id ?? '');
  const crest = teamInfo?.crest ?? '⚽';

  // Validate avatar URL — only allow http(s) URLs
  const rawAvatarUrl = user.avatar_url ?? '';
  const safeAvatarUrl = /^https?:\/\//.test(rawAvatarUrl) ? rawAvatarUrl : '';

  el.innerHTML = `
    <div class="hyper-profile card">
      <div class="hp-avatar-wrap">
        <div class="hp-avatar-circle" id="hp-avatar-preview">
          ${safeAvatarUrl
            ? `<img src="${escHtml(safeAvatarUrl)}" alt="Avatar" class="hp-avatar-img" />`
            : `<span class="hp-avatar-initials">${escHtml(user.username.slice(0,2))}</span>`
          }
          <span class="hp-crest-overlay">${crest}</span>
        </div>
      </div>

      <div class="hp-team-info card">
        <div class="hp-team-crest">${crest}</div>
        <div>
          <div class="hp-team-name">${escHtml(teamInfo?.displayName ?? user.hyper_team_id ?? 'Sense equip')}</div>
          <div class="hp-team-stadium muted">${escHtml(teamInfo?.stadium ?? '')}</div>
        </div>
      </div>

      <form id="hyper-profile-form" class="hp-form">
        <div class="form-group">
          <label for="hp-nickname">Nom de jugador (nickname)</label>
          <input id="hp-nickname" type="text" maxlength="30" placeholder="${escHtml(user.username)}"
                 value="${escHtml(user.nickname ?? user.display_name ?? '')}" />
        </div>
        <div class="form-group">
          <label for="hp-avatar-url">URL imatge avatar (opcional)</label>
          <input id="hp-avatar-url" type="url" placeholder="https://…" value="${escHtml(safeAvatarUrl)}" />
        </div>
        <button type="submit" class="btn-primary">Guardar canvis</button>
        <p class="bet-status status-msg" id="hp-save-status"></p>
      </form>

      <details class="hp-pwd-section">
        <summary class="btn-link-muted">🔐 Canviar contrasenya</summary>
        <form id="hyper-pwd-form" class="hp-form" style="margin-top:.75rem">
          <div class="form-group">
            <label for="hp-pwd-new">Nova contrasenya</label>
            <input id="hp-pwd-new" type="password" minlength="4" placeholder="Nova contrasenya" required />
          </div>
          <div class="form-group">
            <label for="hp-pwd-confirm">Confirma la contrasenya</label>
            <input id="hp-pwd-confirm" type="password" minlength="4" placeholder="Repeteix" required />
          </div>
          <button type="submit" class="btn-primary">Canviar contrasenya</button>
          <p class="bet-status status-msg" id="hp-pwd-status"></p>
        </form>
      </details>
    </div>`;

  // Save profile
  $('hyper-profile-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.submitter;
    btn.disabled = true;
    btn.textContent = 'Guardant…';
    try {
      const db = getDb();
      const nickname = $('hp-nickname').value.trim() || null;
      const avatarUrl = $('hp-avatar-url').value.trim() || null;
      if (db) {
        const { error } = await db.from('participants').update({ nickname, avatar_url: avatarUrl }).eq('username', user.username);
        if (error) throw error;
      }
      user.nickname = nickname;
      user.avatar_url = avatarUrl;
      localStorage.setItem('gp_session', JSON.stringify(user));
      updateHyperHeader();
      $('hp-save-status').textContent = '✅ Perfil guardat!';
      $('hp-save-status').className = 'bet-status status-msg ok';
    } catch (err) {
      $('hp-save-status').textContent = `❌ ${err.message}`;
      $('hp-save-status').className = 'bet-status status-msg error';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar canvis';
    }
  });

  // Change password
  $('hyper-pwd-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.submitter;
    btn.disabled = true;
    const statusEl = $('hp-pwd-status');
    try {
      const db = getDb();
      const newPwd = $('hp-pwd-new').value;
      const confirm = $('hp-pwd-confirm').value;
      if (newPwd !== confirm) throw new Error('Les contrasenyes no coincideixen');
      if (!db) throw new Error('Sense connexió');
      // Hash the password the same way as app.js
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(newPwd));
      const hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
      const { error } = await db.from('participants').update({ password_hash: hash }).eq('username', user.username);
      if (error) throw error;
      statusEl.textContent = '✅ Contrasenya canviada!';
      statusEl.className = 'bet-status status-msg ok';
      $('hp-pwd-new').value = '';
      $('hp-pwd-confirm').value = '';
    } catch (err) {
      statusEl.textContent = `❌ ${err.message}`;
      statusEl.className = 'bet-status status-msg error';
    } finally {
      btn.disabled = false;
    }
  });
}

// ── Pantalla: Com funciona ─────────────────────────────────────────────────
function loadHyperHowTo() {
  const el = $('hyper-howto-content');
  if (!el) return;
  el.innerHTML = hyperHowToHtml();
}

// ── Actualitzar capçalera Hyper ────────────────────────────────────────────
function updateHyperHeader() {
  const user = getUser();
  if (!user) return;
  const teamInfo = getTeamInfo(user.hyper_team_id ?? '');
  const crest = teamInfo?.crest ?? '';

  const initialsEl = $('hyper-avatar')?.querySelector('.ha-initials');
  const crestEl    = $('hyper-crest-badge');
  const labelEl    = $('hyper-user-label');

  if (initialsEl) {
    const rawAvatarUrl = user.avatar_url ?? '';
    const safeAvatarUrl = /^https?:\/\//.test(rawAvatarUrl) ? rawAvatarUrl : '';
    if (safeAvatarUrl) {
      const img = document.createElement('img');
      img.src = safeAvatarUrl;
      img.alt = 'avatar';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:50%;';
      initialsEl.textContent = '';
      initialsEl.appendChild(img);
    } else {
      initialsEl.textContent = user.username.slice(0, 2);
    }
  }
  if (crestEl) crestEl.textContent = crest;
  if (labelEl) labelEl.textContent = user.nickname || user.display_name || user.username;
}

// ── Inicialització ─────────────────────────────────────────────────────────
document.querySelectorAll('#hyper-nav .nav-btn').forEach(btn => {
  btn.addEventListener('click', () => hyperNavigate(btn.dataset.hyperNav));
});

$('hyper-logout-btn')?.addEventListener('click', () => window.__app?.showLogin());
$('hyper-back-btn')?.addEventListener('click', () => {
  const user = getUser();
  const hasMundial = user?.porra_mundial !== false;
  if (hasMundial) {
    hide('hyper-app');
    show('league-selector');
  } else {
    window.__app?.showLogin();
  }
});
$('hyper-info-btn')?.addEventListener('click', () => hyperNavigate('howto'));
$('hyper-pred-back')?.addEventListener('click', () => hyperNavigate('info'));

// Quan hyper-app entra al DOM visible, inicialitzem la capçalera
const hyperAppEl = $('hyper-app');
if (hyperAppEl) {
  const obs = new MutationObserver(() => {
    if (!hyperAppEl.classList.contains('hidden')) {
      updateHyperHeader();
    }
  });
  obs.observe(hyperAppEl, { attributes: true, attributeFilter: ['class'] });
}
