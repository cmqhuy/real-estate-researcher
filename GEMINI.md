# Real Estate Researcher — Project Context

A Vite + TypeScript interactive map for visualizing US real estate metrics by geographic levels. Data is sourced from Zillow Research and displayed as a choropleth map using Leaflet.js.

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
├── index.html                  # Main HTML — sidebar metric options + map + level selector
├── vite.config.ts              # Vite config with custom /api/refresh-data endpoint
├── tsconfig.json
├── package.json
├── public/
│   ├── data/
│   │   ├── manifest.json                               # Tracks supported states + metrics & geodata versions
│   │   ├── {state}_metrics_{YYYYMMDD}.json             # Zillow metrics per level (zip, county, metro, state, country)
│   │   └── geodata/
│   │       ├── {state}_zip_geodata_{YYYYMMDD}.json     # GeoJSON ZIP code boundaries
│   │       ├── {state}_county_geodata_{YYYYMMDD}.json  # GeoJSON County boundaries
│   │       ├── {state}_metro_geodata_{YYYYMMDD}.json   # GeoJSON Metro/CBSA boundaries
│   │       ├── {state}_state_geodata_{YYYYMMDD}.json   # GeoJSON State outline boundaries
│   │       └── {state}_country_geodata_{YYYYMMDD}.json # GeoJSON National US state boundaries
│   ├── favicon.svg
│   └── icons.svg
├── scripts/
│   ├── fetch_real_estate_data.js   # Downloads multi-level Zillow CSVs, outputs consolidated JSON
│   └── fetch_geo_data.js           # Downloads and filters geodata boundaries per supported state
└── src/
    ├── main.ts         # App entry: wires sidebar, map, level selector, search, legend, theme
    ├── map.ts          # MapManager: level/metric loading, color rendering, bounds calculation
    ├── colors.ts       # Color scale logic, MetricType and GeographicLevel definitions
    ├── legend.ts       # LegendManager: updates labels/title based on active metric
    ├── sidebar.ts      # SidebarManager: handles metric radio button selection
    ├── search.ts       # SearchManager: location search, flies map to result
    ├── tooltip.ts      # TooltipManager: hover tooltip formatting for each geographic level
    └── style.css       # All styles (dark/light theme, level selector layouts)
```

---

## Data Pipeline

### manifest.json
Tracks supported states and YYYYMMDD versions of metrics and geodata:
```json
{
  "supportedStates": ["TX", "WA"],
  "metricsVersions": {
    "TX": "20260523",
    "WA": "20260523"
  },
  "geodataVersions": {
    "TX": "20260523",
    "WA": "20260523"
  }
}
```

### npm scripts
- `npm run fetch-real-estate-data` — Downloads Zillow CSVs (ZHVI, ZORI, DOM) for all levels, processes into a consolidated per-state metrics JSON in `public/data/`, and updates `manifest.json`.
- `npm run fetch-geo-data` — Downloads national boundaries for states, counties, and metros, filters them down to supported states, saves them as level-specific JSON files in `public/data/geodata/`, and updates `manifest.json`.
- `npm run dev` — Starts Vite dev server.

### Data Sources
Zillow CSV datasets are queried at State, Metro, County, and Zip levels:
- **ZHVI** (Home Value, Growth): `https://files.zillowstatic.com/research/public_csvs/zhvi/{Level}_zhvi_uc_sfrcondo_tier_0.33_0.67_sm_sa_month.csv`
- **ZORI** (Rent, Rent Growth): `https://files.zillowstatic.com/research/public_csvs/zori/{Level}_zori_uc_sfrcondomfr_sm_month.csv` (Note: State ZORI is unavailable and falls back to null).
- **DOM** (Days on Market): `https://files.zillowstatic.com/research/public_csvs/mean_doz_pending/{Level}_mean_doz_pending_uc_sfrcondo_sm_month.csv`

