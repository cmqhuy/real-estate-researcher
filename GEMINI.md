# Real Estate Researcher — Project Context

A Vite + TypeScript interactive map for visualizing US real estate metrics by ZIP code. Data is sourced from Zillow Research and displayed as a choropleth map using Leaflet.js.

---

## Tech Stack

- **Frontend**: Vite + TypeScript, Leaflet.js, Vanilla CSS
- **Data scripts**: Node.js (ESM), csv-parser, https (built-in)
- **Fonts**: Inter (Google Fonts)
- **Map tiles**: CartoDB (dark & light themes)

---

## Project Structure

```
real-estate-researcher/
├── index.html                  # Main HTML — sidebar metric options + map layout
├── vite.config.ts              # Vite config with custom /api/refresh-data endpoint
├── tsconfig.json
├── package.json
├── public/
│   ├── data/
│   │   ├── manifest.json                        # Tracks supported states + data versions (YYYYMMDD)
│   │   ├── {state}_metrics_{YYYYMMDD}.json      # Zillow metrics per ZIP (real estate data)
│   │   └── geodata/
│   │       └── {state}_geodata_{YYYYMMDD}.json  # GeoJSON ZIP code boundaries
│   ├── favicon.svg
│   └── icons.svg
├── scripts/
│   ├── fetch_real_estate_data.js   # Downloads Zillow CSVs, writes per-state metrics JSON
│   └── fetch_geo_data.js           # Downloads GeoJSON from OpenDataDE GitHub repo
└── src/
    ├── main.ts         # App entry: wires sidebar, map, search, legend, theme toggle
    ├── map.ts          # MapManager: data loading, color rendering, auto-refresh logic
    ├── colors.ts       # Color scale logic (blue→white→red), MetricType definitions
    ├── legend.ts       # LegendManager: updates legend labels/title based on active metric
    ├── sidebar.ts      # SidebarManager: handles metric radio button selection
    ├── search.ts       # SearchManager: location search, flies map to result
    ├── tooltip.ts      # TooltipManager: hover tooltip on ZIP code polygons
    └── style.css       # All styles (dark/light theme via data-theme attribute)
```

---

## Data Pipeline

### manifest.json
Tracks which states are loaded and the YYYYMMDD version of each data file:
```json
{
  "supportedStates": ["TX"],
  "metricsVersions": { "TX": "20260523" },
  "geodataVersions": { "TX": "20260523" }
}
```

### npm scripts
- `npm run fetch-real-estate-data` — Downloads Zillow CSVs (ZHVI, ZORI, DOM), processes into per-state JSON files in `public/data/`, updates `manifest.json`
- `npm run fetch-geo-data` — Downloads ZIP code GeoJSON from OpenDataDE GitHub, saves to `public/data/geodata/`, updates `manifest.json`
- `npm run dev` — Starts Vite dev server on http://localhost:5173

### Data Sources (all Zillow Research public CSVs)
| Dataset | Variable | URL slug |
|---------|----------|----------|
| ZHVI | Home value, MoM/YoY/5yr growth | `zhvi/Zip_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv` |
| ZORI | Rent value, MoM/YoY/5yr growth | `zori/Zip_zori_uc_sfrcondomfr_sm_month.csv` |
| DOM | Home days on market | `mean_doz_pending/Zip_mean_doz_pending_uc_sfrcondo_sm_month.csv` |

### Auto-refresh on startup
On startup, `MapManager.initData()` reads `manifest.json`. If the data version is **≥ 7 days old**, the app shows a "Downloading latest data..." overlay and calls `/api/refresh-data` (a Vite dev server endpoint in `vite.config.ts`). On success it reloads the page.

---

## Metrics

| Metric key | Label (UI) | Source | Real Data? |
|---|---|---|---|
| `homeValue` | 🏠 Home Value | Zillow ZHVI | ✅ Real |
| `homeFiveYearGrowth` | 📈 Home Value Growth (5-Year) | Zillow ZHVI | ✅ Real |
| `homeYoyGrowth` | 📅 Home Value Growth (YoY) | Zillow ZHVI | ✅ Real |
| `homeMomGrowth` | 📆 Home Value Growth (MoM) | Zillow ZHVI | ✅ Real |
| `homeDaysOnMarket` | ⏱️ Days on Market | Zillow DOM | ✅ Real |
| `rentValue` | 💵 Monthly Rent | Zillow ZORI | ✅ Real |
| `rentFiveYearGrowth` | 📊 Rent Growth (5-Year) | Zillow ZORI | ✅ Real |
| `rentYoyGrowth` | 📅 Rent Growth (YoY) | Zillow ZORI | ✅ Real |
| `rentMomGrowth` | 📆 Rent Growth (MoM) | Zillow ZORI | ✅ Real |
| `rentDaysOnMarket` | ⏱️ Days on Market (Simulated) | Derived from `homeDaysOnMarket` | ⚠️ Simulated |

`rentDaysOnMarket` is simulated: clamped to 5–30 days, derived as `homeDaysOnMarket * 0.35 + noise` (or random 12–20 if no home DOM data exists).

---

## Color Scale (colors.ts)

- **Absolute metrics** (`homeValue`, `rentValue`): blue (min/0) → white (national avg) → red (max)
  - `rentValue` minimum is always clamped to `0`
- **Growth metrics**: symmetric diverging — blue (most negative) → white (0%) → red (most positive)
- **Days on Market**: white (0 days) → red (max days). Min is `0`.
- Scale bounds use **p5–p95 percentiles** to avoid outlier distortion.

---

## Theme

- Dark/light mode toggled via `data-theme` attribute on `<html>`.
- Persisted in `localStorage` under key `theme`.
- Map tiles swap between CartoDB dark/light variants.

---

## Key Conventions

- State codes are always uppercase 2-letter abbreviations (e.g., `TX`).
- Data file naming: `{state_lower}_metrics_{YYYYMMDD}.json` and `{state_lower}_geodata_{YYYYMMDD}.json`.
- Only the latest version per state is actively used (tracked via `manifest.json`). Old versioned files may accumulate in `public/data/` and can be cleaned up manually.
- GeoJSON ZIP property key: `ZCTA5CE10` or `ZCTA5CE20` (handled in `map.ts`).
