import test from 'node:test';
import assert from 'node:assert/strict';

import { buildRankingFromCache } from '../src/ranking.js';
import { hyperRankingDetailedHtml, hyperAvatarHtml } from '../src/hyper.js';
import { getTeamBadgeUrl } from '../src/hyper-teams.js';

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

test('getTeamBadgeUrl retorna l’URL de l’API d’ESPN per un equip', () => {
  assert.equal(getTeamBadgeUrl('Eibar'), 'https://a.espncdn.com/i/teamlogos/soccer/500/3752.png');
  assert.equal(getTeamBadgeUrl('3752'), 'https://a.espncdn.com/i/teamlogos/soccer/500/3752.png');
  assert.equal(getTeamBadgeUrl('Desconegut'), null);
});

test('hyperAvatarHtml genera l’HTML de l’avatar amb inicials i escut API', () => {
  const html = hyperAvatarHtml({ username: 'Joan', avatarUrl: 'https://example.com/avatar.png', teamName: 'Eibar' });
  assert.ok(html.includes('hyper-avatar-wrap'));
  assert.ok(html.includes('https://example.com/avatar.png'));
  assert.ok(html.includes('https://a.espncdn.com/i/teamlogos/soccer/500/3752.png'));
  assert.ok(html.includes('ha-crest-img'));
});

test('hyperRankingDetailedHtml inclou avatar i botons plegables', () => {
  const html = hyperRankingDetailedHtml([
    {
      username: 'user1',
      displayName: 'User One',
      teamName: 'Eibar',
      avatarUrl: 'https://example.com/u1.png',
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
  assert.ok(html.includes('hyper-avatar-wrap'), 'Ha de incloure l’avatar enlloc de la crest simple');
  assert.ok(html.includes('https://a.espncdn.com/i/teamlogos/soccer/500/3752.png'), 'Ha de incloure l’escut de l’API');
});
