"""Stream the official ZIP's CSV; retain only requested UPRNs. No national CSV on disk."""
import csv, hashlib, io, json, math, sys, zipfile

def join_rows(rows, wanted):
    found, ambiguous, count, duplicates = {}, set(), 0, 0
    for row in rows:
        count += 1
        if len(row) != 5:
            raise ValueError(f'Invalid CSV width at row {count}')
        uprn, x, y, lat, lon = row
        if not uprn.isascii() or not uprn.isdigit() or uprn.startswith('0') or not 0 < int(uprn) < 10**12:
            raise ValueError(f'Invalid UPRN at row {count}')
        x, y, lat, lon = map(float, (x, y, lat, lon))
        if not all(map(math.isfinite, (x,y,lat,lon))) or not (-9 <= lon <= 3 and 49 <= lat <= 61 and 0 <= x <= 700000 and 0 <= y <= 1300000):
            raise ValueError(f'Invalid GB coordinate at row {count}')
        if uprn not in wanted: continue
        point = [lon, lat]
        if uprn in found:
            if found[uprn] != point: ambiguous.add(uprn)
            else: duplicates += 1
        else: found[uprn] = point
    return {'coordinates': [{'uprn': u, 'position': p} for u,p in sorted(found.items()) if u not in ambiguous], 'ambiguousUprns': sorted(ambiguous), 'rows': count, 'duplicateRows': duplicates}

def extract_archive(archive, wanted, expected):
    with open(archive, 'rb') as f: archive_hash = hashlib.file_digest(f, 'sha256').hexdigest()
    if archive_hash != expected['sha256']: raise ValueError('Unreviewed archive bytes')
    with zipfile.ZipFile(archive) as z:
        members = [n for n in z.namelist() if n.endswith('.csv')]
        if members != [expected['member']]: raise ValueError('Unreviewed archive members')
        versions = z.read('versions.txt').decode()
        year, month, day = expected['snapshotDate'].split('-')
        if f'Data Extraction Date: {day}-{month}-{year}' not in versions: raise ValueError('Unexpected snapshot')
        digest = hashlib.sha256()
        def lines():
            with z.open(members[0]) as f:
                for line in f:
                    digest.update(line)
                    yield line.decode('utf-8-sig')
        rows = csv.reader(lines())
        if next(rows) != ['UPRN','X_COORDINATE','Y_COORDINATE','LATITUDE','LONGITUDE']: raise ValueError('Unexpected CSV schema')
        result = join_rows(rows, wanted)
        if expected.get('csvSha256') and digest.hexdigest() != expected['csvSha256']: raise ValueError('Unexpected CSV checksum')
        if expected.get('rows') and result['rows'] != expected['rows']: raise ValueError('Unexpected row count')
        result.update(sha256=archive_hash, csvSha256=digest.hexdigest(), member=members[0], versions=versions)
    return result

if __name__ == '__main__':
    archive, identifiers, output, *manifest = sys.argv[1:]
    # The old reproduction command retains its reviewed pins.
    expected = json.load(open(manifest[0]))['coordinates'] if manifest else {
        'sha256': '107503d45bedaab7f74511766eedbd617f9ca3592113363711e94f4b6458d55a',
        'member': 'osopenuprn_202609.csv', 'snapshotDate': '2026-08-14',
        'csvSha256': 'aafe9a43365469f8b57954583344947b8f877266b88b1d92823cd67259cecd98', 'rows': 41676575,
    }
    wanted = {i['uprn'] for i in json.load(open(identifiers))['identifiers']}
    result = extract_archive(archive, wanted, expected)
    with open(output, 'x') as f: json.dump(result, f, separators=(',', ':')); f.write('\n')
    print({k:v for k,v in result.items() if k != 'coordinates'})
