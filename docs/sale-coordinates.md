# Historical stage-6 coordinate audit

This document records the original August-only coordinate work. The active asset now combines July and August (246 transactions, 177 in bounds). See [current ingestion and UI behaviour](uprn-matching.md). The original script and 100-row audit are preserved; its coordinates are tested against the expanded asset. Historical UI controls/counts below describe the earlier version.

# Verified sale points — stage 6

The app now has official OS Open UPRN coordinates for all **100** matched transactions. **65** points fall inside the configured map bounds and **35** outside. The remaining **6,225** residential transactions have no UPRN join in the imported monthly lookup and remain searchable by address.

## Try it

1. Open Sold prices and enable **Show verified sale points**. The default Standard (A) filter displays 51 points.
2. Choose Both categories to see all 65 in-bounds sale points. Property type and address filters also affect the points.
3. Tick **Only with a location inside this map**, then select **View location & nearby sales** on a record. The first standard transaction is 4 Gleneagles Court, Muirfield Close, £195,000, 18 December 2025.
4. Its default 1,000 m / 24 month comparison contains four other standard transactions as of 3 October 2026, approximately 523, 526, 867 and 971 metres away. Narrow the radius to 250 m to see an honest empty result.
5. Click or keyboard-activate another map point to inspect that sale. Back to all sales clears the comparison; closing the panel removes the points.

Points are **off by default**. They identify official UPRN locations, not OSM buildings, entrances, garden boundaries or surveyed parcel geometry. No nearest-building assignment is performed. Out-of-map coordinates do not cause the map to pan beyond its bounds. Other transactions at the same UPRN are excluded from nearby comparisons; address/type/category filters remain active. Co-located points are grouped and cycle on activation. The current 65 mapped points have distinct coordinates.

This is a sparse joined sample, not the complete local market, a formal comparable-property selection or a valuation. Map point labels round prices to the nearest £1,000; the panel shows the full recorded price. Dates and types are publisher fields. Distance is straight-line, and transaction-age filtering uses the visible as-of date. Coordinates reflect the OS snapshot, not a reconstruction at each sale date.

## Source and verification

Official metadata: `https://api.os.uk/downloads/v1/products/OpenUPRN/downloads`

- Product: OS Open UPRN, September 2026 CSV release.
- Archive: `osopenuprn_202609_csv.zip`, **619,271,161 bytes**.
- Publisher MD5: `1d5c21d8166d6efd74850ec6f1ae77ab` — matched.
- Recorded SHA-256: `107503d45bedaab7f74511766eedbd617f9ca3592113363711e94f4b6458d55a`.
- `versions.txt` extraction date: **14 August 2026**. This differs from the September release label; both are preserved.
- Retrieved 3 October 2026 over verified HTTPS through the OS API's archive redirect.
- CSV: 41,676,575 rows; header `UPRN,X_COORDINATE,Y_COORDINATE,LATITUDE,LONGITUDE`.
- Exact coordinate matches: 100/100 requested UPRNs, zero missing, zero duplicate matched rows and zero conflicts.

The official API product metadata describes British National Grid and latitude/longitude geometries. The import uses the published angular columns in **longitude, latitude** order, with no datum transformation or postcode substitution. National Grid eastings/northings are retained only in the audit for inspection. No survey-grade accuracy or exact building association is asserted. The separate technical-documentation host was unavailable in this environment; the archive schema, version/notice files and API metadata were inspected directly.

Contains Ordnance Survey data © Crown copyright and database right 2026.

The archive's `licence.txt` points to `http://os.uk/opendata/licence`; retain that notice and the applicable OS OpenData terms. The official product page identifies OS Open UPRN as free to use. HMLR, UPRN-lookup and Price Paid address attributions/conditions still apply; see THIRD_PARTY_NOTICES.md. No paid API or new account is needed to run the bundled app.

`public/data/sale-locations.v2.json` is bound to the exact sale asset checksum and retains coordinate source metadata. `public/data/sale-coordinates.audit.json` records extraction counts and the 100 matched CSV coordinate rows. The previous identifier-only v1 asset remains available for reproducibility. National CSV/ZIP files remain under ignored `raw/`; visitors download only the small regional asset.

## Reproduce

Requires Python 3 standard library for the optional data rebuild, plus the retained official archive. From the project root:

```sh
python3 scripts/property/coordinates.py \
  raw/os-open-uprn-202609/source.zip \
  public/data/sale-locations.v1.json \
  raw/rebuilt-sale-locations.json > raw/rebuilt-coordinate-audit.json
```

The script verifies both published MD5 and pinned SHA-256/length, checks version and notice files, scans the ZIP member to EOF (including ZIP CRC validation), validates coordinate fields and rejects conflicting matches. Output refuses overwriting. Review updated publishers/releases before changing pins and publish under a new asset version. Do not disable verification to accept changed bytes. This script writes local data only; it never deploys.

Runtime access is now verified for the OS product/API and the archive host `omseprd1stdstordownload.blob.core.windows.net`. No network-setting action remains necessary for the bundled release.
