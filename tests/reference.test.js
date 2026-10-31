// js/sounding.js against SoarCalc's own output (tests/fixtures/soarcalc-reference.json, produced by
// tools/soarcalc-reference.mjs) on identical inputs from the captured Open-Meteo fixture.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseForecast } from '../js/openmeteo.js';
import { computeSoaring } from '../js/sounding.js';
import { toSoarcalcEquivalent } from './helpers/soarcalc-equivalent.js';

const read = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8'));
const fixture = read('sdip-gfs.json');
const reference = read('soarcalc-reference.json');
const firstMs = Date.parse(fixture.hourly.time[0] + 'Z') - fixture.utc_offset_seconds * 1000;
const steps = parseForecast(fixture, 'gfs', firstMs).steps;

const close = (actual, expected, tol, what) =>
  assert.ok(Math.abs(actual - expected) <= tol, `${what}: SoarCalc ${expected}, ours ${actual} (± ${tol})`);

test('reference covers the whole window on both fixture days', () => assert.equal(reference.length, 20));

for (const row of reference) {
  test(`matches SoarCalc at ${row.time}`, () => {
    const step = steps.find(s => s.time === row.time);
    const r = computeSoaring(toSoarcalcEquivalent(step.sounding));
    assert.equal(r.ok, true);
    close(r.climb, row.climb, 0.05, 'climb');
    close(r.wstar, row.wstar, 0.05, 'W*');
    for (const k of ['blTop', 'cuBase', 'odBase', 'hcrit']) close(r[k], row[k], 5, k);
    if (row.bs === null) assert.equal(r.bs, null, 'B/S');
    else close(r.bs, row.bs, 0.02, 'B/S');
    assert.equal(r.cuForms, row.cuForms, 'Cu forms');
    assert.equal(r.odForms, row.odForms, 'OD forms');
  });
}
