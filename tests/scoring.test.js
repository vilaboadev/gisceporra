import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateCrystalBallPoints,
  calculateGroupPoints,
  calculateKnockoutPoints,
  calculateGroupPointsDetailed,
  getKnockoutPointsBadgeColor,
} from '../src/scoring.js';

test('calculateGroupPoints gives 5 for top3 and 5 more for exact position (10 total)', () => {
  // Predicted: [A, B, C], Actual: [B, A, C]
  // A → top3 (wrong pos) = 5, B → top3 (wrong pos) = 5, C → top3 + exact = 5+5 = 10
  const points = calculateGroupPoints(['A', 'B', 'C'], ['B', 'A', 'C']);
  assert.equal(points, 20);
});

test('calculateGroupPoints gives 0 for empty predictions', () => {
  assert.equal(calculateGroupPoints([], ['A', 'B', 'C']), 0);
  assert.equal(calculateGroupPoints(['A', 'B', 'C'], []), 0);
});

test('calculateGroupPointsDetailed retorna desglossament per equip', () => {
  // Predicted: Mèxic(1), Korea(2), RSA(3)
  // Actual: Mèxic(1), RSA(2), Korea(3), Txèquia(4)
  const actual = ['Mèxic', 'RSA', 'Korea', 'Txèquia'];
  const prediction = { pred_1st: 'Mèxic', pred_2nd: 'Korea', pred_3rd: 'RSA' };
  const result = calculateGroupPointsDetailed(actual, prediction);

  assert.equal(result.length, 4);

  // Mèxic: pos 1, pred 1 → exact → 10, classifica
  assert.equal(result[0].position, 1);
  assert.equal(result[0].team, 'Mèxic');
  assert.equal(result[0].predicted, 1);
  assert.equal(result[0].points, 10);
  assert.equal(result[0].classified, true);

  // RSA: pos 2, pred 3 → top3 wrong pos → 5, classifica
  assert.equal(result[1].position, 2);
  assert.equal(result[1].team, 'RSA');
  assert.equal(result[1].predicted, 3);
  assert.equal(result[1].points, 5);
  assert.equal(result[1].classified, true);

  // Korea: pos 3, pred 2 → top3 wrong pos → 5, no classifica
  assert.equal(result[2].position, 3);
  assert.equal(result[2].team, 'Korea');
  assert.equal(result[2].predicted, 2);
  assert.equal(result[2].points, 5);
  assert.equal(result[2].classified, false);

  // Txèquia: pos 4, no pred → 0, no classifica
  assert.equal(result[3].position, 4);
  assert.equal(result[3].team, 'Txèquia');
  assert.equal(result[3].predicted, null);
  assert.equal(result[3].points, 0);
  assert.equal(result[3].classified, false);
});

test('calculateGroupPointsDetailed amb tots els encerts exactes', () => {
  const actual = ['A', 'B', 'C', 'D'];
  const prediction = { pred_1st: 'A', pred_2nd: 'B', pred_3rd: 'C' };
  const result = calculateGroupPointsDetailed(actual, prediction);
  assert.equal(result[0].points, 10); // A: exact
  assert.equal(result[1].points, 10); // B: exact
  assert.equal(result[2].points, 10); // C: exact
  assert.equal(result[3].points, 0);  // D: no pred
  const total = result.reduce((s, r) => s + r.points, 0);
  assert.equal(total, 30);
});

test('calculateGroupPointsDetailed cap al top3', () => {
  const actual = ['W', 'X', 'Y', 'Z'];
  const prediction = { pred_1st: 'P', pred_2nd: 'Q', pred_3rd: 'R' };
  const result = calculateGroupPointsDetailed(actual, prediction);
  result.forEach(r => assert.equal(r.points, 0));
});

test('calculateGroupPointsDetailed total coincideix amb calculateGroupPoints', () => {
  const actual = ['Mèxic', 'RSA', 'Korea', 'Txèquia'];
  const prediction = { pred_1st: 'Mèxic', pred_2nd: 'Korea', pred_3rd: 'RSA' };
  const detailed = calculateGroupPointsDetailed(actual, prediction);
  const totalDetailed = detailed.reduce((s, r) => s + r.points, 0);
  const totalSimple = calculateGroupPoints(
    [prediction.pred_1st, prediction.pred_2nd, prediction.pred_3rd],
    actual.slice(0, 3)
  );
  assert.equal(totalDetailed, totalSimple);
});

test('calculateKnockoutPoints gives winner and exact points for semifinal', () => {
  const points = calculateKnockoutPoints(
    { homeGoals: 2, awayGoals: 1 },
    { round: 'semifinals', winner: 'Local', homeGoals: 2, awayGoals: 1, homeTeam: 'Local', awayTeam: 'Visitante' },
  );
  assert.equal(points, 40);
});

