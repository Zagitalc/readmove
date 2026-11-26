"""Read checked NOMIS bulk tables for the map's published LSOA codes."""
import csv
import hashlib
import io
import json
from pathlib import Path
import zipfile


def mapped_codes():
    geography = json.loads(Path("public/data/neighbourhoods.v1.json").read_text())
    codes = {area["code"] for area in geography["areas"]}
    if geography["geography"]["edition"] != "December 2021" or len(codes) != len(geography["areas"]):
        raise ValueError("Expected unique December 2021 LSOAs")
    return codes


def read_counts(archive, table, codes, source):
    checksum, prefix, fields = source
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
