import SunCalc from 'suncalc';

/** Clear-sky insolation (W/m²) corrected only for sun altitude: 1000·sin(altitude), 0 with the sun below the horizon. */
export function insolation(tsMs, lat, lon) {
  const altitude = SunCalc.getPosition(new Date(tsMs), lat, lon).altitude;
  return 1000 * Math.sin(Math.max(0, altitude));
}
