import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detailRows, groundLine, fieldClock } from '../js/format.js';

const HOUR = {
  time: '2026-11-01T15:00', hour: 15, climb: 1.234, hcritAgl: 1072, bs: 0.514, blTopAgl: 1252, cuBaseAgl: 1289, cuForms: false,
  odBaseAgl: 900, odForms: true, blShear: 1.04, blWind: { speed: 2.26, dir: 83.4 }, cloud: { total: 25, low: 10, mid: 15, high: 0 },
  rainMm: 2.14, rainHours: 3, cape: 680, wind10: { speed: 4.9, dir: 197 }, gust: 8.2, t2c: 22.7, td2c: 17.5, reason: null,
};
const row = (rows, label) => rows.find(r => r.label === label);

test('heights say they are above model ground', () => {
  assert.equal(row(detailRows(HOUR), 'Hcrit').value, '1072 m above model ground');
  assert.equal(row(detailRows(HOUR), 'BL top').value, '1252 m above model ground');
});

test("a cloud base above BL top is dimmed and says it won't form", () => {
  const cu = row(detailRows(HOUR), 'Cu base');
  assert.equal(cu.dim, true); assert.match(cu.value, /^1289 m .*above BL top: won't form$/);
  const od = row(detailRows(HOUR), 'OD base');
  assert.equal(od.dim, false); assert.doesNotMatch(od.value, /won't form/);
});

test('rain states the interval it covers', () =>
  assert.equal(row(detailRows(HOUR), 'Rain').value, '2.1 mm in the 3 h to 15:00'));

test('climb, B/S and winds are formatted with units', () => {
  const r = detailRows(HOUR);
  assert.equal(row(r, 'Climb').value, '1.2 m/s');
  assert.equal(row(r, 'B/S').value, '0.51');
  assert.equal(row(r, 'BL wind').value, '083° 2.3 m/s');
  assert.equal(row(r, 'Wind 10 m').value, '197° 4.9 m/s, gust 8.2 m/s');
});

test('missing values show a dash and the reason, never 0', () => {
  const r = detailRows({ ...HOUR, climb: null, hcritAgl: null, bs: null, blTopAgl: null, cuBaseAgl: null, cuForms: null,
    odBaseAgl: null, odForms: null, blShear: null, blWind: null, reason: 'no pressure level above model ground' });
  for (const label of ['Climb', 'Hcrit', 'B/S', 'BL top', 'Cu base', 'OD base', 'BL shear', 'BL wind'])
    assert.equal(row(r, label).value, '—', label);
  assert.equal(row(r, 'Why missing').value, 'no pressure level above model ground');
});

test('ground line names the model ground, or says the field elevation stands in', () => {
  assert.equal(groundLine('GFS', 688, false, 583), 'GFS ground 688 m · field 583 m');
  assert.equal(groundLine('ICON', 583, true, 583), 'ICON gave no ground height · field elevation 583 m used');
});

test('clock time is field-local whatever the viewer zone', () =>
  assert.equal(fieldClock(Date.UTC(2026, 9, 31, 13, 5)), '10:05'));
