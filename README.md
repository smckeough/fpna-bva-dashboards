# fpna-bva-dashboards

Config-driven **Budget vs Actual** dashboards for the Medallion FP&A team.

## What's here

A Next.js 16 app that renders every dashboard from two JSON blobs:

- `dashboard-data.json` — numbers (departments and leader rollups, with headcount/COGS/OpEx broken into MTD/QTD/YTD).
- `dashboard-config.json` — layout (which dashboards exist, their route, which template, which sections/rows/metrics).

The app fetches both files at **runtime** — overwriting them on the Finance server updates the live app with no redeploy.

## Where the data lives

Production reads both files from `process.env.NEXT_PUBLIC_DATA_BASE_URL` (the Finance-server URL that hosts them).

For local dev, when `NEXT_PUBLIC_DATA_BASE_URL` is unset, the app reads `sample-data/dashboard-data.json` and `sample-data/dashboard-config.json` directly from disk.

```
NEXT_PUBLIC_DATA_BASE_URL=https://finance.medallion.co/fpna  # example
```

## Local dev

```bash
npm install
npm run dev
```

Open http://localhost:3000. The sidebar lists every dashboard from `dashboard-config.json` grouped by Departments / Leaders.

## Routing

`app/[...slug]/page.tsx` is a catch-all. For each request it builds the route as `"/" + slug.join("/")`, looks it up against `config.dashboards[].route`, then finds the record where `name === dataKey` in `data[source]`. Params are async in Next 16 (`const { slug } = await params;`).

## Section types

Templates are composed from these sections:

- `flagBanner` — auto-renders any of `BUDGET_NOT_LOADED`, `HC_ACTUAL_MISSING`, `REVIEW_LARGE_VARIANCE`; suppresses variances when `budgetLoaded === false`.
- `kpiCards` — array of `{ label, metric, kind, period }`.
- `varianceTable` — `rows`, `periods`, `totalRows`.
- `barChart` — grouped Actual vs Budget across `metrics`.
- `lineChart`, `trendSparkline`, `commentary`.

## Cost lens

`varPct > 0` = actual over budget = **unfavorable (red)**.
`varPct < 0` = **favorable (green)**.

## Deploy

`internal-tool.yaml` + `.circleci/config.yml` use the `medallion/internal-tool-deploy@4` orb. Both files contain **TODO(Gary)** markers for subdomain, runtime, node version, port, build/start commands, and any orb@4 job params — confirm against https://github.com/trymedallion/internal-tool-deploy-orb before the first deploy.
