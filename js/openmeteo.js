// Open-Meteo forecast request and parsing. Keeps only the hours the model itself computed.

import { FIELD, MODELS, isComputedStep } from './config.js';

const API = 'https://api.open-meteo.com';
const SURFACE = ['temperature_2m', 'dew_point_2m', 'relative_humidity_2m', 'surface_pressure', 'wind_speed_10m',
  'wind_direction_10m', 'wind_gusts_10m', 'precipitation', 'cape', 'cloud_cover', 'cloud_cover_low', 'cloud_cover_mid',
  'cloud_cover_high'];
const PER_LEVEL = ['temperature', 'relative_humidity', 'dew_point', 'geopotential_height', 'wind_speed', 'wind_direction'];
const HOUR_MS = 3600000;
const K = c => c + 273.15;

export function forecastUrl(modelKey, { forecastDays } = {}) {
  const m = MODELS[modelKey];
  const hourly = [...SURFACE, ...m.levels.flatMap(l => PER_LEVEL.map(v => `${v}_${l}hPa`))];
  const q = new URLSearchParams({
    latitude: FIELD.lat, longitude: FIELD.lon,
    // nan: no downscaling, so the 2 m values sit on the model's own ground like the pressure levels do.
    elevation: 'nan',
    timezone: FIELD.tz,
    wind_speed_unit: 'ms',
    temporal_resolution: 'native',
    forecast_days: forecastDays ?? m.forecastDays,
    models: m.openMeteo,
    hourly: hourly.join(','),
  });
  return `${API}/v1/forecast?${q}`;
}

export function metaUrl(modelKey) {
  return `${API}/data/${MODELS[modelKey].meta}/static/meta.json`;
}

export function parseRunInit(metaJson) {
  return metaJson.last_run_initialisation_time * 1000;
}

// Wind towards which the air moves, from speed and the direction it comes from.
function components(speed, dirDeg) {
  const r = dirDeg * Math.PI / 180;
  return { vx: -speed * Math.sin(r), vy: -speed * Math.cos(r) };
}

export function parseForecast(json, modelKey, runInitMs) {
  const h = json.hourly;
  const fallback = json.elevation == null || Number.isNaN(json.elevation);
  const gridElevation = fallback ? FIELD.elevationM : json.elevation;
  const offsetMs = json.utc_offset_seconds * 1000;
  const at = (key, i) => (h[key] ? h[key][i] : null);
  const tsOf = i => Date.parse(h.time[i] + 'Z') - offsetMs;
  const nativeHours = h.time.length > 1 ? (tsOf(1) - tsOf(0)) / HOUR_MS : 1;

  const steps = [];
  let lastKept = -1;
  for (let i = 0; i < h.time.length; i++) {
    const tsMs = tsOf(i);
    const leadHours = (tsMs - runInitMs) / HOUR_MS;
    if (!isComputedStep(modelKey, leadHours)) continue;

    // Rain since the previous computed step; Open-Meteo's native values each cover their own interval.
    const from = lastKept < 0 ? i : lastKept + 1;
    let rainMm = 0;
    for (let j = from; j <= i; j++) rainMm += Math.max(0, at('precipitation', j) ?? 0);
    const rainHours = lastKept < 0 ? nativeHours : (tsMs - tsOf(lastKept)) / HOUR_MS;
    lastKept = i;

    const wind10 = { speed: at('wind_speed_10m', i), dir: at('wind_direction_10m', i) };
    const surface = {
      z: gridElevation,
      p: at('surface_pressure', i) * 100,
      t: K(at('temperature_2m', i)),
      rh: at('relative_humidity_2m', i) / 100,
      td: K(at('dew_point_2m', i)),
      ...components(wind10.speed, wind10.dir),
    };
    const levels = [];
    for (const l of MODELS[modelKey].levels) {
      const v = Object.fromEntries(PER_LEVEL.map(name => [name, at(`${name}_${l}hPa`, i)]));
      if (PER_LEVEL.some(name => v[name] == null)) continue;
      levels.push({
        z: v.geopotential_height, p: l * 100, t: K(v.temperature), rh: v.relative_humidity / 100, td: K(v.dew_point),
        ...components(v.wind_speed, v.wind_direction),
      });
    }
    const totalCloud = at('cloud_cover', i);

    steps.push({
      time: h.time[i],
      date: h.time[i].slice(0, 10),
      hour: Number(h.time[i].slice(11, 13)),
      tsMs, leadHours, rainMm, rainHours,
      cape: at('cape', i),
      cloud: { total: totalCloud, low: at('cloud_cover_low', i), mid: at('cloud_cover_mid', i), high: at('cloud_cover_high', i) },
      wind10,
      gust: at('wind_gusts_10m', i),
      t2c: at('temperature_2m', i),
      td2c: at('dew_point_2m', i),
      sounding: {
        tsMs, lat: FIELD.lat, lon: FIELD.lon, surface, levels,
        cloud: totalCloud == null ? null : totalCloud / 100,
      },
    });
  }
  return { gridElevation, gridElevationFallback: fallback, steps };
}
