# SDIP soaring forecast

Thermal soaring numbers for **SDIP**, *Fazenda Centro de Vôo a Vela Ipuã*, Caçapava/SP: Climb, Hcrit and B/S, with
cloud, rain, CAPE and wind, from 09:00 to 18:00 local for every day the chosen model covers.

**→ https://agj60.github.io/soar-table/**

The page is a static site with no collector behind it. Each time it is opened it fetches the forecast and computes the
numbers in the browser:

- **Forecast:** [Open-Meteo](https://open-meteo.com/) (CC BY 4.0). Models are GFS (default), ECMWF and ICON. Values
  appear only at hours the model itself computed: Open-Meteo blends the hours in between, and those are left out.
- **Thermal parameters:** SoarCalc's method (RASP), reimplemented in `js/sounding.js` from the formulas. No SoarCalc
  code is included. The sun position in `js/sun.js` uses SunCalc's formulas (BSD-2, notice kept), so the page loads
  no outside scripts.
- **SBSJ METAR/TAF:** [MET Norway](https://api.met.no/) (CC BY 4.0).
- Links to AISWEB (SBSJ) and INMET's meteogram for Caçapava-SP.

Heights are metres above each model's own ground, which is stated for every hour.

## Development

```sh
npm install && npm test        # Node 20+, built-in test runner; suncalc is a dev-only cross-check
python3 -m http.server 8765    # then open http://localhost:8765/
```

`tools/soarcalc-reference.mjs` (when present) compares `js/sounding.js` with SoarCalc's own code on identical inputs. It
needs a local SoarCalc checkout in `tools/.cache/`, which is gitignored and never committed.
