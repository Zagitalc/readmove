# Local handoff — 3 October 2026

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
