import { test } from 'node:test';
import assert from 'node:assert/strict';
import { forecastUrl, metaUrl, parseRunInit, parseForecast } from '../js/openmeteo.js';

const close = (actual, expected, tol) =>
  assert.ok(Math.abs(actual - expected) <= tol, `expected ${expected} ± ${tol}, got ${actual}`);

const INIT = Date.UTC(2026, 10, 1, 12);   // makes 09:00 local on 6 Nov lead +120 h
const five = v => [v, v, v, v, v];

// A minimal Open-Meteo response: GFS, two pressure levels, 09:00–13:00 local on 6 Nov.
function resp(hourly = {}) {
  return {
    utc_offset_seconds: -10800,
    elevation: 688,
    hourly: {
      time: ['2026-11-06T09:00', '2026-11-06T10:00', '2026-11-06T11:00', '2026-11-06T12:00', '2026-11-06T13:00'],
      precipitation: [0.3, 0.4, 0.5, 0.6, 0.7],
      cape: five(400), cloud_cover: five(40), cloud_cover_low: five(20), cloud_cover_mid: five(15), cloud_cover_high: five(5),
      temperature_2m: five(26), dew_point_2m: five(16), relative_humidity_2m: five(54), surface_pressure: five(930),
      wind_speed_10m: five(3), wind_direction_10m: five(180), wind_gusts_10m: five(6),
      temperature_925hPa: five(20), relative_humidity_925hPa: five(55), dew_point_925hPa: five(10),
      geopotential_height_925hPa: five(780), wind_speed_925hPa: five(10), wind_direction_925hPa: five(90),
      temperature_850hPa: five(16), relative_humidity_850hPa: five(50), dew_point_850hPa: five(5),
      geopotential_height_850hPa: five(1500), wind_speed_850hPa: five(8), wind_direction_850hPa: five(270),
      ...hourly,
    },
  };
}
const RESP = resp();

test('URL carries the decided parameters', () => {
  const u = new URL(forecastUrl('gfs'));
  for (const [k, v] of [['elevation', 'nan'], ['temporal_resolution', 'native'], ['timezone', 'America/Sao_Paulo'],
    ['wind_speed_unit', 'ms'], ['models', 'gfs_seamless'], ['forecast_days', '16']]) assert.equal(u.searchParams.get(k), v);
  assert.match(u.searchParams.get('hourly'), /temperature_975hPa/);
  assert.doesNotMatch(new URL(forecastUrl('ecmwf')).searchParams.get('hourly'), /975hPa/);
  assert.equal(new URL(forecastUrl('gfs', { forecastDays: 2 })).searchParams.get('forecast_days'), '2');
});

test('meta URL names the model run feed', () =>
  assert.equal(metaUrl('icon'), 'https://api.open-meteo.com/data/dwd_icon/static/meta.json'));

test('local time string maps to the right instant regardless of viewer zone', () =>
  assert.equal(parseForecast(RESP, 'gfs', INIT).steps[0].tsMs, Date.UTC(2026, 10, 6, 12)));

test('off-schedule hours are dropped and their rain is carried forward', () => {
  const s = parseForecast(RESP, 'gfs', INIT).steps;
  assert.deepEqual(s.map(x => x.hour), [9, 12]);               // leads 120 and 123
  close(s[1].rainMm, 0.4 + 0.5 + 0.6, 1e-9); assert.equal(s[1].rainHours, 3);
  close(s[0].rainMm, 0.3, 1e-9); assert.equal(s[0].rainHours, 1);
});

test('negative rain is clamped before summing', () => {
  const s = parseForecast(resp({ precipitation: [-0.1, -0.2, 0.5, 0.6, 0] }), 'gfs', INIT).steps;
  assert.equal(s[0].rainMm, 0);
  close(s[1].rainMm, 1.1, 1e-9);
});

test('a null level value drops only that level at that step', () => {
  const s = parseForecast(resp({ temperature_925hPa: [20, 20, 20, null, 20] }), 'gfs', INIT).steps;
  assert.equal(s[0].sounding.levels.length, 2);
  assert.deepEqual(s[1].sounding.levels.map(l => l.p), [85000]);
});

test('a level absent from the response is skipped, not a crash', () => {
  const r = resp();
  for (const k of Object.keys(r.hourly)) if (k.endsWith('_850hPa')) delete r.hourly[k];
  for (const s of parseForecast(r, 'gfs', INIT).steps) assert.deepEqual(s.sounding.levels.map(l => l.p), [92500]);
});

test('units and wind components', () => {
  const { sounding } = parseForecast(RESP, 'gfs', INIT).steps[0];
  const lv = sounding.levels.find(l => l.p === 92500);
  close(lv.t, 20 + 273.15, 1e-9); close(lv.rh, 0.55, 1e-9); close(lv.td, 10 + 273.15, 1e-9); assert.equal(lv.z, 780);
  close(lv.vx, -10, 1e-9); close(lv.vy, 0, 1e-9);              // 10 m/s from the east blows towards the west
  assert.equal(sounding.surface.z, 688); assert.equal(sounding.surface.p, 93000);
  close(sounding.cloud, 0.4, 1e-9);
});

test('step carries the display values', () => {
  const s = parseForecast(RESP, 'gfs', INIT).steps[0];
  assert.deepEqual(
    { time: s.time, date: s.date, hour: s.hour, lead: s.leadHours, cape: s.cape, cloud: s.cloud, wind10: s.wind10, gust: s.gust, t: s.t2c, td: s.td2c },
    { time: '2026-11-06T09:00', date: '2026-11-06', hour: 9, lead: 120, cape: 400, cloud: { total: 40, low: 20, mid: 15, high: 5 },
      wind10: { speed: 3, dir: 180 }, gust: 6, t: 26, td: 16 });
});

test('missing grid elevation falls back to the field', () => {
  const r = parseForecast({ ...RESP, elevation: null }, 'gfs', INIT);
  assert.equal(r.gridElevation, 583); assert.equal(r.gridElevationFallback, true);
  assert.equal(r.steps[0].sounding.surface.z, 583);
  assert.equal(parseForecast(RESP, 'gfs', INIT).gridElevationFallback, false);
});

test('run init from meta.json', () => assert.equal(parseRunInit({ last_run_initialisation_time: 1793426400 }), 1793426400000));
