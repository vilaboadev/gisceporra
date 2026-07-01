import test from 'node:test';
import assert from 'node:assert/strict';
import { mock } from 'node:test';

import {
  formatMatchDateTime,
  getMatchDisplayScore,
  groupMatchesByStage,
  filterActiveMatches,
  matchCardHtml,
  standingsGroupHtml,
  standingsHtml,
  matchesSectionHtml,
  knockoutBracketHtml,
  fetchWCData,
  adminUpdateSystem,
} from '../src/mundial.js';

// ---------------------------------------------------------------------------
// formatMatchDateTime
// ---------------------------------------------------------------------------

test('formatMatchDateTime retorna cadena no buida per data vàlida', () => {
  const result = formatMatchDateTime('2026-06-15T18:00:00Z');
  assert.ok(typeof result === 'string' && result.length > 0);
});

test('formatMatchDateTime retorna cadena buida per valor nul', () => {
  assert.equal(formatMatchDateTime(null), '');
  assert.equal(formatMatchDateTime(undefined), '');
  assert.equal(formatMatchDateTime(''), '');
});

// ---------------------------------------------------------------------------
// getMatchDisplayScore
// ---------------------------------------------------------------------------

test('getMatchDisplayScore retorna marcador per partit FINISHED', () => {
  const match = {
    status: 'FINISHED',
    score: { fullTime: { home: 2, away: 1 } },
    utcDate: '2026-06-15T18:00:00Z',
  };
  assert.equal(getMatchDisplayScore(match), '2 - 1');
});

test('getMatchDisplayScore retorna marcador per partit IN_PLAY', () => {
  const match = {
    status: 'IN_PLAY',
    score: { fullTime: { home: 1, away: 0 }, halfTime: { home: 1, away: 0 } },
    utcDate: '2026-06-15T18:00:00Z',
  };
  const result = getMatchDisplayScore(match);
  assert.ok(result.includes('-'));
});

test('getMatchDisplayScore retorna data formatada per SCHEDULED', () => {
  const match = {
    status: 'SCHEDULED',
    score: { fullTime: { home: null, away: null } },
    utcDate: '2026-06-20T20:00:00Z',
  };
  const result = getMatchDisplayScore(match);
  assert.ok(typeof result === 'string' && result.length > 0);
  assert.ok(!result.includes('null'));
});

test('getMatchDisplayScore retorna guions si no hi ha gols FINISHED', () => {
  const match = {
    status: 'FINISHED',
    score: { fullTime: { home: null, away: null } },
    utcDate: '2026-06-15T18:00:00Z',
  };
  assert.equal(getMatchDisplayScore(match), '- - -');
});

// ---------------------------------------------------------------------------
// groupMatchesByStage
// ---------------------------------------------------------------------------

test('groupMatchesByStage agrupa partits correctament per fase', () => {
  const matches = [
    { id: 1, stage: 'GROUP_STAGE' },
    { id: 2, stage: 'GROUP_STAGE' },
    { id: 3, stage: 'QUARTER_FINALS' },
  ];
  const result = groupMatchesByStage(matches);
  assert.equal(result['GROUP_STAGE'].length, 2);
  assert.equal(result['QUARTER_FINALS'].length, 1);
});

test('groupMatchesByStage retorna objecte buit per array buit', () => {
  assert.deepEqual(groupMatchesByStage([]), {});
});

test('groupMatchesByStage usa OTHER per partits sense fase', () => {
  const matches = [{ id: 1 }];
  const result = groupMatchesByStage(matches);
  assert.equal(result['OTHER'].length, 1);
});

// ---------------------------------------------------------------------------
// filterActiveMatches
// ---------------------------------------------------------------------------

test('filterActiveMatches inclou partits IN_PLAY', () => {
  const matches = [{ id: 1, status: 'IN_PLAY', utcDate: '2026-06-15T18:00:00Z' }];
  const result = filterActiveMatches(matches, new Date('2026-06-15T18:30:00Z'));
  assert.equal(result.length, 1);
});

test('filterActiveMatches inclou partits PAUSED', () => {
  const matches = [{ id: 1, status: 'PAUSED', utcDate: '2026-06-15T18:00:00Z' }];
  const result = filterActiveMatches(matches, new Date('2026-06-15T18:50:00Z'));
  assert.equal(result.length, 1);
});

