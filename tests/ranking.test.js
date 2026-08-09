import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRankingFromCache } from '../src/ranking.js';
import { hyperRankingDetailedHtml } from '../src/hyper.js';

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

test('hyperRankingDetailedHtml inclou botó per obrir/tancar i panells plegables de pronòstics', () => {
  const html = hyperRankingDetailedHtml([
    {
      username: 'user1',
      displayName: 'User One',
      teamName: 'Eibar',
      points: 10,
      predictions: [{ match_key: 'm1', home_team: 'Eibar', away_team: 'Racing', pred_home: 2, pred_away: 1 }],
      results: [{ match_key: 'm1', home_goals: 2, away_goals: 1 }],
    }
  ], 'user1');

  assert.ok(html.includes('toggleAllHyperMatches()'), 'Ha de contenir el botó general per obrir/tancar tots');
  assert.ok(html.includes("toggleHyperPlayerPronos('user1')"), 'Ha de contenir la crida toggle per usuari');
  assert.ok(html.includes('id="hyper-user-matches-user1"'), 'El panell de detalls ha de tenir ID especific');
  assert.ok(html.includes('class="hrd-matches hidden"'), 'El panell de detalls ha de començar ocult (class hidden)');
  assert.ok(html.includes('class="btn-close-panel"'), 'Ha de incloure el botó Tancar a l’interior del panell');
});
