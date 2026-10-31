// SoarCalc's thermal-soaring method (RASP/BLIPMAP formulas), implemented from the design document.
// All heights are metres AMSL, pressures Pa, temperatures K, winds m/s.

import { insolation } from './sun.js';

const Rd = 287;              // gas constant, dry air (J kg-1 K-1)
const Rv = 462;              // gas constant, water vapour (J kg-1 K-1)
const g = 9.81;              // m s-2
const Cp = 1004.67;          // specific heat of dry air at constant pressure (J kg-1 K-1)
const RHO = 1.21;            // surface air density (kg m-3)
const ZERO_C = 273.16;       // used by Tetens, as SoarCalc does
const DRY_LAPSE = -0.00975;  // K m-1
const WCRIT = 0.9;           // sink rate of a thermalling glider (m/s)
const MOIST = (Rv - Rd) / Rd;

/** Tetens: saturation vapour pressure (Pa) at temperature tK. */
export function saturationVapourPressure(tK) {
  const tc = tK - ZERO_C;
  return 610.78 * Math.exp(17.27 * tc / (tc + 237.3));
}

/** Mixing ratio (kg/kg) from relative humidity 0–1, temperature (K) and pressure (Pa). */
export function mixingRatio(rh, tK, pPa) {
  const e = rh * saturationVapourPressure(tK);
  return (Rd / Rv) * e / (pPa - e);
}

export function virtualTemp(tK, u) {
  return tK * (1 + MOIST * u);
}

/**
 * Fraction of the BL depth at which the RASP updraft profile w/W* = 2.2·z^(1/3)·(1 − 1.1z) falls to wcrit/W*.
 * Newton–Raphson from z = 0.9; 0 when thermals never reach wcrit.
 */
export function zcrit(wcrit, wstarValue) {
  if (wcrit > wstarValue) return 0;
  const w0 = wcrit / wstarValue;
  let z = 0.9, dz;
  let guard = 0;
  do {
    const w = 2.2 * Math.cbrt(z) * (1 - 1.1 * z);
    const dwdz = 2.2 * ((1 / 3) * Math.pow(z, -2 / 3) * (1 - 1.1 * z) - 1.1 * Math.cbrt(z));
    dz = (w - w0) / dwdz;
    z -= dz;
  } while (Math.abs(dz) > 0.001 && ++guard < 100);
  return z;
}

/** Deardorff convective velocity scale W* (m/s) from insolation (W/m²), BL depth (m) and surface mixing ratio. */
export function wstar(qs, depthM, u) {
  const qg = 0.1 * qs;                          // flux into the ground
  const qhTilde = 6 * (qs - qg) / (1 + 6);      // sensible heat, Bowen ratio 6
  const qh = qhTilde / (RHO * Cp);              // kinematic
  const qov = qh * (1 + MOIST * u);             // kinematic virtual
  return Math.cbrt(qov * depthM * g / 288);
}

// A level with its derived moisture terms.
function prepare(l) {
  const u = mixingRatio(l.rh, l.t, l.p);
  return { ...l, u, tv: virtualTemp(l.t, u), us: mixingRatio(1, l.t, l.p) };
}

// Linear interpolation of every field between two levels at height z.
function interpolate(hi, lo, z) {
  const f = (z - lo.z) / (hi.z - lo.z);
  const mix = k => lo[k] + (hi[k] - lo[k]) * f;
  return prepare({ z, p: mix('p'), t: mix('t'), rh: mix('rh'), td: mix('td'), vx: mix('vx'), vy: mix('vy') });
}

// Height where the environment's Tv line between lo and hi meets the dry-adiabatic parcel line from the surface.
function blTopLevel(levels) {
  const s = levels[0];
  for (let i = 1; i < levels.length; i++) {
    const hi = levels[i], lo = levels[i - 1];
    if (hi.tv > s.tv + DRY_LAPSE * (hi.z - s.z)) {
      const envLapse = (hi.tv - lo.tv) / (hi.z - lo.z);
      const z = (s.tv - lo.tv + lo.z * envLapse - s.z * DRY_LAPSE) / (envLapse - DRY_LAPSE);
      return z - s.z > 10 ? interpolate(hi, lo, z) : s;
    }
  }
  return levels[levels.length - 1];
}

// Height-weighted average of a field from the surface to the BL top (trapezoids).
function blAverage(levels, top, key) {
  const s = levels[0];
  const depth = top.z - s.z;
  if (depth < 10) return s[key];
  let sum = 0;
  for (let i = 1; i < levels.length; i++) {
    const lo = levels[i - 1];
    if (levels[i].z > top.z) {
      sum += (top.z - lo.z) * (top[key] + lo[key]) / 2;
      break;
    }
    sum += (levels[i].z - lo.z) * (levels[i][key] + lo[key]) / 2;
  }
  return sum / depth;
}

// First height where the saturation mixing ratio drops below u (overdevelopment / spread-out base).
function condensationHeight(levels, u) {
  for (let i = 1; i < levels.length; i++) {
    const hi = levels[i], lo = levels[i - 1];
    if (hi.us < u) return lo.z + (hi.z - lo.z) * (u - lo.us) / (hi.us - lo.us);
  }
  return levels[levels.length - 1].z;
}

/** SoarCalc's thermal parameters for one sounding. Never returns 0 for something it could not compute. */
export function computeSoaring({ tsMs, lat, lon, surface, levels, cloud }) {
  if (cloud === null || cloud === undefined) return { ok: false, reason: 'cloud cover missing' };
  const above = levels.filter(l => l.z > surface.z).sort((a, b) => a.z - b.z);
  if (!above.length) return { ok: false, reason: 'no pressure level above model ground' };

  const all = [prepare(surface), ...above.map(prepare)];
  const s = all[0];
  const top = blTopLevel(all);
  const blDepth = Math.max(0, top.z - s.z);

  const blU = blAverage(all, top, 'u');
  const blWind = { vx: blAverage(all, top, 'vx'), vy: blAverage(all, top, 'vy') };

  const qs0 = insolation(tsMs, lat, lon);
  const qs = cloud >= 1 ? 0 : (1 - cloud) * qs0;
  const w = wstar(qs, blDepth, s.u);
  const climb = w > WCRIT ? w - WCRIT : 0;
  const hcrit = s.z + zcrit(WCRIT, w) * blDepth;

  const cuBase = s.z + 125 * (s.t - s.td);
  const odBase = condensationHeight(all, blU);

  const shear = Math.hypot(top.vx - s.vx, top.vy - s.vy);
  let bs = null;
  if (w === 0) bs = 0;
  else if (shear * shear > 1e-6) bs = (w * w) / (4 * shear * shear);

  return {
    ok: true,
    blTop: top.z, cuBase, odBase, blDepth,
    wstar: w, climb, hcrit, bs,
    blShear: shear, blWind,
    cuForms: cuBase < top.z, odForms: odBase < top.z,
    qs0, qs,
  };
}
