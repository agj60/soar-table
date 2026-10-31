// Turns computed forecast steps into days and hours ready to display. Dates and hours always come from the
// field-local time strings, never from the viewer's own clock or time zone.

import { FIELD, WINDOW } from './config.js';
import { computeSoaring } from './sounding.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Height above the model's ground, rounded; 0 when at or below it; null stays null. */
export function toAgl(zAmsl, ground) {
  return zAmsl == null ? null : Math.max(0, Math.round(zAmsl - ground));
}

const maxOf = values => {
  const v = values.filter(x => x != null);
  return v.length ? Math.max(...v) : null;
};

function windFrom({ vx, vy }) {
  return { speed: Math.hypot(vx, vy), dir: (Math.atan2(-vx, -vy) * 180 / Math.PI + 360) % 360 };
}

function hourView(step, ground) {
  const r = computeSoaring(step.sounding);
  const base = {
    time: step.time, hour: step.hour,
    cloud: step.cloud, rainMm: step.rainMm, rainHours: step.rainHours, cape: step.cape,
    wind10: step.wind10, gust: step.gust, t2c: step.t2c, td2c: step.td2c,
  };
  if (!r.ok) {
    return {
      ...base, climb: null, hcritAgl: null, bs: null, blTopAgl: null, cuBaseAgl: null, cuForms: null,
      odBaseAgl: null, odForms: null, blShear: null, blWind: null, reason: r.reason,
    };
  }
  return {
    ...base,
    climb: r.climb, hcritAgl: toAgl(r.hcrit, ground), bs: r.bs,
    blTopAgl: toAgl(r.blTop, ground),
    cuBaseAgl: toAgl(r.cuBase, ground), cuForms: r.cuForms,
    odBaseAgl: toAgl(r.odBase, ground), odForms: r.odForms,
    blShear: r.blShear, blWind: windFrom(r.blWind),
    reason: null,
  };
}

function label(date) {
  const [y, m, d] = date.split('-').map(Number);
  return `${WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}`;
}

export function buildDays(steps, gridElevation) {
  const byDate = new Map();
  for (const s of steps) {
    if (s.hour < WINDOW.from || s.hour > WINDOW.to) continue;
    if (!byDate.has(s.date)) byDate.set(s.date, []);
    byDate.get(s.date).push(hourView(s, gridElevation));
  }
  return [...byDate].map(([date, hours]) => ({
    date, label: label(date), hours,
    maxClimb: maxOf(hours.map(h => h.climb)),
    maxHcritAgl: maxOf(hours.map(h => h.hcritAgl)),
  }));
}

/** Today at the field if present, else the first later day, else the first day. */
export function defaultDayIndex(days, nowMs) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: FIELD.tz }).format(new Date(nowMs));
  const exact = days.findIndex(d => d.date === today);
  if (exact >= 0) return exact;
  const later = days.findIndex(d => d.date > today);
  return later >= 0 ? later : 0;
}
