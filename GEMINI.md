# Real Estate Researcher — Project Context

A Vite + TypeScript interactive choropleth map visualizing US real estate metrics (Zillow data) with Leaflet.js.

## Tech Stack
Vite + TypeScript, Leaflet.js, Vanilla CSS, Vitest + Happy DOM (unit), Playwright (E2E), Inter font, CartoDB tiles.

## Project Structure
```
real-estate-researcher/
├── index.html                  # Main HTML — sidebar metric options + map + level selector
├── vite.config.ts              # Vite config with custom /api/refresh-data endpoint
├── vitest.config.ts            # Vitest unit test config (happy-dom env)
├── playwright.config.ts        # Playwright E2E test config (5 browser projects)
├── public/data/                # manifest.json + {state}_metrics_{YYYYMMDD}.json + geodata/
├── scripts/
│   ├── fetch_real_estate_data.js   # Downloads Zillow CSVs → consolidated JSON per state
│   └── fetch_geo_data.js           # Downloads + filters geodata boundaries per state
├── tests/
│   └── app.spec.ts             # Playwright E2E tests (6 specs × 5 browsers = 30 tests)
└── src/
    ├── main.ts         # App entry: wires sidebar, map, level selector, search, legend, theme
    ├── map.ts          # MapManager: level/metric loading, color rendering, bounds, caching
    ├── colors.ts       # Color scale logic, MetricType and GeographicLevel definitions
    ├── legend.ts       # LegendManager: updates labels/title based on active metric
    ├── sidebar.ts      # SidebarManager: handles metric radio button selection
    ├── search.ts       # SearchManager: location search, flies map to result
    ├── tooltip.ts      # TooltipManager: hover tooltip formatting per geographic level
    ├── style.css       # All styles (dark/light theme, responsive, level selector)
    └── *.test.ts       # Unit tests: colors, legend, sidebar, tooltip (14 tests total)
```

## Key Commands
- `npm run dev` — Start Vite dev server
- `npm run test` — 14 unit tests (Vitest)
- `npm run test:e2e` — 30 E2E tests (Playwright, 5 browsers)
- `npm run fetch-real-estate-data` / `npm run fetch-geo-data` — Refresh data from Zillow

## Detailed Docs (read on demand)
- `docs/data-pipeline.md` — Data sources, manifest format, auto-refresh logic, file naming
- `docs/metrics-and-colors.md` — Metric keys, color scales, geographic levels, key conventions
- `docs/testing.md` — Test infrastructure, CI/CD workflows, E2E spec details