### Auto-refresh on startup
On startup, `MapManager` compares the local time with the timestamps inside `manifest.json`:
- **Metrics** are auto-refreshed if the metrics data version is **≥ 7 days old**.
- **Geodata** is auto-refreshed if the geodata version is **≥ 30 days old**.
If either is outdated, the app shows a downloading overlay, calls the `/api/refresh-data` dev server endpoint, and reloads on success.

---

## Geographic Levels & State Switching

The top controls bar contains two main pill components to filter the map view:
1. **State Selector**: Toggles the active state (e.g. `Texas (TX)` or `Washington (WA)`). Switching the state loads the chosen state's Zillow metrics and active level's boundary geodata (using client cache if available), and flies the map view to the center of the selected state.
2. **Geographic Level Buttons**: Switches the active visualization level:
   - `country` (United States): Displays all US states colored by their state metrics (for national context).
   - `state` (State): Displays the supported state as a single boundary.
   - `metro` (Metropolitan Area): Displays CBSA boundaries in the state.
   - `county` (County): Displays county boundaries in the state.
   - `zip` (ZIP Code): Displays ZIP code boundaries in the state.

Geodata is loaded dynamically and cached on the client to avoid redundant network requests.

---

## Metrics

| Metric key | Label (UI) | Source | Real Data? |
|---|---|---|---|
| `homeValue` | 🏠 Home Value | Zillow ZHVI | ✅ Real |
| `homeFiveYearGrowth` | 📈 Home Value Growth (5-Year) | Zillow ZHVI | ✅ Real |
| `homeYoyGrowth` | 📅 Home Value Growth (YoY) | Zillow ZHVI | ✅ Real |
| `homeMomGrowth` | 📆 Home Value Growth (MoM) | Zillow ZHVI | ✅ Real |
| `homeDaysOnMarket` | ⏱️ Days on Market | Zillow DOM | ✅ Real |
| `rentValue` | 💵 Monthly Rent | Zillow ZORI | ✅ Real (Zip/County/Metro) / ⚠️ Null at State/Country |
| `rentFiveYearGrowth` | 📊 Rent Growth (5-Year) | Zillow ZORI | ✅ Real (Zip/County/Metro) / ⚠️ Null at State/Country |
| `rentYoyGrowth` | 📅 Rent Growth (YoY) | Zillow ZORI | ✅ Real (Zip/County/Metro) / ⚠️ Null at State/Country |
| `rentMomGrowth` | 📆 Rent Growth (MoM) | Zillow ZORI | ✅ Real (Zip/County/Metro) / ⚠️ Null at State/Country |
| `rentDaysOnMarket` | ⏱️ Days on Market (Simulated) | Derived from `homeDaysOnMarket` | ⚠️ Simulated |

---

## Color Scale (colors.ts)

- **Absolute metrics** (`homeValue`, `rentValue`): blue (min/0) → white (national/rent avg) → red (max)
- **Growth metrics**: symmetric diverging — blue (most negative) → white (0%) → red (most positive)
- **Days on Market**: white (0 days) → red (max days)
- Scale bounds use **p5–p95 percentiles** to avoid outlier distortion. If the scale collapses (e.g. state level containing only one region), a synthetic +/- 20% range is created around the single data point.

---

## Key Conventions

- State codes are uppercase 2-letter abbreviations (e.g. `TX`).
- File naming: `{state_lower}_{level}_geodata_{YYYYMMDD}.json` and `{state_lower}_metrics_{YYYYMMDD}.json`.
- State name mapping matches Zillow full names to state codes (e.g. `"Texas"` -> `"TX"`).
- County FIPS codes are created by combining state FIPS and municipal FIPS codes (e.g., `'48' + '201' = '48201'`), which match the county GeoJSON properties (`STATE + COUNTY`).
- Metros are matched by cleaning `NAME` properties in CBSA GeoJSON (removing " Metro Area" / " Micro Area") to match Zillow's region names.
