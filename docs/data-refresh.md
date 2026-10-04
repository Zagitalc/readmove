# Reviewed property-location refresh

Run a refresh manually; no schedule, credentials, deployment or Git mutation is
involved. This first refresh command updates official identifier/coordinate
candidates against the **fixed, reviewed 2025 transaction snapshot**. Updating
Price Paid transactions, corrections/deletions or the annual scope is a separate
review using the existing Price Paid importer. This command does not claim to
refresh that transaction history.

## Run

```sh
npm run data:refresh -- --manifest config/property-refresh.json --run review-2026-10-04
```

Use a new run name each time. The checked-in manifest reproduces the reviewed
July/August lookups and September OS release; it does not mean “latest”. Local
files named by `localFile` are rehashed before use. Missing files are downloaded
from the selected official URLs, streamed to ignored `raw/refresh-cache/`, and
accepted only when both length and SHA-256 match. HTTP errors, changed bytes,
malformed CSV, mismatched row counts, snapshot dates or CSV checksums abort.
Cached downloads retain their original retrieval date and response Last-Modified.
Reused local files retain the reviewed manifest's original retrieval metadata;
the report distinguishes local reuse, cache reuse and a new download.

If sources are in another checkout:

```sh
npm run data:refresh -- --manifest config/property-refresh.json --run offline-review --source-root /path/to/checkout --offline
```

`--source-root` resolves only local raw source paths. Sales, baseline, cache and
outputs belong to the checkout running the command. `--offline` forbids network
fallback. The national ZIP is retained but its CSV is streamed, never extracted
to disk. Scanning tens of millions of rows can take several minutes.

## Review output

`raw/refresh/<run>/` contains:

- `manifest.json`: exact reviewed input plan.
- `identifiers.json`: exact-ID merged mappings, all evidence and ambiguous cases.
- `coordinates.json`: streaming extraction audit, CSV/archive hashes and conflicts.
- `report.json`: before/after counts, added/lost/changed identifiers and in-map
  sales, changed coordinates, omitted sources, ambiguity and acquisition evidence.
- `sale-locations.v2.json`: validated candidate, bound to the exact sales SHA-256.
- `COMPLETE.json`: completion marker and candidate checksum.

A failed run has `FAILED.json` and no completion marker. Intermediate diagnostic
files may remain; never publish from an incomplete run. Existing run folders are
refused. The command never writes into `public/`, commits, pushes or deploys.
Coverage losses, ambiguity and dropped releases are reported for explicit review,
not silently accepted as improvements. Conflicts remain excluded even when a
later release supplies one of the conflicting mappings.

## Select another release

Copy/edit the manifest deliberately. For each official lookup supply its URL,
release period, independently reviewed SHA-256, byte length, row count,
attribution and original retrieval evidence if reusing a local file. Retain prior
lookup releases when accumulating coverage; these monthly files are **not** a
complete historical archive. Duplicate releases are rejected. A 403 is an access
result, not proof of dataset nonexistence.

For OS supply archive SHA-256/length, exact CSV member, CSV SHA-256/row count,
release period, extraction snapshot date from `versions.txt`, and attribution.
The OS current-download URL can advance: a mismatch requires source review and a
new manifest, never automatic acceptance of a new hash. Keep large national files
out of Git. `localFile` may be omitted for a fresh source; its download receipt
will record actual retrieval evidence.

## Publish after review

Inspect the report, conflicts, provenance and candidate checksum. Once approved,
replace the tracked `public/data/sale-locations.v2.json` with the candidate in a
review branch, together with its manifest/documentation. Retain the old asset in
Git history. Do not replace transaction data or invent positions for missing
coordinates. Run unit/Python tests, build/dry run and browser checks, then submit
a PR. The existing main-only CI deployment publishes only after checks pass.
There is deliberately no automatic candidate promotion or scheduled refresh yet.

Tests use small synthetic source files solely as development fixtures, never as
published observations. Download error/recovery tests use mocked HTTP responses.
