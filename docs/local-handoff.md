# Local handoff — 4 October 2026

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
