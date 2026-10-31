import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toAgl, buildDays, defaultDayIndex } from '../js/days.js';

const GROUND = 688;
const LEVELS = [
  { z: 1000, p: 90000, t: 296, rh: 0.4, td: 280, vx: 2, vy: 0 },
  { z: 2000, p: 80000, t: 291, rh: 0.4, td: 275, vx: 6, vy: 0 },
];

// A computed step at a field-local date and hour; `levels: []` makes the calculation fail.
function step({ date = '2026-11-01', hour = 12, levels = LEVELS, wind } = {}) {
  const [y, m, d] = date.split('-').map(Number);
  const tsMs = Date.UTC(y, m - 1, d, hour + 3);
  const lv = wind ? levels.map(l => ({ ...l, ...wind })) : levels;
  const surface = { z: GROUND, p: 93000, t: 300, rh: 0.4, td: 296.8, vx: 0, vy: 0, ...(wind || {}) };
  return {
    time: `${date}T${String(hour).padStart(2, '0')}:00`, date, hour, tsMs, leadHours: 24, rainMm: 0.2, rainHours: 1,
    cape: 300, cloud: { total: 20, low: 10, mid: 5, high: 5 }, wind10: { speed: 3, dir: 180 }, gust: 7, t2c: 26.85, td2c: 23.65,
    sounding: { tsMs, lat: -23.042711, lon: -45.775133, surface, levels: lv, cloud: 0.2 },
  };
}
const STEPS_NOV1 = [9, 12, 15, 18].map(hour => step({ hour }));

test('AGL conversion floors at the model ground', () => {
  assert.equal(toAgl(1316, 632), 684); assert.equal(toAgl(600, 632), 0); assert.equal(toAgl(null, 632), null);
});

test('only window hours, grouped by field-local date, empty days omitted', () => {
  const days = buildDays([8, 9, 18, 19].map(hour => step({ hour })).concat(step({ date: '2026-11-02', hour: 20 })), GROUND);
  assert.deepEqual(days.map(d => [d.date, d.hours.map(h => h.hour)]), [['2026-11-01', [9, 18]]]);
});

test('failed calculation shows missing values with a reason, never 0', () => {
  const [h] = buildDays([step({ levels: [] })], GROUND)[0].hours;
  for (const k of ['climb', 'hcritAgl', 'bs', 'blTopAgl', 'cuBaseAgl', 'cuForms', 'odBaseAgl', 'odForms', 'blShear', 'blWind'])
    assert.equal(h[k], null, k);
  assert.equal(h.reason, 'no pressure level above model ground');
  assert.equal(h.rainMm, 0.2); assert.equal(h.cape, 300);               // non-thermal values still shown
});

test('a computed hour carries heights above model ground', () => {
  const [h] = buildDays([step()], GROUND)[0].hours;
  assert.equal(h.reason, null);
  assert.equal(h.cuBaseAgl, 400);                                        // 125·(300 − 296.8)
  assert.ok(h.blTopAgl > 0 && h.hcritAgl >= 0 && h.climb >= 0);
});

test('day maxima ignore missing values', () => {
  const [day] = buildDays([step({ hour: 10, levels: [] }), step({ hour: 11 }), step({ hour: 13 })], GROUND);
  const climbs = day.hours.map(h => h.climb).filter(c => c !== null);
  assert.equal(day.maxClimb, Math.max(...climbs));
  assert.equal(day.maxHcritAgl, Math.max(...day.hours.map(h => h.hcritAgl).filter(c => c !== null)));
  const [empty] = buildDays([step({ hour: 10, levels: [] })], GROUND);
  assert.equal(empty.maxClimb, null); assert.equal(empty.maxHcritAgl, null);
});

test('BL wind is reported as speed and the direction it comes from', () => {
  const [h] = buildDays([step({ wind: { vx: -10, vy: 0 } })], GROUND)[0].hours;   // from the east everywhere
  assert.ok(Math.abs(h.blWind.speed - 10) < 1e-9); assert.ok(Math.abs(h.blWind.dir - 90) < 1e-9);
});

test('label is weekday and day of month', () => assert.equal(buildDays(STEPS_NOV1, GROUND)[0].label, 'Sun 1'));

test('default day is today at the field, else the next day', () => {
  const days = [{ date: '2026-11-01' }, { date: '2026-11-02' }];
  assert.equal(defaultDayIndex(days, Date.UTC(2026, 10, 1, 23)), 0);   // 20:00 on 1 Nov at SDIP
  assert.equal(defaultDayIndex(days, Date.UTC(2026, 10, 2, 2)), 0);    // 23:00 on 1 Nov at SDIP
  assert.equal(defaultDayIndex(days, Date.UTC(2026, 10, 2, 12)), 1);   // 09:00 on 2 Nov
  assert.equal(defaultDayIndex([{ date: '2026-10-31' }, { date: '2026-11-02' }], Date.UTC(2026, 10, 1, 15)), 1);  // today missing
});

test('results do not depend on the viewer time zone', (t) => {
  const saved = process.env.TZ; t.after(() => { process.env.TZ = saved; });
  const before = JSON.stringify(buildDays(STEPS_NOV1, GROUND));
  process.env.TZ = 'Europe/Lisbon';
  assert.equal(JSON.stringify(buildDays(STEPS_NOV1, GROUND)), before);
  assert.equal(defaultDayIndex([{ date: '2026-11-01' }, { date: '2026-11-02' }], Date.UTC(2026, 10, 2, 2)), 0);
});
