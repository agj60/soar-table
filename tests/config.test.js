import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isComputedStep, MODEL_ORDER, DEFAULT_MODEL } from '../js/config.js';

test('GFS is hourly to +120 h, then 3-hourly', () => {
  for (const h of [0, 1, 119, 120]) assert.equal(isComputedStep('gfs', h), true);
  for (const h of [121, 122, 124]) assert.equal(isComputedStep('gfs', h), false);
  assert.equal(isComputedStep('gfs', 123), true);
});

test('ECMWF is 3-hourly to +144 h, then 6-hourly', () => {
  assert.deepEqual([3, 4, 144, 147, 150].map(h => isComputedStep('ecmwf', h)), [true, false, true, false, true]);
});

test('ICON is hourly to +78 h, then 3-hourly', () => {
  assert.deepEqual([77, 78, 79, 81].map(h => isComputedStep('icon', h)), [true, true, false, true]);
});

test('non-integer or negative leads are never computed steps', () => {
  assert.equal(isComputedStep('gfs', 1.5), false);
  assert.equal(isComputedStep('gfs', -1), false);
});

test('model order and default', () => {
  assert.deepEqual(MODEL_ORDER, ['gfs', 'ecmwf', 'icon']);
  assert.equal(DEFAULT_MODEL, 'gfs');
});
