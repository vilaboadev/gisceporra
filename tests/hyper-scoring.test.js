import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateHyperMatchPoints,
  getHyperBadgeColor,
  calculateHyperUserTotal,
} from '../src/hyper-scoring.js';

// ── calculateHyperMatchPoints ──────────────────────────────────────────────

test('calculateHyperMatchPoints dona 3 punts per resultat exacte', () => {
  assert.equal(calculateHyperMatchPoints({ pred_home: 2, pred_away: 1 }, { home_goals: 2, away_goals: 1 }), 3);
});

test('calculateHyperMatchPoints dona 3 punts per empat exacte', () => {
  assert.equal(calculateHyperMatchPoints({ pred_home: 0, pred_away: 0 }, { home_goals: 0, away_goals: 0 }), 3);
});

test('calculateHyperMatchPoints dona 1 punt per signe correcte (victòria local)', () => {
  assert.equal(calculateHyperMatchPoints({ pred_home: 1, pred_away: 0 }, { home_goals: 3, away_goals: 1 }), 1);
});

test('calculateHyperMatchPoints dona 1 punt per signe correcte (empat)', () => {
  assert.equal(calculateHyperMatchPoints({ pred_home: 0, pred_away: 0 }, { home_goals: 1, away_goals: 1 }), 1);
});

test('calculateHyperMatchPoints dona 1 punt per signe correcte (victòria visitant)', () => {
  assert.equal(calculateHyperMatchPoints({ pred_home: 0, pred_away: 2 }, { home_goals: 1, away_goals: 3 }), 1);
});

test('calculateHyperMatchPoints dona 0 punts per signe incorrecte', () => {
  assert.equal(calculateHyperMatchPoints({ pred_home: 2, pred_away: 0 }, { home_goals: 0, away_goals: 1 }), 0);
});

test('calculateHyperMatchPoints dona 0 si prediction és null', () => {
  assert.equal(calculateHyperMatchPoints(null, { home_goals: 1, away_goals: 0 }), 0);
});

test('calculateHyperMatchPoints dona 0 si result no té gols', () => {
  assert.equal(calculateHyperMatchPoints({ pred_home: 1, pred_away: 0 }, { home_goals: null, away_goals: null }), 0);
  assert.equal(calculateHyperMatchPoints({ pred_home: 1, pred_away: 0 }, null), 0);
});

test('calculateHyperMatchPoints accepta strings numèrics (compatibilitat BD)', () => {
  assert.equal(calculateHyperMatchPoints({ pred_home: '2', pred_away: '1' }, { home_goals: 2, away_goals: 1 }), 3);
  assert.equal(calculateHyperMatchPoints({ pred_home: '1', pred_away: '0' }, { home_goals: 2, away_goals: 1 }), 1);
});

// ── getHyperBadgeColor ─────────────────────────────────────────────────────

test('getHyperBadgeColor retorna pts-green per 3 punts', () => {
  assert.equal(getHyperBadgeColor(3), 'pts-green');
});

test('getHyperBadgeColor retorna pts-orange per 1 punt', () => {
  assert.equal(getHyperBadgeColor(1), 'pts-orange');
});

test('getHyperBadgeColor retorna pts-grey per 0 punts', () => {
  assert.equal(getHyperBadgeColor(0), 'pts-grey');
});

// ── calculateHyperUserTotal ────────────────────────────────────────────────

test('calculateHyperUserTotal suma correctament múltiples prediccions', () => {
  const predictions = [
    { match_key: 'M1', pred_home: 2, pred_away: 1 },
    { match_key: 'M2', pred_home: 0, pred_away: 0 },
    { match_key: 'M3', pred_home: 1, pred_away: 2 },
  ];
  const results = [
    { match_key: 'M1', home_goals: 2, away_goals: 1 },  // exact → 3
    { match_key: 'M2', home_goals: 1, away_goals: 1 },  // sign (empat) → 1
    { match_key: 'M3', home_goals: 0, away_goals: 1 },  // sign (visitant) → 1
  ];
  assert.equal(calculateHyperUserTotal(predictions, results), 5);
});

test('calculateHyperUserTotal retorna 0 si no hi ha resultats', () => {
  const predictions = [{ match_key: 'M1', pred_home: 1, pred_away: 0 }];
  assert.equal(calculateHyperUserTotal(predictions, []), 0);
});

test('calculateHyperUserTotal retorna 0 amb arrays buits', () => {
  assert.equal(calculateHyperUserTotal([], []), 0);
});

test('calculateHyperUserTotal ignora prediccions sense resultat corresponent', () => {
  const predictions = [
    { match_key: 'M1', pred_home: 2, pred_away: 0 },
    { match_key: 'M2', pred_home: 1, pred_away: 1 }, // cap resultat per M2
  ];
  const results = [
    { match_key: 'M1', home_goals: 2, away_goals: 0 }, // exact → 3
  ];
  assert.equal(calculateHyperUserTotal(predictions, results), 3);
});
