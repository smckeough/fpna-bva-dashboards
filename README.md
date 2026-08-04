# fpna-bva-dashboards

Config-driven **Budget vs Actual** dashboards for the Medallion FP&A team.

## What's here

A Next.js 16 app that renders every dashboard from JSON:

- `dashboard-config.json` — layout (which dashboards exist, their route, template, sections)
- `dashboard-data-index.json` — list of closed months + which is the default
- `dashboard-data-<YYYY-MM>.json` — one file per closed month (numbers)

The app fetches all three at **runtime** — overwriting them on the Finance server updates the live app with no redeploy.

## Monthly close workflow

Each close cycle:

1. Update the FP&A workbook the usual way (paste in QBO actuals, Rippling headcount, operating-model budget). Excel formulas do the mapping and populate the `Dashboard JSON` sheet.
2. Run the export script:
   ```bash
   python scripts/export_month.py "path/to/(NEW) July 2026 Department HC & Opex Template.xlsx"
   ```
   It writes `sample-data/dashboard-data-2026-07.json` and updates the index.
3. Upload the new files to the Finance server (or commit + push if the server pulls from git).

The dashboards now show July, and the month picker gains a "July 2026" entry.

## Where the data lives at runtime

Production reads from `process.env.NEXT_PUBLIC_DATA_BASE_URL` (the Finance-server URL that hosts the three JSON files).

For local dev, when `NEXT_PUBLIC_DATA_BASE_URL` is unset, the app reads from `sample-data/` on disk directly.

```
NEXT_PUBLIC_DATA_BASE_URL=https://finance.medallion.co/fpna  # example
```

## Local dev

```bash
npm install
npm run dev
```

Open http://localhost:3000. The sidebar lists every dashboard from `dashboard-config.json` grouped by Departments / Leaders. The month picker in each dashboard's header switches between months without a full navigation.

## Routing

`app/[...slug]/page.tsx` is a catch-all. For each request it builds the route as `"/" + slug.join("/")`, looks it up against `config.dashboards[].route`, then finds the record where `name === dataKey` in the current month's `data[source]`.

`app/api/month/[key]/route.ts` serves individual months to the client-side month picker.

## Section types

Templates are composed from these sections (see `dashboard-config.json` → `templates`):

- `flagBanner` — auto-renders any of `BUDGET_NOT_LOADED`, `HC_ACTUAL_MISSING`, `REVIEW_LARGE_VARIANCE`; suppresses variances when `budgetLoaded === false`.
- `kpiCards` — array of `{ label, metric, kind, period }`.
- `varianceTable` — `rows`, `periods`, `totalRows`.
- `barChart` — grouped Actual vs Budget across `metrics`.
- `lineChart`, `trendSparkline`, `commentary` — declared in the palette; extend `components/DashboardShell.tsx` to implement new ones.

## Cost lens

`varPct > 0` = actual over budget = **unfavorable (red)**.
`varPct < 0` = **favorable (green)**.

## Deploy

`internal-tool.yaml` + `.circleci/config.yml` use the `medallion/internal-tool-deploy` orb. Both files contain `TODO(Gary)` markers for subdomain, runtime, node version, port, build/start commands — confirm against https://github.com/trymedallion/internal-tool-deploy-orb before the first deploy.
