// Fetching for the page. Every failure comes back as a message to show, never as empty data or a throw.

import { forecastUrl, metaUrl, parseRunInit, parseForecast } from './openmeteo.js';
import { buildDays } from './days.js';
import { METAR_URL, TAF_URL, parseReports } from './reports.js';

async function get(fetchFn, url, read) {
  const res = await fetchFn(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return read(res);
}

const reason = e => (e && e.message) || String(e);

export async function loadModel(modelKey, fetchFn = fetch) {
  try {
    const [meta, json] = await Promise.all([
      get(fetchFn, metaUrl(modelKey), r => r.json()),
      get(fetchFn, forecastUrl(modelKey), r => r.json()),
    ]);
    // Without the run time there is no telling computed hours from blended ones, so a failed meta fails the model.
    const runInitMs = parseRunInit(meta);
    if (!Number.isFinite(runInitMs)) throw new Error('model run time missing');
    const { gridElevation, gridElevationFallback, steps } = parseForecast(json, modelKey, runInitMs);
    return { ok: true, runInitMs, gridElevation, gridElevationFallback, days: buildDays(steps, gridElevation) };
  } catch (e) {
    return { ok: false, message: `Open-Meteo: ${reason(e)}` };
  }
}

export async function loadReports(fetchFn = fetch) {
  const [metar, taf] = await Promise.allSettled([
    get(fetchFn, METAR_URL, r => r.text()),
    get(fetchFn, TAF_URL, r => r.text()),
  ]);
  const errors = [];
  if (metar.status === 'rejected') errors.push(`METAR: ${reason(metar.reason)}`);
  if (taf.status === 'rejected') errors.push(`TAF: ${reason(taf.reason)}`);
  return {
    metar: metar.status === 'fulfilled' ? parseReports(metar.value).slice(-2) : null,
    taf: taf.status === 'fulfilled' ? parseReports(taf.value).at(-1) ?? null : null,
    errors,
  };
}

/** "06Z" style label for a model run's initialisation time. */
export function runLabel(runInitMs) {
  return `${String(new Date(runInitMs).getUTCHours()).padStart(2, '0')}Z`;
}
