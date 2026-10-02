# Historic sold-price ingestion foundations

This stage provides a **local data pipeline**, not a live sale feed. No actual Land Registry records or official geographic matches are shipped or automatically published. The browser's sale examples remain fictional.

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

The current UI exposes distance, type and age filters on the fictional example only, using its visible fixed as-of date. Official import output stays in `raw/` until a subsequent publication/indexing step is implemented and audited. This avoids accidentally presenting test/import files as verified map observations.

## Next data milestone

1. Import a real publisher release and report candidate counts, corrections, deletions and missing postcodes.
2. Review actual HMLR/OS identifier availability and licences; retain unmatched historical addresses.
3. Audit coordinate-match coverage and samples, including flats and multi-dwelling footprints.
4. Build a bounded versioned sale index or D1 query only if persistent query needs justify it.
5. Connect the real-data panel with per-record dates, provenance, licence acknowledgement and match confidence.
6. Add type/tenure/recency controls, stale-date warnings and comparable tests against the audited data.
