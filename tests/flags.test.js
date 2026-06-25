import test from 'node:test';
import assert from 'node:assert/strict';
import { getFlag, teamWithFlag, formatPlaceholder } from '../src/flags.js';

// ---------------------------------------------------------------------------
// getFlag
// ---------------------------------------------------------------------------

test('getFlag retorna bandera per a Espanya', () => {
  assert.equal(getFlag('Spain'), '🇪🇸');
  assert.equal(getFlag('Espanya'), '🇪🇸');
});

test('getFlag retorna buit per equip desconegut', () => {
  assert.equal(getFlag('ImaginaryLand'), '');
});

test('getFlag retorna buit per null/undefined', () => {
  assert.equal(getFlag(null), '');
  assert.equal(getFlag(undefined), '');
});

// ---------------------------------------------------------------------------
// Banderes de subdivisions UK — han de ser emoji compatibles universals
// ---------------------------------------------------------------------------

test('getFlag retorna bandera correcta per Anglaterra (Union Jack)', () => {
  const flag = getFlag('England');
  assert.equal(flag, '🇬🇧');
});

test('getFlag retorna bandera correcta per Escòcia (Union Jack)', () => {
  const flag = getFlag('Scotland');
  assert.equal(flag, '🇬🇧');
});

test('getFlag retorna bandera correcta per Gal·les (Union Jack)', () => {
  const flag = getFlag('Wales');
  assert.equal(flag, '🇬🇧');
});

// ---------------------------------------------------------------------------
// formatPlaceholder
// ---------------------------------------------------------------------------

test('formatPlaceholder retorna buit per null/undefined', () => {
  assert.equal(formatPlaceholder(null), '');
  assert.equal(formatPlaceholder(undefined), '');
});

test('formatPlaceholder converteix Group A Winner', () => {
  assert.equal(formatPlaceholder('Group A Winner'), '🏆 Grup A · 1r');
});

test('formatPlaceholder converteix Group B 2nd Place', () => {
  assert.equal(formatPlaceholder('Group B 2nd Place'), '🥈 Grup B · 2n');
});

test('formatPlaceholder converteix Quarterfinal 1 Winner', () => {
  assert.equal(formatPlaceholder('Quarterfinal 1 Winner'), 'Quarts #1');
});

test('formatPlaceholder retorna el mateix nom per noms normals', () => {
  assert.equal(formatPlaceholder('Spain'), 'Spain');
  assert.equal(formatPlaceholder('Brazil'), 'Brazil');
});

// ---------------------------------------------------------------------------
// teamWithFlag
// ---------------------------------------------------------------------------

test('teamWithFlag retorna nom amb bandera per equip conegut', () => {
  const result = teamWithFlag('Spain');
  assert.ok(result.includes('🇪🇸'));
  assert.ok(result.includes('Spain'));
});

test('teamWithFlag retorna text llegible per placeholder', () => {
  const result = teamWithFlag('Group A Winner');
  assert.ok(result.includes('🏆 Grup A'));
  assert.ok(!result.includes('Group A Winner'));
});

test('teamWithFlag retorna ? per null/undefined', () => {
  assert.equal(teamWithFlag(null), '?');
  assert.equal(teamWithFlag(undefined), '?');
});

// ---------------------------------------------------------------------------
// FLAG_MAP consistency: totes les entrades tenen emoji vàlid
// ---------------------------------------------------------------------------

test('FLAG_MAP contiene valors consistentes para todas las claves UK', () => {
  const flagEngland = getFlag('England');
  const flagScotland = getFlag('Scotland');
  const flagWales = getFlag('Wales');
  assert.ok(flagEngland.length > 0);
  assert.ok(flagScotland.length > 0);
  assert.ok(flagWales.length > 0);
});
