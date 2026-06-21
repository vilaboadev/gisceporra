import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { calculateKnockoutPoints, calculateCrystalBallPoints } from './scoring.js';

const statusEl = document.querySelector('#status');
const sessionLabel = document.querySelector('#session-label');
const matchesEl = document.querySelector('#matches');
const leaderboardEl = document.querySelector('#leaderboard');
const matchSelect = document.querySelector('#match-id');

const config = window.__SUPABASE_CONFIG ?? {
  url: '',
  anonKey: '',
};

const supabase = config.url && config.anonKey ? createClient(config.url, config.anonKey) : null;

const localStore = {
  users: [],
  session: null,
  matches: [
    { id: 1, home_team: 'España', away_team: 'Brasil', home_goals: 2, away_goals: 1, round: 'quarts', winner: 'España' },
    { id: 2, home_team: 'Francia', away_team: 'Argentina', home_goals: 1, away_goals: 1, round: 'semifinals', winner: 'Argentina' },
  ],
  bets: [],
};

async function hashLocalPassword(password) {
  if (!globalThis.crypto?.subtle) {
    throw new Error('El modo local requiere Web Crypto para proteger contraseñas.');
  }
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.style.color = isError ? '#fca5a5' : '#86efac';
}

async function currentUserEmail() {
  if (supabase) {
    const { data } = await supabase.auth.getUser();
    return data.user?.email ?? null;
  }
  return localStore.session?.email ?? null;
}

async function auth(action, email, password) {
  if (supabase) {
    if (action === 'register') {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return;
  }

  if (action === 'register') {
    if (localStore.users.some((u) => u.email === email)) throw new Error('Usuario ya existe');
    localStore.users.push({ email, passwordHash: await hashLocalPassword(password) });
    localStore.session = { email };
    return;
  }

  const passwordHash = await hashLocalPassword(password);
  const found = localStore.users.find((u) => u.email === email && u.passwordHash === passwordHash);
  if (!found) throw new Error('Credenciales inválidas');
  localStore.session = { email };
}

async function logout() {
  if (supabase) {
    await supabase.auth.signOut();
  } else {
    localStore.session = null;
  }
  renderSession();
}

async function fetchMatches() {
  if (supabase) {
    const { data, error } = await supabase.from('partidos').select('*').order('id');
    if (error) throw error;
    return data;
  }
  return localStore.matches;
}

function populateMatches(matches) {
  matchesEl.innerHTML = '';
  matchSelect.innerHTML = '';
  for (const match of matches) {
    const li = document.createElement('li');
    li.textContent = `${match.home_team} ${match.home_goals ?? '-'} - ${match.away_goals ?? '-'} ${match.away_team} (${match.round})`;
    matchesEl.append(li);

    const option = document.createElement('option');
    option.value = String(match.id);
    option.textContent = `${match.home_team} vs ${match.away_team}`;
    matchSelect.append(option);
  }
}

async function saveBet({ matchId, homeGoals, awayGoals, champion }) {
  const userEmail = await currentUserEmail();
  if (!userEmail) throw new Error('Debes iniciar sesión');

  if (supabase) {
    const { error } = await supabase.from('apuestas').upsert({
      usuario_email: userEmail,
      partido_id: matchId,
      pred_home_goals: homeGoals,
      pred_away_goals: awayGoals,
      champion_prediction: champion,
    });
    if (error) throw error;
    return;
  }

  const isNotCurrentBet = (bet) => !(bet.usuario_email === userEmail && bet.partido_id === matchId);
  localStore.bets = localStore.bets.filter(isNotCurrentBet);
  localStore.bets.push({
    usuario_email: userEmail,
    partido_id: matchId,
    pred_home_goals: homeGoals,
    pred_away_goals: awayGoals,
    champion_prediction: champion,
  });
}

async function recalculateLeaderboard() {
  const matches = await fetchMatches();
  const users = supabase
    ? (await supabase.from('usuarios').select('email')).data ?? []
    : localStore.users.map((u) => ({ email: u.email }));
  const bets = supabase
    ? (await supabase.from('apuestas').select('*')).data ?? []
    : localStore.bets;

  const ranking = users
    .map((user) => {
      const userBets = bets.filter((bet) => bet.usuario_email === user.email);
      const points = userBets.reduce((sum, bet) => {
        const match = matches.find((item) => item.id === bet.partido_id);
        if (!match) return sum;
        return (
          sum +
          calculateKnockoutPoints(
            {
              homeGoals: bet.pred_home_goals,
              awayGoals: bet.pred_away_goals,
              tieWinner: bet.tie_winner,
            },
            {
              round: match.round,
              winner: match.winner,
              homeGoals: match.home_goals,
              awayGoals: match.away_goals,
              homeTeam: match.home_team,
              awayTeam: match.away_team,
            },
          )
        );
      }, 0);

      let championPrediction = null;
      for (const bet of userBets) {
        const prediction = bet.champion_prediction?.trim();
        if (prediction) {
          championPrediction = prediction;
          break;
        }
      }
      const finalPoints = points + calculateCrystalBallPoints(championPrediction, matches.find((m) => m.round === 'final')?.winner);
      return { email: user.email, points: finalPoints };
    })
    .sort((a, b) => b.points - a.points);

  leaderboardEl.innerHTML = '';
  ranking.forEach((entry) => {
    const li = document.createElement('li');
    li.textContent = `${entry.email}: ${entry.points} pts`;
    leaderboardEl.append(li);
  });

  if (supabase) {
    for (const entry of ranking) {
      await supabase.from('clasificacion').upsert({ usuario_email: entry.email, puntos: entry.points });
    }
  }
}

async function renderSession() {
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    sessionLabel.textContent = data.session?.user?.email ? `Autenticado como ${data.session.user.email}` : 'No autenticado';
  } else {
    sessionLabel.textContent = localStore.session ? `Autenticado como ${localStore.session.email}` : 'No autenticado';
  }
}

document.querySelector('#auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitter = event.submitter;
  const action = submitter?.dataset.action;
  if (!action) return;
  const email = document.querySelector('#email').value.trim();
  const password = document.querySelector('#password').value;

  try {
    await auth(action, email, password);
    await renderSession();
    setStatus(action === 'register' ? 'Registro completado' : 'Sesión iniciada');
  } catch (error) {
    setStatus(error.message, true);
  }
});

document.querySelector('#logout').addEventListener('click', async () => {
  await logout();
  setStatus('Sesión cerrada');
});

document.querySelector('#reload-matches').addEventListener('click', async () => {
  try {
    const matches = await fetchMatches();
    populateMatches(matches);
    setStatus('Partidos actualizados');
  } catch (error) {
    setStatus(error.message, true);
  }
});

document.querySelector('#bet-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await saveBet({
      matchId: Number(document.querySelector('#match-id').value),
      homeGoals: Number(document.querySelector('#home-goals').value),
      awayGoals: Number(document.querySelector('#away-goals').value),
      champion: document.querySelector('#champion').value.trim(),
    });
    setStatus('Apuesta guardada');
  } catch (error) {
    setStatus(error.message, true);
  }
});

document.querySelector('#recalculate').addEventListener('click', async () => {
  try {
    await recalculateLeaderboard();
    setStatus('Clasificación recalculada');
  } catch (error) {
    setStatus(error.message, true);
  }
});

renderSession();
fetchMatches().then(populateMatches).catch((error) => setStatus(error.message, true));
