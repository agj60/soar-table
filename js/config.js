// Everything the page needs to know about the airfield and the forecast models, in one place.

// SDIP = Fazenda Centro de Vôo a Vela Ipuã, Caçapava SP. Grass 08/26, elevation 583 m.
export const FIELD = {
  icao: 'SDIP',
  name: 'Ipuã',
  lat: -23.042711,
  lon: -45.775133,
  tz: 'America/Sao_Paulo',
  elevationM: 583,
};

// Local hours shown, inclusive. Widened from 10–17 so ECMWF's 3-hourly steps give four points a day.
export const WINDOW = { from: 9, to: 18 };

export const DEFAULT_MODEL = 'gfs';
export const MODEL_ORDER = ['gfs', 'ecmwf', 'icon'];

// `schedule` lists the provider's real output steps by lead time from the run's initialisation. Open-Meteo fills
// every hour by blending between those steps, so the page keeps only hours on this schedule.
export const MODELS = {
  gfs: {
    key: 'gfs',
    label: 'GFS',
    openMeteo: 'gfs_seamless',
    meta: 'ncep_gfs025',
    forecastDays: 16,
    levels: [1000, 975, 950, 925, 900, 875, 850, 825, 800, 775, 750, 700, 650, 600, 550, 500, 400, 300, 250, 200, 150],
    // GFS 0.25°: hourly 0–120 h, 3-hourly 120–384 h.
    // https://www.nco.ncep.noaa.gov/pmb/products/gfs/nomads/
    // https://developers.google.com/earth-engine/datasets/catalog/NOAA_GFS0P25
    schedule: [{ untilLead: 120, step: 1 }, { untilLead: Infinity, step: 3 }],
  },
  ecmwf: {
    key: 'ecmwf',
    label: 'ECMWF',
    openMeteo: 'ecmwf_ifs025',
    meta: 'ecmwf_ifs025',
    forecastDays: 15,
    levels: [1000, 925, 850, 700, 600, 500, 400, 300, 250, 200, 150],
    // ECMWF IFS 0.25° open data: 0–144 h by 3, then 150–360 h by 6 (00/12 UTC runs; 06/18 UTC stop at 144 h).
    // https://confluence.ecmwf.int/display/DAC/ECMWF+open+data%3A+real-time+forecasts+from+IFS+and+AIFS
    schedule: [{ untilLead: 144, step: 3 }, { untilLead: Infinity, step: 6 }],
  },
  icon: {
    key: 'icon',
    label: 'ICON',
    openMeteo: 'icon_seamless',
    meta: 'dwd_icon',
    forecastDays: 8,
    levels: [1000, 975, 950, 925, 900, 850, 800, 700, 600, 500, 400, 300, 250, 200, 150],
    // ICON global: hourly to 78 h, then 3-hourly (to 180 h for 00/12 UTC, 120 h for 06/18 UTC).
    // https://opendata.dwd.de/weather/nwp/icon/grib/
    // https://py.contrails.org/api/pycontrails.datalib.dwd.ICON.html
    schedule: [{ untilLead: 78, step: 1 }, { untilLead: Infinity, step: 3 }],
  },
};

/** The provider's output interval (hours) at this lead time. */
export function stepHoursAt(modelKey, leadHours) {
  return MODELS[modelKey].schedule.find(s => leadHours <= s.untilLead).step;
}

/** True when the model itself produced output at this lead time, rather than Open-Meteo blending between steps. */
export function isComputedStep(modelKey, leadHours) {
  if (!Number.isInteger(leadHours) || leadHours < 0) return false;
  return leadHours % stepHoursAt(modelKey, leadHours) === 0;
}
