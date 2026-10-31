// Wires the computed modules to the page: model switch, SBSJ reports, day strip, charts and the hour detail.

import { MODELS, MODEL_ORDER, DEFAULT_MODEL, WINDOW } from './config.js';
import { loadModel, loadReports, runLabel } from './load.js';
import { defaultDayIndex } from './days.js';
import { climbHcritSvg, cloudSvg, rainCapeSvg, chipSvg, windRowHtml } from './charts.js';
import { detailRows, groundLine, fieldClock, rainSpan, CLOUD_LEGEND } from './format.js';

const AISWEB = 'https://aisweb.decea.mil.br/?i=aerodromos&amp;codigo=SBSJ#met';
const REFETCH_MS = 30 * 60 * 1000;
const SLOTS = WINDOW.to - WINDOW.from + 1;
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = n => String(n).padStart(2, '0');

const state = { model: DEFAULT_MODEL, cache: new Map(), pending: new Map(), date: null, hour: null, lastFetch: 0 };

// One fetch per model per session; failures are not cached so Retry fetches again.
function getModel(key) {
  if (state.cache.has(key)) return Promise.resolve(state.cache.get(key));
  if (!state.pending.has(key)) {
    state.pending.set(key, loadModel(key).then(r => {
      state.pending.delete(key);
      if (r.ok) state.cache.set(key, { ...r, fetchedAt: Date.now() });
      return state.cache.get(key) || r;
    }));
  }
  return state.pending.get(key);
}

function renderModels() {
  $('models').innerHTML = MODEL_ORDER.map(k =>
    `<button type="button" data-model="${k}" aria-pressed="${k === state.model}">${MODELS[k].label}</button>`).join('');
}

async function showReports() {
  const el = $('reports');
  const r = await loadReports();
  if (!r.metar && !r.taf) {
    el.innerHTML = `SBSJ reports unavailable. <a href="${AISWEB}">AISWEB SBSJ</a>`;
    return;
  }
  const metar = r.metar === null ? `unavailable (<a href="${AISWEB}">AISWEB</a>)`
    : r.metar.length ? r.metar.map(esc).join('\n') : 'no METAR in the last 24 h';
  const taf = r.taf === null ? (r.errors.some(e => e.startsWith('TAF')) ? `unavailable (<a href="${AISWEB}">AISWEB</a>)` : 'no current TAF')
    : esc(r.taf);
  el.innerHTML = `<div class="lbl">SBSJ METAR</div>${metar}<div class="lbl">SBSJ TAF</div>${taf}`;
}