test('filterActiveMatches inclou partits SCHEDULED per avui', () => {
  const now = new Date('2026-06-15T10:00:00Z');
  const matches = [{ id: 1, status: 'SCHEDULED', utcDate: '2026-06-15T20:00:00Z' }];
  const result = filterActiveMatches(matches, now);
  assert.equal(result.length, 1);
});

test('filterActiveMatches exclou partits FINISHED', () => {
  const matches = [{ id: 1, status: 'FINISHED', utcDate: '2026-06-15T18:00:00Z' }];
  const result = filterActiveMatches(matches, new Date('2026-06-15T22:00:00Z'));
  assert.equal(result.length, 0);
});

test('filterActiveMatches exclou partits SCHEDULED molt llunyans', () => {
  const now = new Date('2026-06-15T10:00:00Z');
  const matches = [{ id: 1, status: 'SCHEDULED', utcDate: '2026-07-01T20:00:00Z' }];
  const result = filterActiveMatches(matches, now);
  assert.equal(result.length, 0);
});

// ---------------------------------------------------------------------------
// matchCardHtml
// ---------------------------------------------------------------------------

const makeMatch = (overrides = {}) => ({
  id: 1,
  status: 'FINISHED',
  stage: 'GROUP_STAGE',
  matchday: 1,
  utcDate: '2026-06-15T18:00:00Z',
  homeTeam: { name: 'Spain' },
  awayTeam: { name: 'Brazil' },
  score: { fullTime: { home: 2, away: 1 } },
  ...overrides,
});

test('matchCardHtml conté noms dels equips', () => {
  const html = matchCardHtml(makeMatch());
  assert.ok(html.includes('Spain'));
  assert.ok(html.includes('Brazil'));
});

test('matchCardHtml té classe finished per FINISHED', () => {
  const html = matchCardHtml(makeMatch({ status: 'FINISHED' }));
  assert.ok(html.includes('match-card finished') || html.includes('match-status-badge finished'));
});

test('matchCardHtml té classe live per IN_PLAY', () => {
  const html = matchCardHtml(makeMatch({ status: 'IN_PLAY' }));
  assert.ok(html.includes('match-card live') || html.includes('match-status-badge live'));
});

test('matchCardHtml té classe scheduled per SCHEDULED', () => {
  const html = matchCardHtml(makeMatch({ status: 'SCHEDULED' }));
  assert.ok(html.includes('match-card scheduled') || html.includes('match-status-badge scheduled'));
});

test('matchCardHtml mostra el marcador per FINISHED en dues files', () => {
  const html = matchCardHtml(makeMatch());
  assert.ok(html.includes('>2<') && html.includes('>1<'));
});

test('matchCardHtml no mostra null per partits programats', () => {
  const html = matchCardHtml(makeMatch({ status: 'SCHEDULED', score: { fullTime: { home: null, away: null } } }));
  assert.ok(!html.includes('null'));
});

test('matchCardHtml mostra data i hora per partits programats', () => {
  const html = matchCardHtml(makeMatch({ status: 'SCHEDULED', utcDate: '2026-07-01T20:00:00Z' }));
  assert.ok(html.includes('match-datetime'));
  assert.ok(!html.includes('null'));
});

test('matchCardHtml partits programats mostren els dos equips en la mateixa fila', () => {
  const html = matchCardHtml(makeMatch({ status: 'SCHEDULED' }));
  assert.ok(html.includes('match-vs'));
  assert.ok(html.includes('Spain') && html.includes('Brazil'));
});

// ---------------------------------------------------------------------------
// standingsGroupHtml
// ---------------------------------------------------------------------------

const makeGroup = () => ({
  group: 'Group A',
  type: 'TOTAL',
  table: [
    { position: 1, team: { name: 'Spain' }, playedGames: 3, won: 3, draw: 0, lost: 0, goalsFor: 9, goalsAgainst: 1, goalDifference: 8, points: 9 },
    { position: 2, team: { name: 'Brazil' }, playedGames: 3, won: 2, draw: 0, lost: 1, goalsFor: 6, goalsAgainst: 3, goalDifference: 3, points: 6 },
    { position: 3, team: { name: 'Germany' }, playedGames: 3, won: 1, draw: 0, lost: 2, goalsFor: 3, goalsAgainst: 6, goalDifference: -3, points: 3 },
    { position: 4, team: { name: 'Japan' }, playedGames: 3, won: 0, draw: 0, lost: 3, goalsFor: 1, goalsAgainst: 9, goalDifference: -8, points: 0 },
  ],
});

