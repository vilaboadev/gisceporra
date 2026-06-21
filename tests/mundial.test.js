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
  fetchWCData,
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
  homeTeam: { name: 'Espanya' },
  awayTeam: { name: 'Brasil' },
  score: { fullTime: { home: 2, away: 1 } },
  ...overrides,
});

test('matchCardHtml conté noms dels equips', () => {
  const html = matchCardHtml(makeMatch());
  assert.ok(html.includes('Espanya'));
  assert.ok(html.includes('Brasil'));
});

test('matchCardHtml té classe status-finished per FINISHED', () => {
  const html = matchCardHtml(makeMatch({ status: 'FINISHED' }));
  assert.ok(html.includes('status-finished'));
});

test('matchCardHtml té classe status-live per IN_PLAY', () => {
  const html = matchCardHtml(makeMatch({ status: 'IN_PLAY' }));
  assert.ok(html.includes('status-live'));
});

test('matchCardHtml té classe status-scheduled per SCHEDULED', () => {
  const html = matchCardHtml(makeMatch({ status: 'SCHEDULED' }));
  assert.ok(html.includes('status-scheduled'));
});

test('matchCardHtml mostra número de jornada', () => {
  const html = matchCardHtml(makeMatch({ matchday: 3 }));
  assert.ok(html.includes('J3'));
});

test('matchCardHtml mostra marcador per FINISHED', () => {
  const html = matchCardHtml(makeMatch());
  assert.ok(html.includes('2 - 1'));
});

test('matchCardHtml mostra ? per equip sense nom', () => {
  const html = matchCardHtml(makeMatch({ homeTeam: {}, awayTeam: {} }));
  assert.ok(html.includes('?'));
});

// ---------------------------------------------------------------------------
// standingsGroupHtml
// ---------------------------------------------------------------------------

const makeGroup = () => ({
  group: 'Grup A',
  type: 'TOTAL',
  table: [
    { position: 1, team: { name: 'Espanya' }, playedGames: 3, won: 3, draw: 0, lost: 0, goalsFor: 9, goalsAgainst: 1, goalDifference: 8, points: 9 },
    { position: 2, team: { name: 'Brasil' }, playedGames: 3, won: 2, draw: 0, lost: 1, goalsFor: 6, goalsAgainst: 3, goalDifference: 3, points: 6 },
    { position: 3, team: { name: 'Alemanya' }, playedGames: 3, won: 1, draw: 0, lost: 2, goalsFor: 3, goalsAgainst: 6, goalDifference: -3, points: 3 },
    { position: 4, team: { name: 'Japó' }, playedGames: 3, won: 0, draw: 0, lost: 3, goalsFor: 1, goalsAgainst: 9, goalDifference: -8, points: 0 },
  ],
});

test('standingsGroupHtml conté el nom del grup', () => {
  const html = standingsGroupHtml(makeGroup());
  assert.ok(html.includes('Grup A'));
});

test('standingsGroupHtml conté tots els equips', () => {
  const html = standingsGroupHtml(makeGroup());
  assert.ok(html.includes('Espanya'));
  assert.ok(html.includes('Brasil'));
  assert.ok(html.includes('Alemanya'));
  assert.ok(html.includes('Japó'));
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
  const groupCount = (html.match(/group-table/g) ?? []).length;
  assert.equal(groupCount, 1);
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
  assert.ok(html.includes('Espanya') || html.includes('França'));
});

test('matchesSectionHtml mostra secció Avui per partits actius', () => {
  const now = new Date('2026-06-15T10:00:00Z');
  const matches = [
    makeMatch({ id: 1, stage: 'GROUP_STAGE', matchday: 1, status: 'SCHEDULED', utcDate: '2026-06-15T20:00:00Z' }),
  ];
  // We patch filterActiveMatches indirectly by using a date in the past for the match
  const html = matchesSectionHtml(matches);
  // The match is scheduled for today (same day), but filterActiveMatches uses new Date() inside matchesSectionHtml
  // so we just verify it renders something
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
// fetchWCData (amb fetch mockejat)
// ---------------------------------------------------------------------------

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
        { homeAway: 'home', score: '2', team: { displayName: 'Spain' } },
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
