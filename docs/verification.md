# Local verification — 3 October 2026

## Actual baseline

Inspected the repository and Git state first: clean detached HEAD at `02ae156`. No repository `AGENTS.md` was found. Locally, stage 5 had 6,325 transactions and 100 August identifiers, **zero coordinates**, and no mapped-sale selection/comparisons. The later cloud state was absent.

The unchanged baseline independently passed **35 Vitest tests**, the TypeScript/Vite build and **20 Playwright cases**. In fresh desktop/mobile browser sessions, RG1 4PF returned one transaction and zero mapped-selection buttons, so the reported cloud query-retention bug could not be reproduced in this earlier local version. Baseline screenshots remain at `raw/baseline-desktop.png` and `raw/baseline-mobile.png`.

## Final checks

Environment: macOS, Node 24.19.0, npm 11.17.0, Python 3.13.0. Lockfile dependencies installed with `npm ci --include=dev`. Playwright's expected bundled browser revision was absent; all successful browser runs used fresh installed Google Chrome sessions via `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`, software WebGL, desktop 1440 × 1000 and Pixel 7 emulation. The user's existing tab was not used.

- **40 TypeScript unit tests pass** (`npm test`). New checks cover cross-release identical-pair deduplication, order independence, conflicts within/across releases, preservation of every evidence hash, exact IDs, invalid provenance/coordinates, asset binding/counts, query reset and intentional comparison filters.
- **2 Python coordinate tests pass** (`python3 -m unittest discover -s tests/unit -p 'test_*.py'`). They cover duplicate/conflicting points, longitude/latitude order, invalid UPRNs, nonfinite/out-of-range values, malformed rows and validation even of unrequested records.
- **TypeScript and production Vite build pass.** The existing large-chunk warning remains: entry JavaScript about 1,633 kB minified / 429 kB gzip.
- **28 Playwright cases pass**, final complete run in 2.9 minutes. Includes previous map/3D/picking/streaming/error flows, official search and source/hash-load recovery, and eight new desktop/mobile cases.
- **`git diff --check` passes.** Original transaction asset, v1 identifier asset, map bounds and lockfile are unchanged. National sources and test outputs remain ignored. No commit, push, deployment or reference-app modification.

## Browser findings and repairs

The implemented flow now clears both address-query state and input before comparison calculation; nearby results also exclude discovery text by design. RG1 4PF yields five category-A comparisons within 1 km, or three with the flat filter. Type/category/radius/date persist through list/marker selection and Back. Selected sale provenance correctly identifies its in-bounds coordinate and leaves building identity unverified.

The mobile close button stays in fixed panel chrome while content scrolls. Keyboard tests exercise Enter for both list and marker selection, Back-to-search focus, Close/Escape focus restoration, loading closure and delayed completion, empty filters, and absence of horizontal overflow. Runtime price errors retain the map; failed/mismatched location data leaves address search working and retries on reopen.

Measured fit initially exposed a real MapLibre constraint: whole-canvas max bounds prevented fitting into the smaller unobscured rectangle. Fit now temporarily relaxes camera limits, restoring them on exit without changing data coverage. Short phones have a smaller sheet to retain useful map space. Tests check **every marker centre** against the panel/navigation/control margins, including a **375 × 667** phone, a 5 km radius with more results than the first page, and an empty-comparison/single-point fit. Filter changes leave the camera unchanged.

During iteration, two old data/test expectations were corrected, and one run was interrupted by Vite reloading a final source edit. The final 28-case run used frozen source and passed without retries.

## Source verification

Both HMLR hashes match the supplied pins. July: 94,112 rows, 147 matches. August: 84,149 rows, 100 matches. Combined: 246 transactions / 245 UPRNs; one identical overlap, zero conflicts, 6,079 unmatched. All 246 transactions have OS coordinates; **177 in bounds (176 distinct points)** and **69 outside**. August-only recomputation confirms 65 in bounds.

The OS archive's MD5 matches its official metadata. Archive and uncompressed-member SHA-256 values are retained in the asset and [source audit](uprn-matching.md). All 41,676,575 CSV rows were streamed and validated. `versions.txt` establishes extraction **14 August 2026**, separately from the **September 2026 release** and **3 October retrieval**.

A separate Python CSV/ZIP audit independently compared every published transaction/UPRN pair and all 245 coordinate records with the raw sources: zero mismatches. Repeated coordinate extraction is byte-identical; regeneration of the final v2 asset is byte-identical. The 619 MB ZIP stays in ignored `raw/`; the 2.27 GB CSV was never extracted to disk.

## Screenshots and limits

Desktop/mobile fit and filter screenshots were captured; fit screenshots were visually inspected. Durable local copies (ignored) are `raw/screenshots/desktop-fit.png`, `mobile-fit.png`, `desktop-filters.png`, and `mobile-filters.png`. The browser suite also writes its captures to `test-results/`.

Coverage is sparse and partial, not a historical archive or valuation dataset. No sale is assigned a postcode centroid or arbitrary OSM building. Coordinate observations, illustrative building rendering and fictional examples remain separate. Physical phones, Safari, Firefox, unusual landscape sizes and GPU/thermal performance are not verified. Existing vector-tile-spec and bundle-size warnings remain. No deployment check or deployment was run during this local task.