test('standingsGroupHtml conté el nom del grup', () => {
  const html = standingsGroupHtml(makeGroup());
  assert.ok(html.includes('Group A'));
});

test('standingsGroupHtml conté tots els equips', () => {
  const html = standingsGroupHtml(makeGroup());
  assert.ok(html.includes('Spain'));
  assert.ok(html.includes('Brazil'));
  assert.ok(html.includes('Germany'));
  assert.ok(html.includes('Japan'));
});

test('standingsGroupHtml marca els dos primers com qualified', () => {
  const html = standingsGroupHtml(makeGroup());
  const qualifiedCount = (html.match(/class="qualified"/g) ?? []).length;
  assert.equal(qualifiedCount, 2);
});

test('standingsGroupHtml mostra els punts correctes', () => {
  const html = standingsGroupHtml(makeGroup());
  assert.ok(html.includes('>9<'));
  assert.ok(html.includes('>6<'));
});

// ---------------------------------------------------------------------------
// standingsHtml
// ---------------------------------------------------------------------------

test('standingsHtml retorna missatge buit per array buit', () => {
  const html = standingsHtml([]);
  assert.ok(html.includes('muted'));
});

test('standingsHtml retorna missatge buit per standings null', () => {
  const html = standingsHtml(null);
  assert.ok(html.includes('muted'));
});

test('standingsHtml filtra grups per tipus TOTAL', () => {
  const standings = [
    { type: 'TOTAL', group: 'Grup A', table: [] },
    { type: 'HOME', group: 'Grup A', table: [] },
  ];
  const html = standingsHtml(standings);
  const groupCount = (html.match(/standings-group/g) ?? []).length;
  assert.ok(groupCount >= 1);
});

test('standingsHtml renderitza múltiples grups', () => {
  const standings = [
    { type: 'TOTAL', group: 'Grup A', table: [] },
    { type: 'TOTAL', group: 'Grup B', table: [] },
  ];
  const html = standingsHtml(standings);
  assert.ok(html.includes('Grup A'));
  assert.ok(html.includes('Grup B'));
});

// ---------------------------------------------------------------------------
// matchesSectionHtml
// ---------------------------------------------------------------------------

test('matchesSectionHtml retorna missatge buit per array buit', () => {
  const html = matchesSectionHtml([]);
  assert.ok(html.includes('muted'));
});

test('matchesSectionHtml retorna missatge buit per null', () => {
  const html = matchesSectionHtml(null);
  assert.ok(html.includes('muted'));
});

test('matchesSectionHtml inclou partits FINISHED de fase de grups', () => {
  const matches = [
    makeMatch({ id: 1, stage: 'GROUP_STAGE', matchday: 1, status: 'FINISHED' }),
    makeMatch({ id: 2, stage: 'GROUP_STAGE', matchday: 1, status: 'FINISHED', homeTeam: { name: 'França' }, awayTeam: { name: 'Portugal' }, score: { fullTime: { home: 1, away: 0 } } }),
  ];
  const html = matchesSectionHtml(matches);
  assert.ok(html.includes('Spain') || html.includes('France'));
});

test('matchesSectionHtml mostra seccio propers per partits programats', () => {
  const matches = [
    makeMatch({ id: 1, stage: 'GROUP_STAGE', matchday: 1, status: 'SCHEDULED', utcDate: '2026-06-15T20:00:00Z' }),
  ];
  const html = matchesSectionHtml(matches);
  assert.ok(typeof html === 'string' && html.length > 0);
});

test('matchesSectionHtml inclou partits eliminatories', () => {
  const matches = [
    makeMatch({ id: 1, stage: 'SEMI_FINALS', matchday: null, status: 'FINISHED' }),
  ];
  const html = matchesSectionHtml(matches);
  assert.ok(html.includes('Semifinals') || html.includes('Espanya'));
});

// ---------------------------------------------------------------------------
// knockoutBracketHtml
// ---------------------------------------------------------------------------

test('knockoutBracketHtml retorna missatge buit per array buit', () => {
  const html = knockoutBracketHtml([]);
  assert.ok(html.includes('muted'));
});

