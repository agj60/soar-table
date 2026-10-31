import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FIELD } from '../js/config.js';
import { insolation } from '../js/sun.js';
import { saturationVapourPressure, mixingRatio, virtualTemp, zcrit, wstar, computeSoaring } from '../js/sounding.js';

const close = (actual, expected, tol) =>
  assert.ok(Math.abs(actual - expected) <= tol, `expected ${expected} ± ${tol}, got ${actual}`);

const LAT = FIELD.lat, LON = FIELD.lon;
const NOON = Date.UTC(2026, 10, 1, 15);                 // 12:00 at SDIP
const S = { z: 700, p: 93000, t: 300, rh: 0.4, td: 296.8, vx: 0, vy: 0 };
const A = { z: 1000, p: 90000, t: 296, rh: 0.4, td: 280, vx: 2, vy: 0 };
const B = { z: 2000, p: 80000, t: 291, rh: 0.4, td: 275, vx: 6, vy: 0 };
const at = (surface, levels, cloud = 0) => ({ tsMs: NOON, lat: LAT, lon: LON, surface, levels, cloud });

test('Tetens saturation vapour pressure', () => close(saturationVapourPressure(293.16), 2338.2, 0.1));
test('mixing ratio', () => close(mixingRatio(0.5, 293.16, 95000), 0.00774, 1e-5));
test('virtual temperature', () => close(virtualTemp(293.16, mixingRatio(0.5, 293.16, 95000)), 294.544, 0.001));
test('zcrit solves the RASP updraft profile', () => {
  close(zcrit(0.9, 2.0), 0.6996, 0.001);
  assert.equal(zcrit(0.9, 0.8), 0);
});
test('W*', () => close(wstar(600, 1000, 0.012), 2.3552, 0.001));

test('insolation near noon at SDIP on 1 Nov', () => {
  const q = insolation(NOON, LAT, LON);
  assert.ok(q > 975 && q < 995, q);
});
test('insolation is 0 at night', () => assert.equal(insolation(Date.UTC(2026, 10, 1, 6), LAT, LON), 0));

test('BL top at the ground when the first level is warmer than the parcel', () => {
  const r = computeSoaring(at(S, [{ ...A, t: 298 }, B]));
  assert.equal(r.blTop, 700); assert.equal(r.blDepth, 0); assert.equal(r.climb, 0); assert.equal(r.hcrit, 700);
});
test('BL top between levels for a rising parcel', () => {
  const r = computeSoaring(at(S, [B, A]));                // unsorted on purpose
  close(r.blTop, 1317.6, 0.5); close(r.blDepth, 617.6, 0.5);
  close(r.climb, Math.max(0, r.wstar - 0.9), 1e-9);
  close(r.hcrit, 700 + zcrit(0.9, r.wstar) * r.blDepth, 1e-6);
});
test('full cloud gives no climb', () => {
  const r = computeSoaring(at(S, [A, B], 1));
  assert.equal(r.qs, 0); assert.equal(r.climb, 0); assert.equal(r.bs, 0);
});
test('B/S is null when there is no shear', () => {
  const still = l => ({ ...l, vx: 0, vy: 0 });
  assert.equal(computeSoaring(at(S, [still(A), still(B)])).bs, null);
});
test('Cu forms only below BL top', () => {
  const r = computeSoaring(at(S, [A, B]));
  close(r.cuBase, 1100, 0.01); assert.equal(r.cuForms, true);
  assert.equal(computeSoaring(at({ ...S, td: 293.6 }, [A, B])).cuForms, false);
  assert.equal(r.odForms, r.odBase < r.blTop);
});
test('no level above ground is reported, not zero', () => {
  assert.deepEqual(computeSoaring(at(S, [{ ...A, z: 650 }])), { ok: false, reason: 'no pressure level above model ground' });
});
