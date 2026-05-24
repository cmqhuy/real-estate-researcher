# Testing Infrastructure

## Unit Tests (Vitest + Happy DOM)
Run with `npm run test`. Tests are co-located in `src/` next to their modules:
- **colors.test.ts** — Color scale mapping, diverging scales, percentile boundaries (5 tests)
- **tooltip.test.ts** — Adaptive tooltip headers and value formatting per level (3 tests)
- **sidebar.test.ts** — Metric radio selection events and callback firing (2 tests)
- **legend.test.ts** — Legend DOM element updates for title, min/mid/max labels (4 tests)

## E2E Tests (Playwright)
Run with `npm run test:e2e`. Specs live in `tests/app.spec.ts` and run across 5 browser projects: Chromium, Firefox, WebKit, Mobile Chrome (Pixel 5), Mobile Safari (iPhone 12).
- **App load** — Title, map container, search box, level selector, legend visible
- **Metric switching** — Sidebar selection updates legend title; on mobile, opens drawer first
- **Level switching** — Geographic level buttons toggle active state
- **State switching** — State selector changes state value
- **Search** — Typing shows search suggestions
- **Mobile drawer** — Menu toggle opens/closes sidebar drawer; metric selection auto-closes drawer

## CI/CD Workflows

### Daily CI (`.github/workflows/daily-ci.yml`)
- **Triggers**: Daily at midnight UTC, every push to `main`, every PR to `main`, manual
- **Steps**: Install deps → unit tests → install Playwright browsers → E2E tests
- **Purpose**: Catch breakages early (tests only, no data fetch or deploy)

### Weekly Data Update (`.github/workflows/weekly-data-update.yml`)
- **Triggers**: Every Sunday at midnight UTC, manual
- **Steps**: Install deps → fetch Zillow data → unit tests → E2E tests → commit data → build → deploy to `gh-pages`
- **Purpose**: Refresh data and deploy. If any test fails, the pipeline terminates and the broken build is **not** deployed.
