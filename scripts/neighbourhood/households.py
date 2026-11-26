"""Build household context from reviewed NOMIS bulk downloads for December 2021 LSOAs."""
import argparse
import json
from pathlib import Path

from census_bulk import mapped_codes, read_counts

SOURCES = {
    "TS054": (
        "aa07311021776a93fdd7e8f6b3ad261b919305ef821ae68174fb1a66b85304c2",
        "Tenure of household: ",
        {"total": "Total: All households", "owned": "Owned",
         "sharedOwnership": "Shared ownership", "socialRent": "Social rented",
         "privateRent": "Private rented", "rentFree": "Lives rent free"},
    ),
    "TS045": (
        "95593dcd53247d4458e97edd7454577a63e47fd43be957f0a2460e872efdc070",
        "Number of cars or vans: ",
        {"total": "Total: All households", "noCarOrVan": "No cars or vans in household"},
    ),
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sources", type=Path, default=Path("raw/neighbourhood"))
    parser.add_argument("--output", type=Path, default=Path("public/data/households.v1.json"))
    args = parser.parse_args()
    codes = mapped_codes()
    tables = {
        table: read_counts(args.sources / f"census2021-{table.lower()}.zip", table, codes, source)
        for table, source in SOURCES.items()
    }
    asset = {
        "version": 1,
        "referenceDate": "2021-03-21",
        "geography": "December 2021 LSOA",
        "retrievedOn": "2026-11-25",
        "attribution": "Source: Office for National Statistics, via Nomis. Open Government Licence v3.0.",
        "sources": {
            table: {
                "url": f"https://www.nomisweb.co.uk/output/census/2021/census2021-{table.lower()}.zip",
                "sha256": source[0],
                "member": f"census2021-{table.lower()}-lsoa.csv",
            }
            for table, source in SOURCES.items()
        },
        "areas": {
            code: {"tenure": tables["TS054"][code], "vehicles": tables["TS045"][code]}
            for code in sorted(codes)
        },
    }
    args.output.write_text(json.dumps(asset, separators=(",", ":")) + "\n")
    print(f"{len(codes)} LSOAs written to {args.output}")


if __name__ == "__main__":
    main()
