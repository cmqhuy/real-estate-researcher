# Data Pipeline

## manifest.json
Tracks supported states and YYYYMMDD versions of metrics and geodata:
```json
{
  "supportedStates": ["TX", "WA"],
  "metricsVersions": { "TX": "20260523", "WA": "20260523" },
  "geodataVersions": { "TX": "20260523", "WA": "20260523" }
}
```

## Data Sources
Zillow CSV datasets are queried at State, Metro, County, and Zip levels from `https://files.zillowstatic.com/research/public_csvs/{dataset_slug}/`:
- **ZHVI** (Home Value, Growth): `{Level}_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`
- **ZORI** (Rent, Rent Growth): `{Level}_zori_uc_sfrcondomfr_sm_month.csv` — unavailable at State level (falls back to null).
- **DOM** (Days on Market): `{Level}_mean_doz_pending_uc_sfrcondo_sm_month.csv`

## File Naming
- Metrics: `{state_lower}_metrics_{YYYYMMDD}.json` (e.g. `tx_metrics_20260523.json`)
- Geodata: `{state_lower}_{level}_geodata_{YYYYMMDD}.json` (e.g. `tx_county_geodata_20260523.json`)

## Auto-refresh on Startup (Dev Only)
On startup, `MapManager` compares the local time with the timestamps inside `manifest.json`:
- **Metrics** are auto-refreshed if **≥ 7 days old**.
- **Geodata** is auto-refreshed if **≥ 30 days old**.
If outdated, shows a downloading overlay, calls the `/api/refresh-data` Vite dev server endpoint, and reloads on success. Only runs in dev mode (`import.meta.env.DEV`).
