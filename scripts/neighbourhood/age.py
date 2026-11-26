"""Build area-level age counts from the reviewed Census 2021 TS007A archive."""
import argparse
import json
from pathlib import Path

from census_bulk import mapped_codes, read_counts

TABLE = "TS007A"
CHECKSUM = "041e57fa6d3243fd622772767bba08ea64dece3d57de909f1fbcf675f888cad7"
SOURCE_BANDS = ["Aged 4 years and under"] + [
    f"Aged {lower} to {lower + 4} years" for lower in range(5, 85, 5)
] + ["Aged 85 years and over"]
GROUPS = [(0, 3), (3, 5), (5, 9), (9, 13), (13, 18)]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path, default=Path("raw/neighbourhood/census2021-ts007a.zip"))
    parser.add_argument("--output", type=Path, default=Path("public/data/age.v1.json"))
    args = parser.parse_args()
    fields = {"total": "Total", **dict(enumerate(SOURCE_BANDS))}
    rows = read_counts(args.archive, TABLE, mapped_codes(), (CHECKSUM, "Age: ", fields))
    areas = {}
    for code, row in sorted(rows.items()):
        bands = [sum(row[index] for index in range(start, end)) for start, end in GROUPS]
        if any(band > row["total"] for band in bands):
            raise ValueError(f"{code}: grouped age count exceeds area total")
        areas[code] = {"total": row["total"], "bands": bands}
    asset = {
        "version": 1,
        "referenceDate": "2021-03-21",
        "geography": "December 2021 LSOA",
        "source": {
            "table": TABLE,
            "url": "https://www.nomisweb.co.uk/output/census/2021/census2021-ts007a.zip",
            "sha256": CHECKSUM,
            "member": "census2021-ts007a-lsoa.csv",
            "retrievedOn": "2026-11-26",
            "attribution": "Source: Office for National Statistics, via Nomis. Open Government Licence v3.0.",
        },
        "areas": areas,
    }
    args.output.write_text(json.dumps(asset, separators=(",", ":")) + "\n")
    print(f"{len(areas)} LSOAs written to {args.output}")


if __name__ == "__main__":
    main()
