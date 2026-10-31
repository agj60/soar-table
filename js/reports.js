// SBSJ METAR and TAF from MET Norway's public tafmetar service (browser-readable, no key).

export const METAR_URL = 'https://api.met.no/weatherapi/tafmetar/1.0/metar.txt?icao=SBSJ';
export const TAF_URL = 'https://api.met.no/weatherapi/tafmetar/1.0/taf.txt?icao=SBSJ';

/** The reports in a tafmetar text, oldest first, each on one line without its closing '='. */
export function parseReports(text) {
  return text.split('=').map(r => r.replace(/\s+/g, ' ').trim()).filter(Boolean);
}
