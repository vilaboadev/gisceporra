import test from 'node:test';
import assert from 'node:assert/strict';

import { buildBetFormCard, formatSavedBetSummary } from '../src/pronostics.js';

const match = {
  id: 99,
  stage: 'ROUND_OF_32',
  utcDate: '2026-07-04T01:30:00Z',
  homeTeam: { name: 'Colombia' },
  awayTeam: { name: 'Ghana' },
};

test('buildBetFormCard mostra formulari pendent sense resum previ', () => {
  const html = buildBetFormCard(match);

  assert.ok(html.includes('Envia pronòstic'));
  assert.ok(!html.includes('Últim pronòstic enviat'));
  assert.ok(html.includes('data-has-bet="0"'));
});

test('buildBetFormCard mostra valors enviats i CTA d’edició', () => {
  const html = buildBetFormCard(match, {
    pred_home_goals: 2,
    pred_away_goals: 1,
    tie_winner: null,
  });

  assert.ok(html.includes('Edita pronòstic'));
  assert.ok(html.includes('btn-edit'));
  assert.ok(html.includes('Últim pronòstic enviat'));
  assert.ok(html.includes('value="2"'));
  assert.ok(html.includes('value="1"'));
  assert.ok(html.includes('2 – 1'));
  assert.ok(html.includes('data-has-bet="1"'));
});

test('buildBetFormCard mostra i preselecciona el desempat guardat', () => {
  const html = buildBetFormCard(match, {
    pred_home_goals: 1,
    pred_away_goals: 1,
    tie_winner: 'Ghana',
  });

  assert.ok(html.includes('tie-winner-group'));
  assert.ok(!html.includes('tie-winner-group hidden'));
  assert.ok(html.includes('<option value="Ghana" selected>Ghana</option>'));
  assert.ok(html.includes('Passa Ghana'));
});

test('formatSavedBetSummary afegeix el guanyador dels penals quan cal', () => {
  assert.equal(
    formatSavedBetSummary({ pred_home_goals: 3, pred_away_goals: 3, tie_winner: 'Colombia' }),
    '3 – 3 · Passa Colombia'
  );
});
