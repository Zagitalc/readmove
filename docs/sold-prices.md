# Official sold prices — implemented

The app now bundles **6,325 residential transaction records** from the official 2025 annual Price Paid Data file, in 12 Reading-area postcode districts. Open **Sold prices** to search addresses/postcodes, filter residential type and standard/additional category, and read dates, tenure, source and attribution. Optional verified sale points and nearby-sale filters are now available for 65 in-map transactions; the existing map example prices remain separately labelled fictional.

Downloaded on **3 October 2026** directly from `https://price-paid-data.publicdata.landregistry.gov.uk/pp-2025.csv`, linked by the [official yearly page](https://www.gov.uk/government/statistical-data-sets/price-paid-data-yearly-file). Source date **28 September 2026** is the publisher file's HTTP Last-Modified date (`Mon, 28 Sep 2026 05:12:18 GMT`), not the yearly web page's later edit date or a transaction date. The original file has 169,648,191 bytes and SHA-256 `83540b18086e5748116c744d9e930ad210cafcbb01a5d7d41fcbd2464ba0b5fd`.

Audit: 974,087 national input rows, all action A; 2,451 have missing postcodes. The candidate extraction retains 6,593 transactions; 268 type Other records are excluded from the residential display, leaving 6,325. All 6,593 are unlocated: **zero verified coordinate/building links**. The retained date range is 2 January–23 December 2025. These are transaction counts, not unique homes, complete history or market-wide totals. Postcode districts extend outside the map box.

Every retained price, date and postcode was independently compared with the original CSV using Python's CSV parser; all agree and there are no duplicate retained transaction IDs. `public/data/sales-2025.audit.json` retains the source receipt and national/candidate audit. `public/data/sales-2025.v1.json` contains only the compact residential display data; the national CSV stays ignored in `raw/`.

## Reproduce the reviewed regional asset

```sh
npm run data:sales:official -- \
  --url https://price-paid-data.publicdata.landregistry.gov.uk/pp-2025.csv \
  --kind annual --year 2025 --source-date 2026-09-28 \
  --output raw/official-2025-2026-09-28
npm run data:sales:prepare -- \
  raw/official-2025-2026-09-28 raw/rebuilt-sales-2025.json
```

Use an existing retained raw directory if already downloaded. Outputs refuse overwriting. The live yearly URL can change: the preparation script pins the reviewed SHA-256, re-parses the original CSV and compares all records/audit fields before generating an asset. A newer file requires a fresh audit, actual source date, updated pin and new versioned asset path. Do not change a checksum merely to pass validation. Preparation writes a local file; it never deploys or modifies the public site.

The UI loads the bundled asset only when Sold prices opens, validates it, renders 20 records at a time and retries failed loads on reopening. It makes no national API requests, moves no camera and adds no pins. Spatial comparisons still require reviewed identity matching.

## Download from the publisher

Start with [HM Land Registry Price Paid downloads](https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads) and [About Price Paid Data](https://www.gov.uk/about-the-price-paid-data). Choose an annual CSV for a manageable, explicitly partial first history; the complete CSV is much larger. Use the **publisher release/update date**, not the sale year or today's date. Check the current OGL and address-data conditions on those pages before redistribution; the address fields have additional conditions and are not a general-purpose address product.

Requires Node 24+, installed dependencies and `curl` on PATH. From the repository root:

```sh
npm run data:sales:official -- --help
npm run data:sales:official -- \
  --url 'PASTE_OFFICIAL_HTTPS_CSV_URL' \
  --kind annual --year YYYY \
  --source-date YYYY-MM-DD \
  --output raw/official-first-release
```

The uppercase tokens are placeholders, **not a known release**. This importer supports HTTPS CSVs on `price-paid-data.publicdata.landregistry.gov.uk`, with filenames `pp-YYYY.csv`, `pp-complete.csv`, and `pp-monthly-update-new-version.csv`. If the publisher offers a different host/path, inspect the official link and update the explicit allowlist deliberately; do not silently substitute a mirror. There are no commercial listings or scraped portals.

The command downloads once at build/data-preparation time. It validates TLS, rejects redirects and non-200 responses, streams and validates the CSV, then promotes a temporary directory only after the entire import succeeds. Failed downloads/parses remove temporary files. Existing outputs are refused. All outputs must stay under ignored `raw/`, away from public assets and Git:

- `source.csv`: unmodified national publisher file; potentially large.
- `sales.json`: retained postcode candidates, transaction records and documented matches.
- `receipt.json`: exact URL, operator-supplied publisher date, UTC retrieval time, byte count, SHA-256, scope, original baseline and attribution.
- `audit.json`: input A/C/D counts, missing/other postcode rows, retained candidate counts, documented in/out-of-map matches, unmatched count, observed sale-date range, property types and PPD categories.

Input counts describe **rows/actions**, not unique properties or regional market volume. Missing postcode counts are national input counts. Deletion rows have no required address, so they are counted separately. `removedExistingRecords` counts removals of retained candidates by deletion or an out-of-region correction. A file checksum identifies bytes, not a publisher signature. HTTPS origin and operator review supply the source evidence. The existing `quality: mapped` provenance value denotes non-fixture source data; it does **not** establish geographic location. Only explicit entries in `matches` do that.

Monthly updates require a previously downloaded baseline:

```sh
npm run data:sales:official -- \
  --url 'PASTE_OFFICIAL_MONTHLY_HTTPS_CSV_URL' \
  --kind monthly --source-date YYYY-MM-DD \
  --previous raw/official-first-release \
  --output raw/official-next-release
```

A monthly file is registrations, corrections and deletions across sale dates, **not all sales in a calendar month**. An annual baseline followed by updates remains partial history. Preserve earlier directories and apply each release in chronological order; the command cannot prove that no release was skipped. Unchanged file bytes, mismatched receipts and out-of-order dates are rejected. Re-download a new annual/complete snapshot into a fresh dataset when rebuilding; do not merge full snapshots as monthly updates. Optional `--links` uses the documented matching contract below.

## Matching and source availability

The previous HTTP 403 restriction is resolved for GOV.UK and the Price Paid host. Their terms and schema pages were read successfully. The direct National Archives OGL page still returned HTTP 403 in this environment; the publisher's pages explicitly provide the OGL v3.0 permission, acknowledgement and additional address-data conditions. The intended display is residential property price information, one of the publisher's expressly permitted address uses. Do not repurpose the address data as a general-purpose directory.

The [official transaction-to-UPRN lookup page](https://www.gov.uk/government/statistical-data-sets/transaction-unique-identifier-and-uprn-look-up-table-dataset) also describes a free monthly lookup under OGL v3.0, with additional OS attribution. Its currently linked file is August 2026. Stage 5 joins this release by exact transaction UUID: 100 of the 6,325 residential transactions match. See [the UPRN audit](uprn-matching.md). Stage 6 adds verified OS coordinates for all 100 matches, including 65 inside the map; see [sale-coordinates.md](sale-coordinates.md). A monthly lookup must not be assumed to cover historical sales. Coordinate enrichment through OS Open UPRN and reviewed building identity is the next stage; preserve unmatched records and dwelling/building distinctions.

---

# Local CSV importer and matching contracts

The local importer supports other legitimate releases. The reviewed 2025 residential subset is bundled separately; there is no live feed or automatic publication. Map examples remain fictional.

## Import a legitimate Price Paid CSV

Obtain the relevant complete/yearly/monthly data from the official [Price Paid downloads](https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads). Preserve the publisher's release date and current licence/attribution. CSV parsing cannot authenticate a file's origin.

```sh
npm run data:sales -- \
  --input raw/ppd.csv \
  --output raw/sales-2026-09.json \
  --source-date 2026-09-01
```

`raw/` is ignored. The importer streams the standard 16-column CSV (quoted commas and BOM supported), validates every row before writing output, and creates a SHA-256 record of the input. Invalid data aborts the import; no partially written snapshot is published. The output is written via a temporary file and renamed only on success. Use a new output filename to preserve prior versions.

Candidate postcode districts live in `REGION.ppdOutcodes`. They intentionally cover the surrounding area and are **not exact map coverage**. A postcode is not used as a building coordinate. Transactions outside those postcode districts, or with missing postcodes, cannot be selected by this candidate extraction. Expanding regional scope requires rebuilding the snapshot.

Each record retains transaction ID, price, date, type, tenure, new-build flag, PPD category, structured address and provenance. Transactions do not receive an invented property ID, UPRN or building ID. Do not infer property size, valuation, occupant details or ownership profiles from these records.

## Apply monthly corrections and deletions

```sh
npm run data:sales -- \
  --input raw/ppd-monthly.csv \
  --previous raw/sales-2026-09.json \
  --output raw/sales-2026-10.json \
  --source-date 2026-10-01
```

Actions `A` and `C` upsert by transaction ID; `D` removes that transaction and its obsolete geographic link. A correction moving outside the candidate postcode set removes the previous candidate. An address change invalidates an old coordinate link unless explicitly supplied matching evidence has a sufficiently recent review date. A price-only correction can preserve its geographic link.

Apply source releases in chronological order. Out-of-order changes are rejected. Reapplying the exact same input digest is idempotent and cannot roll a later snapshot back. Retain the input history; this is not a national-scale database or an event-history service.

## Supply documented location matches

Pass `--links raw/links.json` only when you have suitable official lookup data or reviewed address matches. A match document is an array like:

```json
[
  {
    "transactionId": "{00000000-0000-0000-0000-000000000001}",
    "propertyRef": "your-stable-property-reference",
    "uprn": "100000001",
    "position": [-0.9718, 51.4589],
    "method": "official-uprn-lookup",
    "evidenceUrl": "https://example.org/replace-with-real-evidence",
    "matchedOn": "2026-10-01"
  }
]
```

**This example is a schema illustration, not a real transaction, UPRN or match.** Do not load it as observations. `official-uprn-lookup` requires a UPRN; `reviewed-address-match` can omit it. Both require an HTTPS evidence reference and review date. The importer validates structure and coordinate bounds, not the truth of supplied evidence. Audit matches independently before publishing.

Duplicate transaction links are rejected. Links for deleted/non-retained transactions are dropped. Valid coordinates outside the map are retained separately in `outsideCoverage`; unlocated candidates remain explicit in `unmatchedCount`. The `matches` array contains only documented in-box coordinates. Passing a links file replaces the full set of matches, so include links you want to preserve. The same source file can be reprocessed with a new links file without reapplying its transaction changes.

There is deliberately no nearest-building or postcode-centroid assignment. Connecting an official UPRN point to a particular OSM footprint is a later, separately reviewed identity task. Multiple dwellings can share one building.

## Comparable engine

`src/property/comparables.ts` accepts located transactions and filters by straight-line distance, type, calendar-month age and optional inclusive price range. It excludes the selected property, future sales, invalid coordinates and fixture/real-data mixing; ordering is deterministic by distance, date and ID. No sale-price adjustment, floor-area estimation or valuation model is present.

The current UI exposes distance, type and age filters on the fictional example only, using its visible fixed as-of date. Official import output stays in `raw/`; only the explicitly reviewed residential asset is bundled for address search. This avoids accidentally presenting test/import files as verified map observations.

## Next data milestone

1. Refresh the reviewed annual snapshot deliberately and add further years only with explicit coverage and versioning.
2. Review actual HMLR/OS identifier availability and licences; retain unmatched historical addresses.
3. Audit coordinate-match coverage and samples, including flats and multi-dwelling footprints.
4. Build a bounded versioned sale index or D1 query only if persistent query needs justify it.
5. Extend the existing real-data panel with matched locations once identity checks pass.
6. Add type/tenure/recency controls, stale-date warnings and comparable tests against the audited data.