test('calculateKnockoutPoints gives only exact points when draw result but wrong tie_winner', () => {
  // MVF case: predicted 1-1 Netherlands, actual 1-1 Morocco advances
  const points = calculateKnockoutPoints(
    { homeGoals: 1, awayGoals: 1, tieWinner: 'Netherlands' },
    { round: 'setzens', winner: 'Morocco', homeGoals: 1, awayGoals: 1, homeTeam: 'Netherlands', awayTeam: 'Morocco' },
  );
  assert.equal(points, 10);
});

test('getKnockoutPointsBadgeColor is yellow when exact draw but wrong tie_winner', () => {
  const color = getKnockoutPointsBadgeColor(
    { homeGoals: 1, awayGoals: 1, tieWinner: 'Netherlands' },
    { round: 'setzens', winner: 'Morocco', homeGoals: 1, awayGoals: 1, homeTeam: 'Netherlands', awayTeam: 'Morocco' },
  );
  assert.equal(color, 'pts-yellow');
});

test('calculateKnockoutPoints gives winner + exact points when draw result and correct tie_winner', () => {
  const points = calculateKnockoutPoints(
    { homeGoals: 1, awayGoals: 1, tieWinner: 'Morocco' },
    { round: 'setzens', winner: 'Morocco', homeGoals: 1, awayGoals: 1, homeTeam: 'Netherlands', awayTeam: 'Morocco' },
  );
  assert.equal(points, 20);
});

test('getKnockoutPointsBadgeColor is green when exact draw and correct tie_winner', () => {
  const color = getKnockoutPointsBadgeColor(
    { homeGoals: 1, awayGoals: 1, tieWinner: 'Morocco' },
    { round: 'setzens', winner: 'Morocco', homeGoals: 1, awayGoals: 1, homeTeam: 'Netherlands', awayTeam: 'Morocco' },
  );
  assert.equal(color, 'pts-green');
});

test('calculateKnockoutPoints gives exact points only when both winner and tie_winner are null but score matches', () => {
  const points = calculateKnockoutPoints(
    { homeGoals: 1, awayGoals: 1, tieWinner: null },
    { round: 'setzens', winner: null, homeGoals: 1, awayGoals: 1, homeTeam: 'Netherlands', awayTeam: 'Morocco' },
  );
  assert.equal(points, 10);
});

test('calculateKnockoutPoints gives 0 when both winner and tie_winner are null and score does not match', () => {
  const points = calculateKnockoutPoints(
    { homeGoals: 2, awayGoals: 1, tieWinner: null },
    { round: 'setzens', winner: null, homeGoals: 1, awayGoals: 1, homeTeam: 'Netherlands', awayTeam: 'Morocco' },
  );
  assert.equal(points, 0);
});

test('calculateKnockoutPoints gives only winner points when correct winner but wrong score', () => {
  const points = calculateKnockoutPoints(
    { homeGoals: 2, awayGoals: 0 },
    { round: 'quarts', winner: 'Local', homeGoals: 1, awayGoals: 0, homeTeam: 'Local', awayTeam: 'Visitante' },
  );
  assert.equal(points, 15);
});

test('calculateKnockoutPoints max points per round', () => {
  assert.equal(calculateKnockoutPoints(
    { homeGoals: 2, awayGoals: 1 },
    { round: 'setzens', winner: 'L', homeGoals: 2, awayGoals: 1, homeTeam: 'L', awayTeam: 'V' },
  ), 20);
  assert.equal(calculateKnockoutPoints(
    { homeGoals: 2, awayGoals: 1 },
    { round: 'quarts', winner: 'L', homeGoals: 2, awayGoals: 1, homeTeam: 'L', awayTeam: 'V' },
  ), 30);
  assert.equal(calculateKnockoutPoints(
    { homeGoals: 2, awayGoals: 1 },
    { round: 'semifinals', winner: 'L', homeGoals: 2, awayGoals: 1, homeTeam: 'L', awayTeam: 'V' },
  ), 40);
  assert.equal(calculateKnockoutPoints(
    { homeGoals: 2, awayGoals: 1 },
    { round: 'final', winner: 'L', homeGoals: 2, awayGoals: 1, homeTeam: 'L', awayTeam: 'V' },
  ), 50);
});

test('calculateCrystalBallPoints adds bonus', () => {
  assert.equal(calculateCrystalBallPoints('España', 'España'), 100);
  assert.equal(calculateCrystalBallPoints('España', 'Brasil'), 0);
});