test('knockoutBracketHtml retorna missatge si nomes hi ha fase de grups', () => {
  const matches = [makeMatch({ stage: 'GROUP_STAGE' })];
  const html = knockoutBracketHtml(matches);
  assert.ok(html.includes('muted') || html.includes('eliminat'));
});

test('knockoutBracketHtml mostra partits de semis', () => {
  const matches = [
    makeMatch({ id: 1, stage: 'SEMI_FINALS', status: 'FINISHED', homeTeam: { name: 'Espanya' }, awayTeam: { name: 'Argentina' }, score: { fullTime: { home: 2, away: 1 } } }),
  ];
  const html = knockoutBracketHtml(matches);
  assert.ok(html.includes('Semifinals'));
  assert.ok(html.includes('Espanya'));
  assert.ok(html.includes('Argentina'));
});

test('knockoutBracketHtml marca el guanyador del partit', () => {
  const matches = [
    makeMatch({ id: 1, stage: 'FINAL', status: 'FINISHED', homeTeam: { name: 'Spain' }, awayTeam: { name: 'Brazil' }, score: { fullTime: { home: 3, away: 1 } } }),
  ];
  const html = knockoutBracketHtml(matches);
  assert.ok(html.includes('winner'));
  assert.ok(html.includes('Final'));
});

test('knockoutBracketHtml mostra data per partits programats', () => {
  const matches = [
    makeMatch({ id: 1, stage: 'ROUND_OF_16', status: 'SCHEDULED', utcDate: '2026-07-01T20:00:00Z', score: { fullTime: { home: null, away: null } } }),
  ];
  const html = knockoutBracketHtml(matches);
  assert.ok(html.includes('Vuitens'));
  assert.ok(!html.includes('null'));
});



test('fetchWCData retorna matches i standings en èxit', async () => {
  const mockMatches = [{
    id: '1',
    date: '2026-06-15T18:00:00Z',
    name: 'Spain at Brazil',
    season: { slug: 'group-stage' },
    competitions: [{
      altGameNote: 'FIFA World Cup, Group A',
      status: { type: { name: 'STATUS_FULL_TIME' } },
      competitors: [
        { homeAway: 'home', score: '2', winner: true, team: { displayName: 'Spain' } },
        { homeAway: 'away', score: '1', team: { displayName: 'Brazil' } },
      ],
    }],
  }];
  const mockStandings = {
    children: [{
      name: 'Group A',
      standings: {
        entries: [{
          team: { displayName: 'Spain' },
          stats: [
            { name: 'gamesPlayed', value: 1 },
            { name: 'wins', value: 1 },
            { name: 'ties', value: 0 },
            { name: 'losses', value: 0 },
            { name: 'pointsFor', value: 2 },
            { name: 'pointsAgainst', value: 1 },
            { name: 'pointDifferential', value: 1 },
            { name: 'points', value: 3 },
            { name: 'rank', value: 1 },
          ],
        }],
      },
    }],
  };

  globalThis.fetch = async (url) => {
    if (url.includes('scoreboard')) {
      return { ok: true, json: async () => ({ events: mockMatches }) };
    }
    return { ok: true, json: async () => mockStandings };
  };

  const result = await fetchWCData();
  assert.equal(result.matches.length, 1);
  assert.equal(result.matches[0].homeTeam.name, 'Spain');
  assert.equal(result.matches[0].status, 'FINISHED');
  assert.equal(result.matches[0].winner, 'Spain');
  assert.equal(result.standings.length, 1);
  assert.equal(result.standings[0].group, 'Group A');
  assert.equal(result.errors.length, 0);

  delete globalThis.fetch;
});

test('fetchWCData retorna errors parcials si un endpoint falla', async () => {
  globalThis.fetch = async (url) => {
    if (url.includes('scoreboard')) {
      return { ok: true, json: async () => ({ events: [] }) };
    }
    return { ok: false, status: 403 };
  };

  const result = await fetchWCData();
  assert.equal(result.matches.length, 0);
  assert.equal(result.errors.length, 1);

  delete globalThis.fetch;
});

test('fetchWCData retorna arrays buits si tots els endpoints fallen', async () => {
  globalThis.fetch = async () => ({ ok: false, status: 500 });

  const result = await fetchWCData();
  assert.equal(result.matches.length, 0);
  assert.equal(result.standings.length, 0);
  assert.equal(result.errors.length, 2);

  delete globalThis.fetch;
});

