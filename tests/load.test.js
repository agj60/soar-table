import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadModel, loadReports, runLabel } from '../js/load.js';

const FIXTURE = readFileSync(new URL('./fixtures/sdip-gfs.json', import.meta.url), 'utf8');
const fixture = JSON.parse(FIXTURE);
// Run init at the fixture's first timestamp, so every GFS hour in it counts as computed.
const INIT_S = (Date.parse(fixture.hourly.time[0] + 'Z') - fixture.utc_offset_seconds * 1000) / 1000;

const DEFAULTS = {
  meta: { status: 200, body: JSON.stringify({ last_run_initialisation_time: INIT_S }) },
  forecast: { status: 200, body: FIXTURE },
  metar: { status: 200, body: 'SBSJ 311100Z 15001KT 2500 BR OVC004 18/17 Q1017= SBSJ 311200Z VRB02KT 6000 BKN007 19/16 Q1017= SBSJ 311300Z 21003KT 9999 FEW012 22/18 Q1017=' },
  taf: { status: 200, body: 'SBSJ 302100Z 3100/3112 VRB02KT 9999 FEW020= SBSJ 310900Z 3112/3124 14005KT 6000 BKN006 PROB30 TEMPO 3117/3120 TSRA FEW040CB=' },
};
const ROUTES = [['meta.json', 'meta'], ['/v1/forecast', 'forecast'], ['metar.txt', 'metar'], ['taf.txt', 'taf']];

// Routes by URL to canned responses shaped like fetch's Response.
function fakeFetch(overrides = {}) {
  return async url => {
    const [, key] = ROUTES.find(([part]) => url.includes(part));
    const { status, body = '' } = { ...DEFAULTS[key], ...overrides[key] };
    return { ok: status >= 200 && status < 300, status, text: async () => body, json: async () => JSON.parse(body) };
  };
}

test('a good load yields days, run time and model ground', async () => {
  const r = await loadModel('gfs', fakeFetch());
  assert.equal(r.ok, true);
  assert.equal(r.runInitMs, INIT_S * 1000);
  assert.equal(r.gridElevation, fixture.elevation);
  assert.ok(r.days.length >= 1 && r.days[0].hours.length >= 1);
});

test('rate-limited forecast is an error with the status, not empty data', async () => {
  const r = await loadModel('gfs', fakeFetch({ forecast: { status: 429 } }));
  assert.equal(r.ok, false); assert.match(r.message, /429/);
});

test('offline is an error, not a throw', async () =>
  assert.equal((await loadModel('gfs', () => Promise.reject(new TypeError('Failed to fetch')))).ok, false));

test('meta failure fails the model', async () =>
  assert.equal((await loadModel('gfs', fakeFetch({ meta: { status: 500 } }))).ok, false));

test('malformed forecast JSON is an error', async () =>
  assert.equal((await loadModel('gfs', fakeFetch({ forecast: { status: 200, body: '<html>' } }))).ok, false));

test('reports give the newest two METARs and the newest TAF', async () => {
  const r = await loadReports(fakeFetch());
  assert.deepEqual(r.metar, ['SBSJ 311200Z VRB02KT 6000 BKN007 19/16 Q1017', 'SBSJ 311300Z 21003KT 9999 FEW012 22/18 Q1017']);
  assert.match(r.taf, /^SBSJ 310900Z/); assert.deepEqual(r.errors, []);
});

test('TAF failing still returns the METAR', async () => {
  const r = await loadReports(fakeFetch({ taf: { status: 503 } }));
  assert.equal(r.taf, null); assert.equal(r.metar.length, 2); assert.equal(r.errors.length, 1);
});

test('reports never throw when offline', async () => {
  const r = await loadReports(() => Promise.reject(new TypeError('Failed to fetch')));
  assert.equal(r.metar, null); assert.equal(r.taf, null); assert.equal(r.errors.length, 2);
});

test('run label', () => assert.equal(runLabel(Date.UTC(2026, 9, 31, 6)), '06Z'));
