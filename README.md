# SoarCalc @ SDIP — forecast table

Thermal soaring parameters (Climb, Hcrit, B/S) for **SDIP**, *Fazenda Centro de Vôo a Vela
Ipuã*, Caçapava/SP, for every available forecast model and each hour from 10:00 to 17:00 local.

**→ https://agj60.github.io/soar-table/**

`data.json` is a snapshot collected from the [SoarCalc](https://github.com/tomgooch/windy-plugin-soarcalc)
plugin on windy.com and published here; the page reads it and renders the table. A page hosted
on github.io cannot query Windy itself — `node.windy.com` only sends CORS headers for
`localhost` and `*.windy.com` — so the collector runs elsewhere and pushes the result here.
The page shows how old the snapshot is.
