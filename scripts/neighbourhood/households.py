"""Build household context from reviewed NOMIS bulk downloads for December 2021 LSOAs."""
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
import zipfile

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


def read_counts(archive, table, codes):
    checksum, prefix, fields = SOURCES[table]
    with archive.open("rb") as source:
        if hashlib.file_digest(source, "sha256").hexdigest() != checksum:
            raise ValueError(f"{table}: unreviewed archive checksum")
    member = f"census2021-{table.lower()}-lsoa.csv"
    result = {}
    columns = {key: prefix + label for key, label in fields.items()}
    with zipfile.ZipFile(archive) as source, source.open(member) as raw:
        rows = csv.DictReader(io.TextIOWrapper(raw, encoding="utf-8-sig", newline=""))
        if not {"date", "geography code", *columns.values()}.issubset(rows.fieldnames or []):
            raise ValueError(f"{table}: unexpected CSV columns")
        for row in rows:
            code = row["geography code"]
            if code not in codes:
                continue
            if code in result or row["date"] != "2021":
                raise ValueError(f"{table}: duplicate code or unexpected year for {code}")
            values = {key: int(row[column]) for key, column in columns.items()}
            if values["total"] <= 0 or any(
                value < 0 or value > values["total"] for value in values.values()
            ):
                raise ValueError(f"{table}: invalid counts for {code}")
            result[code] = values
    if codes - result.keys():
        raise ValueError(f"{table}: missing LSOAs {sorted(codes - result.keys())}")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sources", type=Path, default=Path("raw/neighbourhood"))
    parser.add_argument("--output", type=Path, default=Path("public/data/households.v1.json"))
    args = parser.parse_args()
    geography = json.loads(Path("public/data/neighbourhoods.v1.json").read_text())
    codes = {area["code"] for area in geography["areas"]}
    if geography["geography"]["edition"] != "December 2021" or len(codes) != len(geography["areas"]):
        raise ValueError("Expected unique December 2021 LSOAs")
    tables = {
        table: read_counts(args.sources / f"census2021-{table.lower()}.zip", table, codes)
        for table in SOURCES
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
