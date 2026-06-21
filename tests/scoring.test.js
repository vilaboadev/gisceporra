import test from 'node:test';
import assert from 'node:assert/strict';

import { calculateCrystalBallPoints, calculateGroupPoints, calculateKnockoutPoints } from '../src/scoring.js';

test('calculateGroupPoints gives top3 and exact-position points', () => {
  const points = calculateGroupPoints(['A', 'B', 'C'], ['B', 'A', 'C']);
  assert.equal(points, 25);
});

test('calculateKnockoutPoints gives winner and exact points for semifinal', () => {
  const points = calculateKnockoutPoints(
    { homeGoals: 2, awayGoals: 1 },
    { round: 'semifinals', winner: 'Local', homeGoals: 2, awayGoals: 1, homeTeam: 'Local', awayTeam: 'Visitante' },
  );
  assert.equal(points, 60);
});

test('calculateCrystalBallPoints adds bonus', () => {
  assert.equal(calculateCrystalBallPoints('España', 'España'), 100);
  assert.equal(calculateCrystalBallPoints('España', 'Brasil'), 0);
});
