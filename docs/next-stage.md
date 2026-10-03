# Next stage: verified sale locations

The 2025 official residential price panel is implemented and audited. Keep it useful independently of map matching; there is no paid data requirement for this release.

1. Completed: the August 2026 official lookup matches 100 of 6,325 sales with zero conflicts. See [the matching audit](uprn-matching.md). Do not assume this covers all older transactions.
2. Apply the saved OS network destinations (`www.ordnancesurvey.co.uk`, `api.os.uk`): current requests return proxy HTTP 403. Then obtain a versioned OS Open UPRN coordinate extract, verify licence/attribution and coordinate system, and audit transaction → UPRN → point joins.
3. Keep points separate from OSM building identity, especially flats and multiple dwellings. Do not assign the nearest footprint silently.
4. Connect reviewed locations to real comparable sales with type/date/category controls. Exclude unlocated records from distance queries and keep them available through address search.
5. Add more annual source files or a complete baseline with explicit corrections/versioning. A 2025 file is not full historical coverage.

See [sold-prices.md](sold-prices.md) for the completed release, evidence, limitations and reproducible commands. Census, schools, EPC and flood layers remain later stages.
