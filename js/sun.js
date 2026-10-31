// Sun altitude, with the formulas of SunCalc 1.9.0 (https://github.com/mourner/suncalc), the library SoarCalc uses, so
// insolation matches it exactly. Computed here rather than loaded from a CDN, so the page has no outside script.
//
// SunCalc: Copyright (c) 2014, Vladimir Agafonkin. All rights reserved.
//
// Redistribution and use in source and binary forms, with or without modification, are
// permitted provided that the following conditions are met:
//
//    1. Redistributions of source code must retain the above copyright notice, this list of
//       conditions and the following disclaimer.
//
//    2. Redistributions in binary form must reproduce the above copyright notice, this list
//       of conditions and the following disclaimer in the documentation and/or other materials
//       provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
// EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
// MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
// COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
// EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION)
// HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR
// TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
// SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

const RAD = Math.PI / 180;
const DAY_MS = 86400000;
const J1970 = 2440588;
const J2000 = 2451545;
const OBLIQUITY = RAD * 23.4397;

const toDays = ms => ms / DAY_MS - 0.5 + J1970 - J2000;

function sunCoords(d) {
  const M = RAD * (357.5291 + 0.98560028 * d);                                            // mean anomaly
  const C = RAD * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));  // equation of centre
  const L = M + C + RAD * 102.9372 + Math.PI;                                             // ecliptic longitude
  return {
    dec: Math.asin(Math.sin(0) * Math.cos(OBLIQUITY) + Math.cos(0) * Math.sin(OBLIQUITY) * Math.sin(L)),
    ra: Math.atan2(Math.sin(L) * Math.cos(OBLIQUITY) - Math.tan(0) * Math.sin(OBLIQUITY), Math.cos(L)),
  };
}

/** Sun altitude above the horizon (radians), as SunCalc.getPosition computes it. */
export function sunAltitude(tsMs, lat, lon) {
  const d = toDays(tsMs);
  const phi = RAD * lat;
  const c = sunCoords(d);
  const H = RAD * (280.16 + 360.9856235 * d) - RAD * -lon - c.ra;                        // hour angle
  return Math.asin(Math.sin(phi) * Math.sin(c.dec) + Math.cos(phi) * Math.cos(c.dec) * Math.cos(H));
}

/** Clear-sky insolation (W/m²) corrected only for sun altitude: 1000·sin(altitude), 0 with the sun below the horizon. */
export function insolation(tsMs, lat, lon) {
  return 1000 * Math.sin(Math.max(0, sunAltitude(tsMs, lat, lon)));
}
