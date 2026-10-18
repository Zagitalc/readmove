# Local handoff — 18 October 2026

## Stage 12: measured usability

Uncommitted on top of Stage 11. Added `scripts/measure/perf.ts` (`npm run measure`) and [docs/performance.md](performance.md) with live-site load numbers for desktop, fast and slow 4G phone profiles and a WebKit iPhone profile. Installed Playwright WebKit and added `@axe-core/playwright` (dev dependency, pinned). `playwright.config.ts` gains opt-in WebKit projects (`PW_WEBKIT=1`). New `tests/browser/a11y.spec.ts` scans every mode, panel and a fully expanded building panel.

Fixes it drove: darkened all muted greys below 4.5:1 contrast (`src/style.css`), `role="region"` on the place dock, and the status toast no longer intercepts map taps (found by WebKit on a short iPhone viewport).

Verification: 78 TypeScript tests, 3 Python tests and the build pass; all 46 browser tests pass in Chromium and in WebKit. Firefox could not be tested: Playwright's Firefox build will not start on this macOS. Physical iPhone/Android and screen readers are still to do.

No commit, push or deployment was performed.

## Stage 11: flood-zone context and nav fix

Uncommitted on top of Stage 10. The nav highlight now follows the open panel, so Sold prices is highlighted when open and Schools no longer stays lit. New **Flood** mode and layer: Environment Agency Flood Zones 2 and 3 drawn beneath buildings with a legend and attribution, plus a lazy Flood zone context section in each building panel (centre and outline reported separately, "not within the mapped zones" never phrased as safe, link to the GOV.UK long-term flood risk check). `npm run data:flood` pages the EA OGC API (2,894 features), checksums each page, clips and simplifies (4 m) to `public/data/flood-zones.v1.json` (3 MB, ~0.6 MB gzipped, byte-identical offline rebuilds). Nothing loads until used.

Verification: 78 TypeScript tests, 3 Python tests and the build pass; all 42 desktop/mobile Playwright cases pass (installed Chrome), including the new Stage 11 flood and nav-highlight cases. Screenshots are under ignored `raw/stage-11-browser/`. The Thames/Kennet floodplains render where expected; Christchurch Meadows is Zone 3 and the town centre is outside the zones. Physical devices and other engines were not tested. The 3 MB asset is the largest on-demand download so far; measuring it on a phone is part of the usability stage.

No commit, push or deployment was performed.

## Stage 10: official schools

Stage 9 was merged to `main` and deployed; this work is uncommitted on the local `stage-8` checkout. `npm run data:schools -- --date 20261018` builds `public/data/schools.v1.json` (40 kB, 151 open DfE establishments) from the GIAS full CSV, with receipt/checksum caching under ignored `raw/schools/`, BNG→WGS84 conversion and byte-identical offline rebuilds. New **Schools** mode and layer: blue circle markers, a clickable-marker/keyboard list panel with search, phase filter, Show on map, official record and website links; and a Nearby schools section (five nearest within 1.5 km, straight-line) in each building panel. Nothing loads until used. No ratings, catchments or admission claims.

Verification: 70 TypeScript tests, 3 Python tests and the build pass; all 38 desktop/mobile Playwright cases pass (installed Chrome), including the new Stage 10 case. Screenshots are under ignored `raw/stage-10-browser/`. Physical devices and other engines were not tested.

Try Schools mode, search "rg1 5lw" and Show on map (Reading School), or open a building and expand Nearby schools. No commit, push or deployment was performed.

## Stage 9: official ONS neighbourhood context

Implemented locally on `codex/stage-8`, on top of the uncommitted Stage 8 changes. The fictional neighbourhood rectangles are gone. `npm run data:neighbourhoods` fetches 217 ONS December 2021 LSOAs (BGC V5) intersecting the map and their Census 2021 TS001/TS006 values, caches the responses with receipts under ignored `raw/neighbourhood/`, and writes `public/data/neighbourhoods.v1.json` (225 kB, ~50 kB gzipped). The Neighbourhood mode and layer show fixed density classes with a legend and ONS attribution. Each building panel has a collapsed Neighbourhood statistics section naming the containing LSOA, its usual residents and residents per km². Both load the asset only on demand.

Verification: 62 TypeScript tests, 3 Python tests and production build pass. All 36 desktop/mobile Playwright cases pass with installed Chrome, including the new Stage 9 case; one existing sources-dialog assertion was updated from the removed “not official LSOAs” text. Screenshots are under ignored `raw/stage-9-browser/captures/`. Offline rebuilds are byte-identical. Existing bundle-size and vector-tile warnings remain. Physical devices and other browser engines were not tested. On a phone the short-lived mode notice briefly overlaps the top of the legend, as it did before.

Try Neighbourhood mode, then search “Town Hall” and open Neighbourhood statistics: Reading 019B, E01033415, 2,169 usual residents, 2,814 per km².

No commit, push or deployment was performed. Earlier sections below describe previous stages.

## Stage 8: comparable exploration

Implemented locally on `codex/stage-8`, branched from the clean local `stage-7` checkout. Active filter summaries and keyboard-accessible reset preserve selection and camera. Sorts cover complete results before pagination: date/price in discovery, plus distance for comparisons. Expandable exact-UPRN history is independent of comparison filters and explicitly partial. No new source data, valuation claims or extra panels.

