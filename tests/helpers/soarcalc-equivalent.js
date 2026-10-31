// Turns one of our soundings into exactly what SoarCalc would see: only its fixed pressure levels, and surface pressure
// inferred from the 950 hPa height the way SoarCalc does, rather than Open-Meteo's surface_pressure.

export const SOARCALC_LEVELS = [1000, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300, 200, 150];

export function toSoarcalcEquivalent(sounding) {
  const levels = sounding.levels.filter(l => SOARCALC_LEVELS.includes(l.p / 100));
  const l950 = sounding.levels.find(l => l.p === 95000);
  const seaLevel = 95000 * Math.pow(1 - 2.25577e-5 * l950.z, -5.25588);
  const p = seaLevel * Math.pow(1 - 2.25577e-5 * sounding.surface.z, 5.25588);
  return { ...sounding, surface: { ...sounding.surface, p }, levels };
}
