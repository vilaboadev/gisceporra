import test from 'node:test';
import assert from 'node:assert/strict';

import {
  espnEventToHyperMatch,
  fetchEspnLeagueMatches,
  fetchTeamNextMatches,
  fetchTeamLastMatches,
  fetchHyperStandings,
  fetchTeamDetails,
  fetchTeamPlayers,
  getLastMatchesForTeam,
  getNextMatchesForTeam,
} from '../src/hyper.js';

test('espnEventToHyperMatch transforma un esdeveniment d’ESPN a la lliga Hypermotion', () => {
  const espnEvent = {
    id: '401883226',
    date: '2026-08-14T18:30Z',
    status: { type: { completed: false, state: 'pre', name: 'STATUS_SCHEDULED' } },
    competitions: [
      {
        competitors: [
          {
            homeAway: 'home',
            team: { id: '20983', name: 'Real Sociedad II', displayName: 'Real Sociedad II', logo: 'https://a.espncdn.com/logo1.png' },
            score: '0',
          },
          {
            homeAway: 'away',
            team: { id: '4438', name: 'Castellón', displayName: 'Castellón', logo: 'https://a.espncdn.com/logo2.png' },
            score: '0',
          },
        ],
      },
    ],
  };

  const parsed = espnEventToHyperMatch(espnEvent);
  assert.equal(parsed.idEvent, '401883226');
  assert.equal(parsed.strHomeTeam, 'Real Sociedad II');
  assert.equal(parsed.strAwayTeam, 'Castellón');
  assert.equal(parsed.idHomeTeam, '20983');
  assert.equal(parsed.idAwayTeam, '4438');
  assert.equal(parsed.strDate, '2026-08-14');
  assert.equal(parsed.strTime, '18:30:00');
  assert.equal(parsed.intHomeScore, null);
  assert.equal(parsed.intAwayScore, null);
  assert.equal(parsed.strHomeBadge, 'https://a.espncdn.com/logo1.png');
  assert.equal(parsed.idLeague, 'esp.2');
});

test('espnEventToHyperMatch inclou gols si el partit està finalitzat', () => {
  const espnEvent = {
    id: '401883227',
    date: '2026-08-14T20:00Z',
    status: { type: { completed: true, state: 'post', name: 'STATUS_FULL_TIME' } },
    competitions: [
      {
        competitors: [
          { homeAway: 'home', team: { id: '2737', name: 'Albacete' }, score: '2' },
          { homeAway: 'away', team: { id: '98', name: 'Las Palmas' }, score: '1' },
        ],
      },
    ],
  };

  const parsed = espnEventToHyperMatch(espnEvent);
  assert.equal(parsed.intHomeScore, '2');
  assert.equal(parsed.intAwayScore, '1');
});

test('fetchTeamNextMatches i fetchTeamLastMatches filtren correctament per equip d’ESPN', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const urlStr = String(url);
    if (urlStr.includes('scoreboard')) {
      return {
        ok: true,
        json: async () => ({
          events: [
            {
              id: '101',
              date: '2026-08-10T18:00Z',
              status: { type: { completed: true, state: 'post' } },
              competitions: [{ competitors: [
                { homeAway: 'home', team: { id: '2737', name: 'Albacete' }, score: '1' },
                { homeAway: 'away', team: { id: '6832', name: 'Almería' }, score: '0' },
              ] }],
            },
            {
              id: '102',
              date: '2026-08-20T18:00Z',
              status: { type: { completed: false, state: 'pre' } },
              competitions: [{ competitors: [
                { homeAway: 'home', team: { id: '2737', name: 'Albacete' }, score: '0' },
                { homeAway: 'away', team: { id: '98', name: 'Las Palmas' }, score: '0' },
              ] }],
            },
          ],
        }),
      };
    }
    return { ok: false, status: 404 };
  };

  try {
    if (globalThis.localStorage) globalThis.localStorage.clear();

    const nextMatches = await fetchTeamNextMatches('Albacete');
    assert.equal(nextMatches.length, 1);
    assert.equal(nextMatches[0].idEvent, '102');

    const lastMatches = await fetchTeamLastMatches('Albacete');
    assert.equal(lastMatches.length, 1);
    assert.equal(lastMatches[0].idEvent, '101');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fetchHyperStandings obte i transforma la classificacio d’ESPN', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).includes('standings')) {
      return {
        ok: true,
        json: async () => ({
          children: [{
            standings: {
              entries: [
                {
                  team: { id: '2737', name: 'Albacete', logos: [{ href: 'https://logo.png' }] },
                  stats: [
                    { name: 'rank', value: 1 },
                    { name: 'gamesPlayed', value: 3 },
                    { name: 'wins', value: 2 },
                    { name: 'ties', value: 1 },
                    { name: 'losses', value: 0 },
                    { name: 'pointDifferential', value: 3 },
                    { name: 'points', value: 7 },
                  ],
                },
              ],
            },
          }],
        }),
      };
    }
    return { ok: false, status: 404 };
  };

  try {
    const table = await fetchHyperStandings('esp.2', '2026-2027');
    assert.equal(table.length, 1);
    assert.equal(table[0].idTeam, '2737');
    assert.equal(table[0].strTeam, 'Albacete');
    assert.equal(table[0].intRank, 1);
    assert.equal(table[0].intPlayed, 3);
    assert.equal(table[0].intPoints, 7);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