test('adminUpdateSystem bloqueja usuaris no admin sense recàlcul', async () => {
  let alertMsg = '';
  const originalAlert = globalThis.alert;
  globalThis.alert = (msg) => { alertMsg = msg; };

  let fetchCalled = false;
  const result = await adminUpdateSystem({
    currentUser: { username: 'AAA', tipus: 'normal' },
    dbClient: {},
    fetchData: async () => {
      fetchCalled = true;
      return { matches: [], standings: [], errors: [] };
    },
  });

  assert.equal(result, false);
  assert.equal(fetchCalled, false);
  assert.ok(alertMsg.includes('Només els administradors'));

  globalThis.alert = originalAlert;
});

test('adminUpdateSystem falla si falta el client de Supabase', async () => {
  let alertMsg = '';
  const originalAlert = globalThis.alert;
  globalThis.alert = (msg) => { alertMsg = msg; };

  const result = await adminUpdateSystem({
    currentUser: { username: 'ADM', tipus: 'admin' },
    dbClient: null,
  });

  assert.equal(result, false);
  assert.ok(alertMsg.includes("No s'ha trobat l'objecte de Supabase"));

  globalThis.alert = originalAlert;
});

test('adminUpdateSystem usa fetchData injectat i completa el recàlcul', async () => {
  const originalAlert = globalThis.alert;
  globalThis.alert = () => {};

  let fetchCalled = false;
  const upserts = [];
  const dbClient = {
    from(table) {
      return {
        async upsert(rows) {
          upserts.push({ table, rows });
          return { error: null };
        },
        async select() {
          if (table === 'participants') return { data: [{ username: 'ADM' }], error: null };
          if (table === 'group_predictions') return { data: [], error: null };
          return { data: [], error: null };
        },
      };
    },
  };

  const result = await adminUpdateSystem({
    currentUser: { username: 'ADM', tipus: 'admin' },
    dbClient,
    fetchData: async () => {
      fetchCalled = true;
      return {
        matches: [],
        standings: [{
          type: 'TOTAL',
          group: 'Group A',
          table: [
            { position: 1, playedGames: 3, team: { name: 'Spain' } },
            { position: 2, playedGames: 3, team: { name: 'Brazil' } },
            { position: 3, playedGames: 3, team: { name: 'Germany' } },
            { position: 4, playedGames: 3, team: { name: 'Japan' } },
          ],
        }],
        errors: [],
      };
    },
  });

  assert.equal(result, true);
  assert.equal(fetchCalled, true);
  assert.ok(upserts.some((x) => x.table === 'group_results'));
  assert.ok(upserts.some((x) => x.table === 'clasificacion'));

  globalThis.alert = originalAlert;
});

test('adminUpdateSystem recalcula punts d’eliminatòries assolides', async () => {
  const originalAlert = globalThis.alert;
  globalThis.alert = () => {};

  let clasificacionRows = [];
  const knockoutRows = [];
  const dbClient = {
    from(table) {
      return {
        async upsert(rows) {
          if (table === 'clasificacion') clasificacionRows = rows;
          if (table === 'knockout_results') {
            knockoutRows.length = 0;
            knockoutRows.push(...rows);
          }
          return { error: null };
        },
        async select() {
          if (table === 'participants') return { data: [{ username: 'ADM' }], error: null };
          if (table === 'group_predictions') return { data: [], error: null };
          if (table === 'pronostics') {
            return {
              data: [{
                username: 'ADM',
                match_key: '77',
                pred_home_goals: 2,
                pred_away_goals: 1,
                tie_winner: null,
                round: 'semifinals',
              }],
              error: null,
            };
          }
          if (table === 'champion_predictions') return { data: [], error: null };
          if (table === 'knockout_results') return { data: knockoutRows, error: null };
          return { data: [], error: null };
        },
      };
    },
  };

  const result = await adminUpdateSystem({
    currentUser: { username: 'ADM', tipus: 'admin' },
    dbClient,
    fetchData: async () => ({
      matches: [{
        id: '77',
        status: 'FINISHED',
        stage: 'SEMI_FINALS',
        winner: 'Spain',
        homeTeam: { name: 'Spain' },
        awayTeam: { name: 'Brazil' },
        score: { fullTime: { home: 2, away: 1 } },
      }],
      standings: [],
      errors: [],
    }),
  });

  assert.equal(result, true);
  // semifinals: winner (20) + exact score (40) = 60
  assert.equal(clasificacionRows[0]?.puntos, 60);

  globalThis.alert = originalAlert;
});

