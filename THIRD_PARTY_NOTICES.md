# Third-party notices

## OpenStreetMap geography

© OpenStreetMap contributors. The derived geographic database in `public/data/geography.v2.json` and `public/data/v2/` is distributed under the **Open Database License (ODbL) 1.0**, separately from the application's MIT licence.

- Copyright/attribution: https://www.openstreetmap.org/copyright
- ODbL: https://opendatacommons.org/licenses/odbl/1-0/
- Original distribution: https://download.geofabrik.de/europe/united-kingdom/england/berkshire.html
- Intermediate ODbL redistribution: https://github.com/Zagitalc/mini-reading-3d/tree/475453a10c674ece44f566120ec43e4491cddf32/public/data
- Source snapshot: 2026-09-04T20:21:21Z

The machine-readable manifest and bounded import script accompany the database. The application displays OSM attribution; retain it in derivative publications. The database is available in its editable JSON/GeoJSON form as the same public files the application loads. Any applicable ODbL share-alike obligations apply to the derived database, not by implication to independently authored application code.

No reference application source, custom landmark models, bus data, imagery or reference fonts were copied. System fonts are used.

## Fixtures

readmove's fictional transaction/property associations and illustrative population-area fixtures are dedicated under CC0 1.0: https://creativecommons.org/publicdomain/zero/1.0/. They are fictional development examples, not actual observations. OSM building geometry remains ODbL.

## Dependencies

MapLibre GL JS is BSD-3-Clause; Three.js and Zod are MIT. Dependency licences and notices are retained in their installed npm packages. Consult the pinned lockfile and dependency packages for the full transitive list. These notices do not grant permission to obtain or redistribute future commercial listing data.

## HM Land Registry Price Paid Data

Contains HM Land Registry data © Crown copyright and database right 2026. This data is licensed under the Open Government Licence v3.0.

The residential transaction subset in `public/data/sales-2025.v1.json` is derived from the official 2025 annual CSV, retrieved 3 October 2026. The source receipt/checksum and coverage counts are in `public/data/sales-2025.audit.json`. This dataset is separate from the MIT app and ODbL geography.

Publisher conditions: https://www.gov.uk/government/statistical-data-sets/price-paid-data-downloads#using-or-publishing-our-price-paid-data
OGL v3.0: https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/

OGL does not cover all third-party address rights. The publisher says Royal Mail and Ordnance Survey permit personal/non-commercial use and display for residential property price information services. This app uses the latter purpose; type Other is excluded from display. Do not repurpose this subset as a general address directory. Other address uses require the relevant permission. The UPRN lookup subset is described below; no OS coordinate product is redistributed in this release.

## HM Land Registry transaction-to-UPRN lookup

The 100 identifier pairs in `public/data/sale-locations.v1.json` are derived from the official August 2026 monthly lookup, retrieved 3 October 2026.

Contains HM Land Registry data © Crown copyright and database right 2026. This data is licensed under the Open Government Licence v3.0.

UPRNs contain OS data © Crown copyright and database rights 2026. This data is licensed under the Open Government Licence v3.0.

Source and conditions: https://www.gov.uk/government/statistical-data-sets/transaction-unique-identifier-and-uprn-look-up-table-dataset

Combined use with Price Paid addresses remains subject to their address conditions. Identifiers do not establish coordinates, property boundaries, occupants or ownership.
