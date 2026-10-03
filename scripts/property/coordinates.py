"""Rebuild reviewed OS Open UPRN coordinates without extracting the national CSV to disk.
Usage: python3 scripts/property/coordinates.py archive.zip identifiers.json output.json
Requires only Python 3 standard library. This writes local assets; it never deploys.
"""
import csv
import hashlib
import io
import json
import math
from pathlib import Path
import sys
import zipfile

MD5 = '1d5c21d8166d6efd74850ec6f1ae77ab'
SHA256 = '107503d45bedaab7f74511766eedbd617f9ca3592113363711e94f4b6458d55a'
SIZE = 619271161
MEMBER = 'osopenuprn_202609.csv'
BOUNDS = (-1.08, 51.39, -0.84, 51.50)


def extract(archive, identifiers, output):
    if output.exists():
        raise ValueError('Output exists; use a new versioned filename')
    md5, sha = hashlib.md5(), hashlib.sha256()
    with archive.open('rb') as source:
        while chunk := source.read(4 * 1024 * 1024):
            md5.update(chunk)
            sha.update(chunk)
    if archive.stat().st_size != SIZE or md5.hexdigest() != MD5 or sha.hexdigest() != SHA256:
        raise ValueError('Archive differs from the reviewed official release; do not bypass checksum verification')
    data = json.loads(identifiers.read_text())
    wanted = {item['uprn'] for item in data['identifiers']}
    points, audit_rows = {}, []
    rows, duplicates = 0, 0
    with zipfile.ZipFile(archive) as z:
        if 'Data Extraction Date: 14-08-2026' not in z.read('versions.txt').decode():
            raise ValueError('Unexpected source extraction date')
        acknowledgement = 'Contains Ordnance Survey data © Crown copyright and database right 2026.'
        if acknowledgement not in z.read('licence.txt').decode('utf-8-sig'):
            raise ValueError('Review the source licence notice')
        with z.open(MEMBER) as raw:
            reader = csv.reader(io.TextIOWrapper(raw, encoding='utf-8-sig', newline=''))
            if next(reader) != ['UPRN', 'X_COORDINATE', 'Y_COORDINATE', 'LATITUDE', 'LONGITUDE']:
                raise ValueError('Unexpected OS CSV header or coordinate order')
            for row in reader:
                rows += 1
                if len(row) != 5:
                    raise ValueError(f'Unexpected column count at row {rows}')
                if row[0] not in wanted:
                    continue
                uprn = row[0]
                # Published angular coordinates are used directly; BNG metres are not map longitude/latitude.
                position = [float(row[4]), float(row[3])]
                if not all(math.isfinite(v) for v in position) or not (-9 < position[0] < 3 and 49 < position[1] < 62):
                    raise ValueError(f'Invalid GB coordinate for {uprn}')
                if uprn in points:
                    duplicates += 1
                    if points[uprn] != position:
                        raise ValueError(f'Conflicting coordinates for {uprn}; exclude and review explicitly')
                    continue
                points[uprn] = position
                audit_rows.append({'uprn': uprn, 'position': position, 'easting': row[1], 'northing': row[2]})
    def inside(p):
        return BOUNDS[0] <= p[0] <= BOUNDS[2] and BOUNDS[1] <= p[1] <= BOUNDS[3]
    located = [points[i['uprn']] for i in data['identifiers'] if i['uprn'] in points]
    data['coordinates'] = [{'uprn': u, 'position': p} for u, p in sorted(points.items())]
    data['counts']['coordinateMatches'] = len(located)
    data['counts']['outsideMapBounds'] = sum(not inside(p) for p in located)
    data['coordinateSource'] = {
        'product': 'OS Open UPRN',
        'url': 'https://api.os.uk/downloads/v1/products/OpenUPRN/downloads?area=GB&format=CSV&redirect',
        'sha256': SHA256, 'snapshotDate': '2026-08-14', 'release': '2026-09', 'retrievedOn': '2026-10-03',
        'attribution': acknowledgement,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open('x') as f:
        json.dump(data, f, separators=(',', ':'), ensure_ascii=False)
        f.write('\n')
    audit = {
        'product': 'OS Open UPRN', 'release': '2026-09', 'extractionDate': '2026-08-14',
        'archiveBytes': SIZE, 'publisherMd5': MD5, 'archiveSha256': SHA256, 'csvMember': MEMBER,
        'rowsScanned': rows, 'requestedUprns': len(wanted), 'coordinateMatches': len(points),
        'duplicateMatchedRows': duplicates, 'missingUprns': sorted(wanted - points.keys()),
        'outsideMapBounds': data['counts']['outsideMapBounds'], 'mapBounds': BOUNDS,
        'coordinateOrder': 'longitude, latitude from OS CSV; no datum transformation applied',
        'matchedRows': sorted(audit_rows, key=lambda r: r['uprn']),
    }
    print(json.dumps(audit, indent=2))


if __name__ == '__main__':
    if len(sys.argv) != 4:
        raise SystemExit(__doc__)
    extract(*(Path(arg) for arg in sys.argv[1:]))
