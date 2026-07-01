import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRankingFromCache } from '../src/ranking.js';

test('buildRankingFromCache usa punts guardats a clasificacion i exclou TST per defecte', () => {
  const ranking = buildRankingFromCache({
    participants: [
      { username: 'ANA', display_name: 'Anna' },
      { username: 'TST', display_name: 'Test User' },
      { username: 'BOB', display_name: 'Bobby' },
    ],
    classification: [
      { username: 'BOB', puntos: 30 },
      { username: 'ANA', puntos: 45 },
    ],
    currentUsername: 'ANA',
  });

  assert.deepEqual(ranking, [
    { username: 'ANA', displayName: 'Anna', points: 45 },
    { username: 'BOB', displayName: 'Bobby', points: 30 },
  ]);
});

test('buildRankingFromCache inclou TST si és l’usuari actual', () => {
  const ranking = buildRankingFromCache({
    participants: [
      { username: 'ANA', display_name: 'Anna' },
      { username: 'TST', display_name: 'Test User' },
    ],
    classification: [
      { username: 'ANA', puntos: 15 },
      { username: 'TST', puntos: 5 },
    ],
    currentUsername: 'TST',
  });

  assert.deepEqual(ranking, [
    { username: 'ANA', displayName: 'Anna', points: 15 },
    { username: 'TST', displayName: 'Test User', points: 5 },
  ]);
});
