#!/usr/bin/env python3
"""Archive an existing dated Android distribution preparation directory and source snapshot."""
import argparse
import hashlib
import json
import re
import zipfile
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
EXCLUDED = {'.gradle', 'build', '__pycache__', '.idea', '.git', '.DS_Store'}
SECRET_NAMES = {'local.properties', 'signing.local.properties', '.env', '.env.local'}
SECRET_SUFFIXES = {'.p12', '.pfx', '.jks', '.keystore', '.key'}


def allowed(relative):
    return not any(p.startswith('._') or p in EXCLUDED or p.startswith('.env') for p in relative.parts) and relative.name not in SECRET_NAMES and relative.suffix not in SECRET_SUFFIXES


def package(destination):
    validation = json.loads((destination/'evidence/build-validation.json').read_text())
    version = validation['versionName']
    code = validation['versionCode']
    files = {}
    for base, prefix in [(PROJECT, 'source/Android/EvaDance'), (destination, '')]:
        for source in base.rglob('*'):
            relative = source.relative_to(base)
            if not source.is_file() or not allowed(relative):
                continue
            if base == destination and (relative.suffix == '.zip' or relative.name in {'package-manifest.json', 'SHA256SUMS.json'}):
                continue
            payload = source.read_bytes()
            if re.search(rb'-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----', payload):
                raise ValueError('Private key content rejected: ' + str(relative))
            files[(Path(prefix)/relative).as_posix()] = payload
    for name, expected in validation['artifacts'].items():
        payload = files['installers/'+name]
        assert hashlib.sha256(payload).hexdigest() == expected['sha256'], name
        assert len(payload) == expected['bytes'], name
    sums = {name: hashlib.sha256(data).hexdigest() for name, data in sorted(files.items())}
    archive = destination/f'SWOD-Android-{version}-{code}-preparation.zip'
    with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED) as output:
        for name, data in sorted(files.items()):
            entry = zipfile.ZipInfo(name)
            entry.create_system = 3
            entry.compress_type = zipfile.ZIP_DEFLATED
            executable = name.endswith(('.sh', '.command')) or Path(name).name == 'gradlew'
            entry.external_attr = (0o100755 if executable else 0o100644) << 16
            output.writestr(entry, data)
        output.writestr('SHA256SUMS.json', json.dumps(sums, ensure_ascii=False, indent=2)+'\n')
    with zipfile.ZipFile(archive) as output:
        assert output.testzip() is None
        assert all(hashlib.sha256(output.read(n)).hexdigest() == h for n, h in sums.items())
    result = {'asOf': validation['asOf'], 'artifactType': 'signed-release-preparation',
        'packageName': validation['package'], 'versionName': version, 'versionCode': code,
        'releaseReady': False, 'storeReviewSubmitted': False, 'publicDownloadDeployed': False,
        'productionBusinessWrites': False, 'sourceSnapshotIncluded': True,
        'files': len(sums), 'zip': archive.name, 'bytes': archive.stat().st_size,
        'sha256': hashlib.sha256(archive.read_bytes()).hexdigest()}
    (destination/'SHA256SUMS.json').write_text(json.dumps(sums, ensure_ascii=False, indent=2)+'\n')
    (destination/'package-manifest.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    package(parser.parse_args().output.resolve())
