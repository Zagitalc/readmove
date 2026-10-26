# Roadmap after verified sales

The local priorities are implemented: conservative July/August identifier merging, official OS coordinates, nearby-sale filters and explicit fit with desktop/mobile browser checks. Preserve the map-dominant design and finish each reliable foundation before starting another.

A. **Monthly refreshes:** manual manifest-driven acquisition, validation and candidate coverage reports are implemented; see [data refresh](data-refresh.md). Next: reviewed promotion and scheduling once proven, plus separate Price Paid snapshot refreshes with corrections/deletions. Existing published assets remain unchanged by refresh runs.

B. **Comparable exploration:** refine distance/date/type/category controls, add transaction history and explain gaps. No formal valuations, unsupported adjustments or price/m² without reliable floor areas.

C. **Exact property matches:** legitimate free identifier sources, retaining unresolved and ambiguous cases. Keep UPRNs distinct from building footprints, especially flats.

D. **ONS context:** Stage 9 bundles official 2021 LSOA boundaries with Census 2021 usual residents and published density, recording editions, dates and denominators. Next: further Census topics (age, tenure, households, car access) with explicit denominators, and an area-level panel when the map is clicked outside a building.

E. **Schools:** Stage 10 publishes DfE locations with a searchable panel and nearest-schools context. Next: dated Ofsted inspection information as a separate, explicitly framework-labelled source (no composite score). Proximity does not imply admission eligibility.

F. **Environment:** Stage 11 adds Environment Agency Flood Zones 2 and 3 (rivers and sea) as area context without property-specific risk scores. Next: separately labelled surface-water extents if their licence and scale suit, and climate-change zones as a distinct, dated layer.

G. **Architecture:** improved procedural residential roofs/materials. Selective licensed GLBs later, with distance-based loading and measured budgets.

H. **Measured usability:** Stage 12 measured load on emulated phones, ran the full browser suite in WebKit and added an automated accessibility gate; see [performance](performance.md). Next: physical iPhone/Android runs, Firefox (Playwright's build cannot start on this Mac), a screen-reader pass, and a decision on coarser or tiled flood geometry from real-device numbers.

No property-portal scraping, paid services, tracking, resident profiles or crime maps. See [source audit](uprn-matching.md) and [verification](verification.md).

Stage 8 implements filter summaries/reset, full-result date/price/distance sorting and exact-UPRN snapshot history within the existing sold-price panel. Broader history still depends on additional reviewed official data; measured mobile performance remains a future stage.

Stage 9 replaces the fictional neighbourhood polygons with 217 official ONS 2021 LSOAs and Census 2021 TS001/TS006 values, loaded only on demand. The next recommended stage is E (schools), then F (environment); H (physical-device measurement) remains open.

Stage 10 adds official DfE school locations (151 open establishments, extract 18 October 2026). Next recommended: F (Environment Agency flood-area context), then H (physical-device and Safari/Firefox measurement), with Ofsted inspections following E.

Stage 11 adds Environment Agency flood zones and fixes the nav highlight for Sold prices. Next recommended: H (measured usability: the 3 MB flood asset, 1.6 MB main script, real phones, Safari and Firefox), then dated Ofsted inspection information (E) and more Census topics (D).

Stage 12 records the first measurements: slow-4G phones reach a usable map in about 10 s and the optional flood layer adds about 5 s; WebKit passes the whole suite; the automated accessibility scan is clean after a contrast fix.
