import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import SunCalc from 'suncalc';
import { sunAltitude } from '../js/sun.js';

test('sun altitude matches suncalc exactly through a year', () => {
  const start = Date.UTC(2026, 0, 1);
  for (const [lat, lon] of [[-23.042711, -45.775133], [51.5, -0.1], [0, 0], [-60, 170]]) {
    for (let t = start; t < start + 365 * 86400000; t += 37 * 60000 * 13) {
      const theirs = SunCalc.getPosition(new Date(t), lat, lon).altitude;
      assert.ok(Math.abs(sunAltitude(t, lat, lon) - theirs) < 1e-12, `${new Date(t).toISOString()} ${lat},${lon}`);
    }
  }
});

test('the page needs no CDN for the sun position', () =>
  assert.doesNotMatch(readFileSync(new URL('../js/sun.js', import.meta.url), 'utf8'), /from ['"]suncalc['"]/));