function longDate(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

const axis = () => `<div class="axis">${Array.from({ length: SLOTS }, (_, i) => `<span>${pad(WINDOW.from + i)}</span>`).join('')}</div>`;
const card = (title, right, body) => `<div class="card"><div class="cap"><span>${title}</span><span>${right}</span></div>${body}</div>`;

function renderDay(model) {
  const day = model.days.find(d => d.date === state.date);
  const width = Math.max(240, Math.round(($('charts').clientWidth || 320) - 20));
  const capes = day.hours.map(h => h.cape).filter(v => v != null);
  $('dayhead').textContent = longDate(day.date);
  $('charts').innerHTML =
    card('Climb <span class="dim">(bars, m/s)</span> · Hcrit <span class="dim">(line, m above model ground)</span>',
      `max <b>${day.maxClimb == null ? '—' : day.maxClimb.toFixed(1)}</b> m/s · <b>${day.maxHcritAgl ?? '—'}</b> m`,
      climbHcritSvg(day.hours, width) + axis()) +
    card(`Cloud <span class="dim">(${esc(CLOUD_LEGEND)})</span>`, '', cloudSvg(day.hours, width)) +
    card('Rain <span class="dim">(bars, mm)</span> · CAPE <span class="dim">(line, J/kg)</span>',
      `${esc(rainSpan(day.hours))} · max <b>${capes.length ? Math.round(Math.max(...capes)) : '—'}</b> J/kg`,
      rainCapeSvg(day.hours, width)) +
    card('Wind 10 m <span class="dim">(m/s, gust below)</span>', '', `<div class="wind">${windRowHtml(day.hours)}</div>` + axis());
  renderDetail(model, day);
}

function renderDetail(model, day) {
  for (const el of $('charts').querySelectorAll('.sel')) el.classList.remove('sel');
  const h = day.hours.find(x => x.hour === state.hour);
  if (!h) {
    $('detail').innerHTML = '<p class="note">Tap an hour on the charts to see all its numbers.</p>';
    return;
  }
  for (const el of $('charts').querySelectorAll(`[data-hour="${h.hour}"]`)) el.classList.add('sel');
  const rows = detailRows(h).map(r => `<dt>${esc(r.label)}</dt><dd${r.dim ? ' class="dim"' : ''}>${esc(r.value)}</dd>`).join('');
  $('detail').innerHTML = `<div class="card"><div class="dh">${esc(day.label)} · ${pad(h.hour)}:00 · ${MODELS[state.model].label}</div>` +
    `<dl>${rows}</dl><p class="note">${esc(groundLine(MODELS[state.model].label, model.gridElevation, model.gridElevationFallback))}</p></div>`;
}

function renderStrip(model) {
  $('days').innerHTML = model.days.map(d =>
    `<button type="button" class="chip" data-date="${esc(d.date)}" aria-pressed="${d.date === state.date}">${esc(d.label)}${chipSvg(d.hours, 58)}</button>`).join('');
  const sel = $('days').querySelector('[aria-pressed="true"]');
  if (sel) sel.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

async function showModel() {
  const key = state.model;
  renderModels();
  $('run').textContent = `${MODELS[key].label} · loading…`;
  const model = await getModel(key);
  if (key !== state.model) return;                       // switched again while loading
  if (!model.ok) {
    $('run').textContent = MODELS[key].label;
    $('forecast').innerHTML = `<div class="err"><b>Forecast unavailable:</b> ${esc(model.message)}<button type="button" id="retry">Retry</button></div>`;
    return;
  }
  $('run').textContent = `${MODELS[key].label} run ${runLabel(model.runInitMs)} · fetched ${fieldClock(model.fetchedAt)}`;
  if (!model.days.length) {
    $('forecast').innerHTML = '<p class="note">This model run has no computed hours between 09:00 and 18:00.</p>';
    return;
  }
  if (!model.days.some(d => d.date === state.date)) {
    state.date = model.days[defaultDayIndex(model.days, Date.now())].date;
    state.hour = null;
  }
  $('forecast').innerHTML = '<div class="chips" id="days"></div><h2 id="dayhead"></h2><div id="charts"></div><div id="detail" class="detail"></div>';
  renderStrip(model);
  renderDay(model);
}

function refresh() {
  state.cache.clear();
  state.lastFetch = Date.now();
  showReports();
  showModel();
}

document.addEventListener('click', e => {
  const modelBtn = e.target.closest('[data-model]');
  if (modelBtn) {
    if (modelBtn.dataset.model !== state.model) { state.model = modelBtn.dataset.model; state.hour = null; showModel(); }
    return;
  }
  if (e.target.closest('#retry')) { showModel(); return; }
  const model = state.cache.get(state.model);
  if (!model) return;
  const chip = e.target.closest('[data-date]');
  if (chip) { state.date = chip.dataset.date; state.hour = null; renderStrip(model); renderDay(model); return; }

  // Any tap on a chart picks the nearest computed hour in that column.
  const charts = e.target.closest('#charts');
  if (!charts) return;
  const marked = e.target.closest('[data-hour]');
  let hour = marked ? Number(marked.dataset.hour) : null;
  if (hour === null) {
    const box = e.target.closest('svg, .wind');
    if (!box) return;
    const r = box.getBoundingClientRect();
    hour = WINDOW.from + Math.min(SLOTS - 1, Math.max(0, Math.floor((e.clientX - r.left) / r.width * SLOTS)));
  }
  const day = model.days.find(d => d.date === state.date);
  if (day && day.hours.some(h => h.hour === hour)) { state.hour = hour; renderDetail(model, day); }
});

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && Date.now() - state.lastFetch > REFETCH_MS) refresh();
});

let lastWidth = 0;
window.addEventListener('resize', () => {
  const model = state.cache.get(state.model);
  const charts = $('charts');
  if (!model || !charts || Math.abs(charts.clientWidth - lastWidth) < 8) return;
  lastWidth = charts.clientWidth;
  renderDay(model);
});

refresh();