Verification: 56 TypeScript tests, 3 Python tests and production build pass. All 34 desktop/mobile Playwright cases passed; after matching the sort menu to existing filter styles, the four Stage 8 cases passed again and the build passed again. Tests used fresh installed Chrome sessions on port 5174, not an existing user tab. Desktop/mobile filter screenshots were visually inspected and are retained under ignored `raw/stage-8-browser/`, alongside history captures. Existing bundle-size and vector-tile warnings remain. Physical devices and other browser engines were not tested.

Try RG1 4PF for sorting, reset and single-record history. For two same-UPRN transactions, search RG2 6BS, choose 15 Lanesborough Street and expand history. The two rows remain visible even with a comparison date filter in 2026. Same coordinates alone never establish history.

No commit, push or deployment was performed. Suggested commit: `Improve comparable sorting, filter reset and verified sale history`. Earlier sections below describe previous stages.

## Reviewed refresh delivery

The primary checkout was clean on `cloudflare-deployment` at `96d7fa4` before this work. Added a manual manifest-driven refresh, verified source acquisition/cache, streaming coordinate extraction, coverage/loss reporting and candidate-only output. No published assets, commits, pushes or deployments were changed by this work. See [data refresh](data-refresh.md).

Local verification: 52 TypeScript tests, 3 Python tests, production build, and two targeted desktop/mobile browser cases pass. The UI now reads lookup periods from source metadata. A full offline run reused the retained official sources and scanned all 41,676,575 OS rows. Its candidate is byte-identical to the published v2 asset: 246 identifiers/located transactions, 177 in bounds, 69 outside, no conflicts. The ignored report is `raw/refresh/reproduce-2026-10-04/report.json`. Download tests use mocked HTTP; this run made no national download. Existing bundle-size and vector-tile warnings remain.

The command deliberately keeps the audited 2025 transaction snapshot fixed. New release manifests need reviewed hashes and source evidence. Scheduling, automatic candidate promotion and Price Paid snapshot updates remain future work. Suggested commit: `Add reviewed property-location refresh and coverage reports`.

The following notes are historical; the stage-6 merge was subsequently completed and deployed through GitHub Actions.

## Historical stage-6 merge

The primary checkout is merging `codex/verified-sales` (`59c0b7b`) into `stage-6` (`9452c3e`). Conflicts were reconciled with the stage-6 controls, original coordinate audit and map attribution retained. Tests pass: 43 TypeScript, 2 Python, all 30 browser cases across the full run and corrected-assertion rerun; production build passes. The merge remains staged and uncommitted for review. Complete it with `git commit` when ready; do not start another merge.

The remaining sections describe the earlier feature-worktree delivery. Its raw downloads and captures were not copied into this checkout. See [current verification](verification.md) for merge-specific checks.

Starting checkout: clean detached HEAD at `02ae156` (stage 5 merge). No repository `AGENTS.md` was found. The actual local baseline was 6,325 sales and 100 August identifiers, with no coordinates or mapped-sale flow. The expected later cloud patch was absent. No changes were discarded; nothing has been committed, pushed or deployed. Mini Reading was not cloned or modified.

## Delivered

- Exact July/August release merging: 246 matched transactions, one identical overlap, no conflicts; per-match evidence retained. Ambiguous cases are excluded conservatively by the tested merger.
- Streamed official OS coordinate extraction: 246 located transactions, 177 in bounds, 69 outside; 245 distinct UPRNs. The unchanged price asset and historical identifier-only v1 stay separate from the current v2 asset.
- Verified sale points, keyboard/list selection and nearby comparisons. Search text and its filter clear on selection; intentional filters persist. Explicit measured fit, fixed close control and load/empty/error recovery.
- Source/ingestion documentation, meaningful merger/coordinate/runtime/browser regressions and an ordered future roadmap.

## Run and inspect

```sh
npm ci --include=dev
npm test
python3 -m unittest discover -s tests/unit -p 'test_*.py'
npm run build
npm run dev
```

In another terminal, run `npm run test:browser`. This machine used:

```sh
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' npm run test:browser
```

The installed Playwright browser revision was missing, so fresh sessions used installed Google Chrome, with software WebGL and desktop/Pixel 7 emulation. This did not use the user's existing tab. A narrower 375 × 667 phone viewport is also checked. Final checks: 40 TypeScript unit tests, 2 Python coordinate tests, 28 browser tests and the production build pass. See [verification](verification.md) for evidence, limitations and screenshot locations.

Manual route: Sold prices → RG1 4PF → Show mapped sale → change filters → Fit nearby sales → Back → Close. All types/category A/1 km produces five comparisons; flat/category A produces three. A date in 2026 produces an honest empty result, with Fit still showing the selection.

Review the working diff and the small versioned v2 asset. Full national inputs remain ignored under `raw/`; no download is needed to use the bundled app. [Reproduction](uprn-matching.md) uses fresh output files and checksum pins. [Roadmap](next-stage.md) remains documentation only.

Suggested commit message: `Add verified sale locations and fix nearby comparison flow`

## Integration with stage-6

Reconciled the existing stage-6 coordinate implementation with the expanded lookup and browser-flow work. The original 100-coordinate audit and extractor, coordinate validation and map attribution are retained. The app uses one current renderer/schema path, with optional map points (off by default), an in-map-only filter, grouped co-located sales, exact date filtering, query clearing and explicit fit. The original relative transaction-age selector is superseded by the explicit “Sold on or after” date filter. Earlier verification above describes the pre-merge work; merge-specific checks are recorded in the handoff.
