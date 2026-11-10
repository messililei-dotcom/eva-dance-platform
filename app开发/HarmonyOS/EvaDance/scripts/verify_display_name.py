#!/usr/bin/env python3
"""Check every compiled app/launcher label variant in a real release HAP."""
import argparse
import json
from pathlib import Path
import struct
import zipfile


def variants(resources, reference, expected_id):
    name = reference.removeprefix('$string:').encode('utf-8')
    marker = struct.pack('<I', len(name)) + name
    positions = []
    start = 0
    while (at := resources.find(marker, start)) >= 0:
        if at >= 8:
            resource_id, offset = struct.unpack_from('<II', resources, at - 8)
            if resource_id == expected_id:
                positions.append(offset)
        start = at + len(marker)
    if len(positions) != 1:
        raise ValueError('Cannot uniquely resolve compiled label: ' + reference)
    offset = positions[0]
    resource_id, size, count = struct.unpack_from('<III', resources, offset)
    if resource_id != expected_id or not 1 <= count <= 256 or size != 12 + count * 8:
        raise ValueError('Unsupported compiled label record: ' + reference)
    values = []
    for index in range(count):
        configuration, pointer = struct.unpack_from('<II', resources, offset + 12 + index * 8)
        length = struct.unpack_from('<H', resources, pointer)[0]
        if pointer + 2 + length > len(resources):
            raise ValueError('Truncated compiled label')
        value = resources[pointer + 2:pointer + 2 + length].decode('utf-8')
        values.append({'configuration': configuration, 'value': value})
    return values


def verify(hap, expected='SWOD'):
    with zipfile.ZipFile(hap) as archive:
        manifest = json.loads(archive.read('module.json'))
        resources = archive.read('resources.index')
    labels = [('application', manifest['app'])]
    for ability in manifest['module']['abilities']:
        if any('entity.system.home' in skill.get('entities', []) for skill in ability.get('skills', [])):
            labels.append(('launcher:' + ability['name'], ability))
    if len(labels) < 2:
        raise ValueError('No launcher ability found')
    results = []
    for owner, entry in labels:
        values = variants(resources, entry['label'], entry['labelId'])
        results.append({'owner': owner, 'reference': entry['label'], 'variants': values})
    passed = all(v['value'] == expected for label in results for v in label['variants'])
    return {'hap': str(hap), 'expected': expected, 'passed': passed, 'labels': results}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('hap', type=Path)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    result = verify(args.hap)
    rendered = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        args.output.write_text(rendered)
    print(rendered, end='')
    raise SystemExit(0 if result['passed'] else 1)


if __name__ == '__main__':
    main()
