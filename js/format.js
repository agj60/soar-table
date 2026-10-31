// Text for the hour detail panel and the header. Missing values read "—", never 0.

import { FIELD } from './config.js';

const DASH = '—';
const n1 = v => v.toFixed(1);
const has = v => v !== null && v !== undefined;
const agl = v => (has(v) ? `${v} m above model ground` : DASH);
const deg = d => String(Math.round(d) % 360).padStart(3, '0') + '°';

function cloudBase(value, forms) {
  if (!has(value)) return { value: DASH, dim: false };
  return forms ? { value: agl(value), dim: false } : { value: `${agl(value)} · above BL top: won't form`, dim: true };
}

/** Label/value rows for one hour; `dim` marks a cloud base that won't form. */
export function detailRows(h) {
  const rows = [
    { label: 'Climb', value: has(h.climb) ? `${n1(h.climb)} m/s` : DASH },
    { label: 'Hcrit', value: agl(h.hcritAgl) },
    { label: 'B/S', value: has(h.bs) ? h.bs.toFixed(2) : DASH },
    { label: 'BL top', value: agl(h.blTopAgl) },
    { label: 'Cu base', ...cloudBase(h.cuBaseAgl, h.cuForms) },
    { label: 'OD base', ...cloudBase(h.odBaseAgl, h.odForms) },
    { label: 'BL shear', value: has(h.blShear) ? `${n1(h.blShear)} m/s` : DASH },
    { label: 'BL wind', value: h.blWind ? `${deg(h.blWind.dir)} ${n1(h.blWind.speed)} m/s` : DASH },
    { label: 'Cloud', value: h.cloud && has(h.cloud.total)
      ? `${h.cloud.total}% total · low ${h.cloud.low ?? DASH} · mid ${h.cloud.mid ?? DASH} · high ${h.cloud.high ?? DASH}` : DASH },
    { label: 'Rain', value: has(h.rainMm) ? `${n1(h.rainMm)} mm in the ${h.rainHours} h to ${h.time.slice(11, 16)}` : DASH },
    { label: 'CAPE', value: has(h.cape) ? `${Math.round(h.cape)} J/kg` : DASH },
    { label: 'Wind 10 m', value: h.wind10 && has(h.wind10.speed) && has(h.wind10.dir)
      ? `${deg(h.wind10.dir)} ${n1(h.wind10.speed)} m/s, gust ${has(h.gust) ? n1(h.gust) + ' m/s' : DASH}` : DASH },
    { label: 'Temperature', value: has(h.t2c) ? `${n1(h.t2c)} °C` : DASH },
    { label: 'Dewpoint', value: has(h.td2c) ? `${n1(h.td2c)} °C` : DASH },
  ].map(r => ({ dim: false, ...r }));
  if (h.reason) rows.push({ label: 'Why missing', value: h.reason, dim: false });
  return rows;
}

/** What the heights are measured from, for this model. */
export function groundLine(modelLabel, ground, fallback, fieldElevation = FIELD.elevationM) {
  return fallback
    ? `${modelLabel} gave no ground height · field elevation ${fieldElevation} m used`
    : `${modelLabel} ground ${Math.round(ground)} m · field ${fieldElevation} m`;
}

// Cell opacity grows with cover, which looks darker on a light page and brighter on a dark one: say neither.
export const CLOUD_LEGEND = 'rows: high · mid · low; faint = little, solid = overcast';

/**
 * The day's rain and the hours it really covers. Each computed hour's total reaches back to the previous computed hour,
 * so the span starts before the first hour shown and depends on the model; "—" when any part is unknown.
 */
export function rainSpan(hours) {
  if (!hours.length || hours.some(h => !has(h.rainMm))) return DASH;
  const sorted = [...hours].sort((a, b) => a.hour - b.hour);
  const mm = sorted.reduce((s, h) => s + h.rainMm, 0);
  const pad = n => String(n).padStart(2, '0');
  return `${n1(mm)} mm ${pad(sorted[0].hour - sorted[0].rainHours)}:00–${pad(sorted[sorted.length - 1].hour)}:00`;
}

/** HH:MM at the field. */
export function fieldClock(ms) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: FIELD.tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .format(new Date(ms));
}
