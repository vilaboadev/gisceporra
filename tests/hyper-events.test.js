import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getLastMatchesForTeam,
  fetchAllPastLeagueMatches,
  getLeagueLastEventsCache,
  fetchTeamLastMatches,
} from '../src/hyper.js';

test('getLastMatchesForTeam retorna els partits directes de la clau de l’equip', () => {
  const eventsByTeam = new Map([
    ['1337', [{ idEvent: 'E1', idHomeTeam: '1337', idAwayTeam: '1338', intHomeScore: '2', intAwayScore: '1' }]],
  ]);

  const matches = getLastMatchesForTeam(eventsByTeam, '1337');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].idEvent, 'E1');
});

test('getLastMatchesForTeam busca com a visitant en altres equips si no hi ha clau directa', () => {
  const eventsByTeam = new Map([
    ['1338', [{ idEvent: 'E2', idHomeTeam: '1338', idAwayTeam: '1337', intHomeScore: '0', intAwayScore: '1' }]],
  ]);

  const matches = getLastMatchesForTeam(eventsByTeam, '1337');
  assert.equal(matches.length, 1);
  assert.equal(matches[0].idEvent, 'E2');
});

test('getLastMatchesForTeam retorna array buit si no troba cap partit', () => {
  const eventsByTeam = new Map([
    ['1338', [{ idEvent: 'E2', idHomeTeam: '1338', idAwayTeam: '1339' }]],
  ]);

  const matches = getLastMatchesForTeam(eventsByTeam, '1337');
  assert.equal(matches.length, 0);
});

test('fetchAllPastLeagueMatches realitza peticions per lots paral·lels i organitza per equip', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const teamId = new URL(url).searchParams.get('id');
    return {
      ok: true,
      json: async () => ({
        results: [
          { idEvent: `E_${teamId}`, idHomeTeam: teamId, idAwayTeam: '9999', intHomeScore: '1', intAwayScore: '0' },
        ],
      }),
    };
  };

  try {
    const teamIds = ['1001', '1002', '1003'];
    const map = await fetchAllPastLeagueMatches(teamIds);

    assert.equal(map.size, 3);
    assert.equal(map.get('1001')[0].idEvent, 'E_1001');
    assert.equal(map.get('1002')[0].idEvent, 'E_1002');
    assert.equal(map.get('1003')[0].idEvent, 'E_1003');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchTeamLastMatches utilitza el cache de lliga', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCount = 0;

  globalThis.fetch = async (url) => {
    fetchCount++;
    const teamId = new URL(url).searchParams.get('id') || '1337';
    return {
      ok: true,
      json: async () => ({
        results: [
          { idEvent: `E_${teamId}`, idHomeTeam: teamId, idAwayTeam: '9999', intHomeScore: '3', intAwayScore: '0' },
        ],
      }),
    };
  };

  try {
    // Esborrem localStorage per forçar regenerar cache de lliga
    if (globalThis.localStorage) {
      globalThis.localStorage.clear();
    }

    const matches = await fetchTeamLastMatches('133735');
    assert.ok(Array.isArray(matches));
    assert.ok(matches.length > 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
