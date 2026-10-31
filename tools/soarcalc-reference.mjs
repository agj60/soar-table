// Runs SoarCalc's own Sounding class on a captured Open-Meteo fixture and prints its results as JSON, as the reference
// for tests/reference.test.js. SoarCalc has no licence, so its source is only ever read from a local checkout in
// tools/.cache/ (gitignored) and never copied into this repo.
//
// Usage: node tools/soarcalc-reference.mjs <path/to/SoarCalc.ts> <fixture.json> > tests/fixtures/soarcalc-reference.json

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { FIELD, WINDOW } from '../js/config.js';
import { parseForecast } from '../js/openmeteo.js';
import { toSoarcalcEquivalent, SOARCALC_LEVELS } from '../tests/helpers/soarcalc-equivalent.js';

const [tsPath, fixturePath] = process.argv.slice(2);
if (!tsPath || !fixturePath) {
  console.error('usage: node tools/soarcalc-reference.mjs <SoarCalc.ts> <fixture.json>');
  process.exit(2);
}

// Node strips the TypeScript types; the type-only Windy devtools import has nothing to resolve to, so drop it.
const cache = join(dirname(fileURLToPath(import.meta.url)), '.cache');
mkdirSync(cache, { recursive: true });
const runnable = join(cache, 'SoarCalc.ts');
writeFileSync(runnable, readFileSync(tsPath, 'utf8').split('\n').filter(l => !l.includes('@windycom/plugin-devtools')).join('\n'));
const { Sounding } = await import(pathToFileURL(runnable).href);

const json = JSON.parse(readFileSync(fixturePath, 'utf8'));
const firstMs = Date.parse(json.hourly.time[0] + 'Z') - json.utc_offset_seconds * 1000;
const steps = parseForecast(json, 'gfs', firstMs).steps.map(s => ({ ...s, sounding: toSoarcalcEquivalent(s.sounding) }));

// The same soundings in Windy's meteogram layout, which is what SoarCalc reads.
const md = { hours: steps.map(s => s.tsMs) };
const push = (key, value) => (md[key] ||= []).push(value);
for (const { sounding: { surface, levels } } of steps) {
  push('temp-surface', surface.t); push('rh-surface', surface.rh * 100); push('dewpoint-surface', surface.td);
  push('wind_u-surface', surface.vx); push('wind_v-surface', surface.vy);
  for (const P of SOARCALC_LEVELS) {
    const l = levels.find(x => x.p === P * 100);
    push(`gh-${P}h`, l ? l.z : null); push(`temp-${P}h`, l ? l.t : null); push(`rh-${P}h`, l ? l.rh * 100 : null);
    push(`dewpoint-${P}h`, l ? l.td : null); push(`wind_u-${P}h`, l ? l.vx : null); push(`wind_v-${P}h`, l ? l.vy : null);
  }
}
const meteogram = (surfaceZ) => ({
  status: 200,
  data: { header: { refTime: new Date(firstMs).toISOString(), elevation: FIELD.elevationM, modelElevation: surfaceZ }, data: md },
});

const rows = [];
const log = console.log;
for (const s of steps) {
  if (s.hour < WINDOW.from || s.hour > WINDOW.to) continue;
  console.log = () => {};                                  // SoarCalc logs every step
  const r = new Sounding(meteogram(s.sounding.surface.z), 'gfs', { lat: FIELD.lat, lon: FIELD.lon }, s.tsMs, 'clouds', null, s.sounding.cloud);
  console.log = log;
  rows.push({
    time: s.time, message: r.message,
    blTop: r.blTop?.gh ?? null, cuBase: r.cuBase?.gh ?? null, odBase: r.odBase?.gh ?? null,
    wstar: r.Wstar, climb: r.Climb, hcrit: r.Hcrit, bs: r.Ri, blShear: r.blShear,
    cuForms: r.cuPossible, odForms: r.odPossible,
  });
}
process.stdout.write(JSON.stringify(rows, null, 1) + '\n');
