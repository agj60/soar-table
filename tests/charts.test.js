import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xForHour, runs, climbHcritSvg, cloudSvg, rainCapeSvg, chipSvg, windRowHtml } from '../js/charts.js';

const h = (hour, o = {}) => ({
  hour, climb: 1, hcritAgl: 800, cape: 500, rainMm: 0, cloud: { total: 20, low: 10, mid: 5, high: 0 },
  wind10: { speed: 3, dir: 180 }, gust: 6, ...o,
});
const count = (s, re) => (s.match(re) || []).length;

test('slots span 09–18', () => { assert.equal(xForHour(9, 100), 5); assert.equal(xForHour(18, 100), 95); });

test('ECMWF-like hours get markers but no lines', () => {
  const svg = climbHcritSvg([9, 12, 15, 18].map(x => h(x)), 320);
  assert.equal(count(svg, /<rect[^>]*data-hour/g), 4);
  assert.equal(count(svg, /<polyline/g), 0);
  assert.equal(count(svg, /<circle/g), 4);
});

test('hourly GFS hours get one line through all ten', () => {
  const svg = climbHcritSvg([9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map(x => h(x)), 320);
  assert.equal(count(svg, /<polyline/g), 1);
});

test('a missing value breaks the line and has no bar', () => {
  const svg = climbHcritSvg([9, 10, 11, 12].map(x => h(x, x === 11 ? { climb: null, hcritAgl: null } : {})), 320);
  assert.doesNotMatch(svg, /data-hour="11"/); assert.equal(count(svg, /<polyline/g), 1);
});

test('zero climb still draws a visible bar, unlike missing', () =>
  assert.equal(count(climbHcritSvg([h(12, { climb: 0 })], 320), /<rect[^>]*data-hour="12"/g), 1));

test('zero rain draws no bar', () => assert.doesNotMatch(rainCapeSvg([h(12)], 320), /<rect[^>]*class="rain"/));

test('rain above the scale is clipped, not overflowing', () => {
  const svg = rainCapeSvg([h(12, { rainMm: 40 })], 320);
  const height = Number(svg.match(/class="rain"[^>]*height="([\d.]+)"/)[1]);
  const top = Number(svg.match(/viewBox="0 0 [\d.]+ ([\d.]+)"/)[1]);
  assert.ok(height <= top, `${height} > ${top}`);
});

test('runs splits on gaps and nulls', () =>
  assert.deepEqual(runs([9, 10, 12, 13].map(x => h(x)), 'climb').map(r => r.map(x => x.hour)), [[9, 10], [12, 13]]));

test('cloud layers are drawn only at computed hours', () => {
  const svg = cloudSvg([h(9), h(12)], 320);
  assert.equal(count(svg, /data-hour="9"/g), 3); assert.equal(count(svg, /data-hour="10"/g), 0);
});

test('chip curve follows the same no-line-across-gaps rule', () => {
  assert.equal(count(chipSvg([9, 12, 15, 18].map(x => h(x)), 56), /<polyline/g), 0);
  assert.equal(count(chipSvg([9, 10, 11].map(x => h(x)), 56), /<polyline/g), 1);
});

test('wind row has a slot per window hour, filled only at computed hours', () => {
  const html = windRowHtml([h(9), h(15, { wind10: { speed: 7.4, dir: 270 }, gust: 12.6 })]);
  assert.equal(count(html, /class="wslot/g), 10);
  assert.match(html, /data-hour="15"[^]*?7[^]*?13/);
  assert.equal(count(html, /data-hour=/g), 2);
});