test('adminUpdateSystem persisteix caches tancades i recalcula classificacio des de BDD', async () => {
  const originalAlert = globalThis.alert;
  globalThis.alert = () => {};

  const storage = {
    group_results: [],
    knockout_results: [],
    clasificacion: [],
  };

  const upsertRow = (table, row) => {
    const key = table === 'group_results' ? 'group_name' : table === 'knockout_results' ? 'match_key' : 'username';
    const index = storage[table].findIndex((item) => item[key] === row[key]);
    if (index >= 0) storage[table][index] = { ...storage[table][index], ...row };
    else storage[table].push({ ...row });
  };

  const dbClient = {
    from(table) {
      return {
        async upsert(rows) {
          const list = Array.isArray(rows) ? rows : [rows];
          if (storage[table]) list.forEach((row) => upsertRow(table, row));
          return { error: null };
        },
        async select() {
          if (table === 'participants') {
            return { data: [{ username: 'ADM' }, { username: 'ANA' }], error: null };
          }
          if (table === 'group_predictions') {
            return {
              data: [{
                username: 'ANA',
                group_name: 'A',
                pred_1st: 'Spain',
                pred_2nd: 'Brazil',
                pred_3rd: 'Germany',
              }],
              error: null,
            };
          }
          if (table === 'pronostics') {
            return {
              data: [{
                username: 'ANA',
                match_key: '77',
                pred_home_goals: 1,
                pred_away_goals: 0,
                tie_winner: null,
                round: 'final',
              }],
              error: null,
            };
          }
          if (table === 'champion_predictions') {
            return { data: [{ username: 'ANA', champion: 'Spain' }], error: null };
          }
          return { data: storage[table] ?? [], error: null };
        },
      };
    },
  };

  const result = await adminUpdateSystem({
    currentUser: { username: 'ADM', tipus: 'admin' },
    dbClient,
    fetchData: async () => ({
      matches: [{
        id: '77',
        status: 'FINISHED',
        stage: 'FINAL',
        winner: 'Spain',
        homeTeam: { name: 'Spain' },
        awayTeam: { name: 'Brazil' },
        score: { fullTime: { home: 1, away: 0 } },
      }],
      standings: [
        {
          type: 'TOTAL',
          group: 'Group A',
          table: [
            { position: 1, playedGames: 3, team: { name: 'Spain' } },
            { position: 2, playedGames: 3, team: { name: 'Brazil' } },
            { position: 3, playedGames: 3, team: { name: 'Germany' } },
            { position: 4, playedGames: 3, team: { name: 'Japan' } },
          ],
        },
        {
          type: 'TOTAL',
          group: 'Group B',
          table: [
            { position: 1, playedGames: 3, team: { name: 'France' } },
            { position: 2, playedGames: 3, team: { name: 'Argentina' } },
            { position: 3, playedGames: 2, team: { name: 'Mexico' } },
            { position: 4, playedGames: 3, team: { name: 'Canada' } },
          ],
        },
      ],
      errors: [],
    }),
  });

  assert.equal(result, true);
  assert.equal(storage.group_results.length, 2);
  assert.equal(storage.group_results.find((row) => row.group_name === 'A')?.actual_1st, 'Spain');
  assert.equal(storage.group_results.find((row) => row.group_name === 'campio')?.actual_1st, 'Spain');
  assert.equal(storage.group_results.some((row) => row.group_name === 'B'), false);

  assert.equal(storage.knockout_results.length, 1);
  assert.deepEqual(storage.knockout_results[0], {
    match_key: '77',
    round: 'final',
    winner: 'Spain',
    home_team: 'Spain',
    away_team: 'Brazil',
    home_goals: 1,
    away_goals: 0,
    updated_at: storage.knockout_results[0].updated_at,
  });

  assert.equal(storage.clasificacion.find((row) => row.username === 'ANA')?.puntos, 210);
  assert.equal(storage.clasificacion.find((row) => row.username === 'ADM')?.puntos, 0);

  globalThis.alert = originalAlert;
});

