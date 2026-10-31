// SVG strings for the day charts. Marks exist only at hours the model computed; lines never span an hour it didn't.
// Scales are fixed for every day and model so days compare at a glance. Colours come from CSS classes.

import { WINDOW } from './config.js';

const SLOTS = WINDOW.to - WINDOW.from + 1;
const SCALE = { climb: 3, hcrit: 2500, rain: 10, cape: 3000 };
const f = n => +n.toFixed(1);
const frac = (v, top) => Math.min(Math.max(v, 0), top) / top;

export function xForHour(hour, width) {
  return (hour - WINDOW.from + 0.5) * width / SLOTS;
}

/** Maximal runs of consecutive hours (one hour apart) whose `key` is non-null, in hour order. */
export function runs(hours, key) {
  const out = [];
  let current = [];
  for (const h of [...hours].sort((a, b) => a.hour - b.hour)) {
    const prev = current[current.length - 1];
    if (h[key] == null) { if (current.length) out.push(current); current = []; continue; }
    if (prev && h.hour - prev.hour !== 1) { out.push(current); current = []; }
    current.push(h);
  }
  if (current.length) out.push(current);
  return out;
}

// One polyline per run of two or more points; dots at every point carry data-hour for tapping.
function line(hours, key, width, y, cls, dots = true) {
  let s = '';
  for (const run of runs(hours, key)) {
    if (run.length > 1)
      s += `<polyline class="${cls}" fill="none" points="${run.map(h => `${f(xForHour(h.hour, width))},${f(y(h[key]))}`).join(' ')}"/>`;
    if (dots || run.length === 1)
      for (const h of run)
        s += `<circle class="${cls}-dot" ${dots ? `data-hour="${h.hour}" ` : ''}cx="${f(xForHour(h.hour, width))}" cy="${f(y(h[key]))}" r="${dots ? 2.5 : 1.5}"/>`;
  }
  return s;
}

const svg = (width, height, body) =>
  `<svg viewBox="0 0 ${width} ${height}" width="100%" height="${height}" preserveAspectRatio="none" role="img">${body}</svg>`;

/** Climb as bars (0–3 m/s), Hcrit above model ground as a line (0–2500 m). */
export function climbHcritSvg(hours, width) {
  const H = 90, plot = H - 8, base = H - 2, barW = width / SLOTS * 0.6;
  let body = '';
  for (const h of hours) {
    if (h.climb == null) continue;
    const bh = Math.max(1.5, frac(h.climb, SCALE.climb) * plot);   // a thin bar keeps 0 distinct from missing
    body += `<rect class="climb" data-hour="${h.hour}" x="${f(xForHour(h.hour, width) - barW / 2)}" y="${f(base - bh)}" width="${f(barW)}" height="${f(bh)}"/>`;
  }
  body += line(hours, 'hcritAgl', width, v => base - frac(v, SCALE.hcrit) * plot, 'hcrit');
  return svg(width, H, body);
}

/** Cloud cover as three rows (high, mid, low from the top), each cell shaded by its percentage. */
export function cloudSvg(hours, width) {
  const ROW = 12, H = ROW * 3, w = width / SLOTS * 0.8;
  let body = '';
  for (const h of hours) {
    if (!h.cloud) continue;
    ['high', 'mid', 'low'].forEach((layer, row) => {
      const pct = h.cloud[layer];
      if (pct == null) return;
      body += `<rect class="cloud-${layer}" data-hour="${h.hour}" x="${f(xForHour(h.hour, width) - w / 2)}" y="${row * ROW}" width="${f(w)}" height="${ROW - 1}" fill-opacity="${f(frac(pct, 100) * 0.9 + 0.05)}"/>`;
    });
  }
  return svg(width, H, body);
}

/** Rain since the previous computed step as bars (0–10 mm), CAPE as a line (0–3000 J/kg). */
export function rainCapeSvg(hours, width) {
  const H = 44, barW = width / SLOTS * 0.6;
  let body = '';
  for (const h of hours) {
    if (!(h.rainMm > 0)) continue;
    const bh = frac(h.rainMm, SCALE.rain) * (H - 4);
    body += `<rect class="rain" data-hour="${h.hour}" x="${f(xForHour(h.hour, width) - barW / 2)}" y="${f(H - bh)}" width="${f(barW)}" height="${f(bh)}"/>`;
  }
  body += line(hours, 'cape', width, v => H - 2 - frac(v, SCALE.cape) * (H - 6), 'cape');
  return svg(width, H, body);
}

/** The day chip's tiny Climb curve. */
export function chipSvg(hours, width) {
  const H = 20;
  return svg(width, H, line(hours, 'climb', width, v => H - 1 - frac(v, SCALE.climb) * (H - 2), 'chip', false));
}

/** 10 m wind (arrow towards where it blows, speed) and gust, one slot per window hour. */
export function windRowHtml(hours) {
  const byHour = new Map(hours.map(h => [h.hour, h]));
  let html = '';
  for (let hour = WINDOW.from; hour <= WINDOW.to; hour++) {
    const h = byHour.get(hour);
    if (!h) { html += '<div class="wslot empty"></div>'; continue; }
    const { speed, dir } = h.wind10 || {};
    const arrow = speed == null || dir == null ? '' : `<span class="arrow" style="transform:rotate(${Math.round(dir + 180) % 360}deg)">↑</span>`;
    html += `<div class="wslot" data-hour="${hour}">${arrow}<span class="ws">${speed == null ? '—' : Math.round(speed)}</span>` +
      `<span class="wg">${h.gust == null ? '—' : Math.round(h.gust)}</span></div>`;
  }
  return html;
}
