# Metrics, Colors & Conventions

## Metrics

| Metric key | Label (UI) | Source | Notes |
|---|---|---|---|
| `homeValue` | 🏠 Home Value | Zillow ZHVI | Real |
| `homeFiveYearGrowth` | 📈 Home Value Growth (5-Year) | Zillow ZHVI | Real |
| `homeYoyGrowth` | 📅 Home Value Growth (YoY) | Zillow ZHVI | Real |
| `homeMomGrowth` | 📆 Home Value Growth (MoM) | Zillow ZHVI | Real |
| `homeDaysOnMarket` | ⏱️ Days on Market | Zillow DOM | Real |
| `rentValue` | 💵 Monthly Rent | Zillow ZORI | Null at State/Country |
| `rentFiveYearGrowth` | 📊 Rent Growth (5-Year) | Zillow ZORI | Null at State/Country |
| `rentYoyGrowth` | 📅 Rent Growth (YoY) | Zillow ZORI | Null at State/Country |
| `rentMomGrowth` | 📆 Rent Growth (MoM) | Zillow ZORI | Null at State/Country |
| `rentDaysOnMarket` | ⏱️ Days on Market (Simulated) | Derived from `homeDaysOnMarket` | Simulated |

## Geographic Levels
- **State Selector**: Toggles active state (e.g. TX, WA). Loads metrics + geodata, flies map to state center.
- **Level Buttons**: `country` → `state` → `metro` → `county` → `zip`. Geodata cached on client.

## Color Scale (colors.ts)
- **Absolute** (`homeValue`, `rentValue`): blue (min) → white (national/rent avg) → red (max)
- **Growth metrics**: symmetric diverging — blue (most negative) → white (0%) → red (most positive)
- **Days on Market**: white (0 days) → red (max days)
- Bounds use **p5–p95 percentiles**. Single-region levels get synthetic ±20% range.

## Key Conventions
- State codes: uppercase 2-letter (e.g. `TX`).
- County FIPS = state FIPS + municipal FIPS (e.g. `'48' + '201' = '48201'`), matching GeoJSON `STATE + COUNTY`.
- Metros matched by cleaning CBSA GeoJSON `NAME` (removing " Metro Area" / " Micro Area") to match Zillow region names.