// ---------------------------------------------------------------------------
// flags.js — formatPlaceholder i teamWithFlag
// ---------------------------------------------------------------------------
import { formatPlaceholder, teamWithFlag, getFlag } from '../src/flags.js';
import { isPlaceholderName } from '../src/mundial.js';

test('formatPlaceholder converteix Group Winner a 1r', () => {
  assert.equal(formatPlaceholder('Group A Winner'), '🏆 Grup A · 1r');
  assert.equal(formatPlaceholder('Group L Winner'), '🏆 Grup L · 1r');
});

test('formatPlaceholder converteix 2nd Place a 2n', () => {
  assert.equal(formatPlaceholder('Group B 2nd Place'), '🥈 Grup B · 2n');
});

test('formatPlaceholder converteix Round of 32', () => {
  assert.equal(formatPlaceholder('Round of 32 5 Winner'), 'Setzens #5');
});

test('formatPlaceholder converteix Round of 16', () => {
  assert.equal(formatPlaceholder('Round of 16 3 Winner'), 'Vuitens #3');
});

test('formatPlaceholder converteix Quarterfinal', () => {
  assert.equal(formatPlaceholder('Quarterfinal 2 Winner'), 'Quarts #2');
});

test('formatPlaceholder converteix Semifinal Winner i Loser', () => {
  assert.equal(formatPlaceholder('Semifinal 1 Winner'), 'Semi #1');
  assert.equal(formatPlaceholder('Semifinal 2 Loser'), 'Semi #2 (3r lloc)');
});

test('formatPlaceholder converteix Third Place Group', () => {
  const r = formatPlaceholder('Third Place Group A/B/C/D/F');
  assert.ok(r.includes('3rs') && r.includes('A/B/C/D/F'));
});

test('formatPlaceholder retorna nom real sense canvis', () => {
  assert.equal(formatPlaceholder('Spain'), 'Spain');
  assert.equal(formatPlaceholder('Brazil'), 'Brazil');
});

test('teamWithFlag afegeix bandera per noms reals', () => {
  const r = teamWithFlag('Spain');
  assert.ok(r.includes('🇪🇸') && r.includes('Spain'));
});

test('teamWithFlag converteix placeholder sense bandera', () => {
  const r = teamWithFlag('Group A Winner');
  assert.ok(r.includes('Grup A') && r.includes('1r'));
  assert.ok(!r.includes('🇪🇸'));
});

test('getFlag retorna string buit per noms desconeguts', () => {
  assert.equal(getFlag('Unknown Team'), '');
  assert.equal(getFlag(''), '');
  assert.equal(getFlag(null), '');
});

test('isPlaceholderName retorna true per Group A Winner', () => {
  assert.equal(isPlaceholderName('Group A Winner'), true);
});

test('isPlaceholderName retorna true per Group B 2nd Place', () => {
  assert.equal(isPlaceholderName('Group B 2nd Place'), true);
});

test('isPlaceholderName retorna true per Round of 32 1 Winner', () => {
  assert.equal(isPlaceholderName('Round of 32 1 Winner'), true);
});

test('isPlaceholderName retorna true per Quarterfinal 2 Winner', () => {
  assert.equal(isPlaceholderName('Quarterfinal 2 Winner'), true);
});

test('isPlaceholderName retorna true per Semifinal 1 Winner', () => {
  assert.equal(isPlaceholderName('Semifinal 1 Winner'), true);
});

test('isPlaceholderName retorna true per Semifinal 1 Loser', () => {
  assert.equal(isPlaceholderName('Semifinal 1 Loser'), true);
});

test('isPlaceholderName retorna true per Third Place Group A/B', () => {
  assert.equal(isPlaceholderName('Third Place Group A/B'), true);
});

test('isPlaceholderName retorna false per noms reals', () => {
  assert.equal(isPlaceholderName('Spain'), false);
  assert.equal(isPlaceholderName('Brazil'), false);
  assert.equal(isPlaceholderName('England'), false);
  assert.equal(isPlaceholderName('United States'), false);
});

test('isPlaceholderName retorna false per buit/null', () => {
  assert.equal(isPlaceholderName(''), false);
  assert.equal(isPlaceholderName(null), false);
  assert.equal(isPlaceholderName(undefined), false);
});
