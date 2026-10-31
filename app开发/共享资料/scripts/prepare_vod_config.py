#!/usr/bin/env python3
"""Inject only vendor client License/certificate and App-bound download key into isolated builds."""
import argparse
import json
import re
from pathlib import Path
import shutil
import xml.etree.ElementTree as ET

IDENTIFIERS = {'ios': 'cn.com.swod.app', 'android': 'cn.com.swod.app', 'harmony': 'cn.com.swod.evadance'}

def load_assets(platform, private_root=None):
    folder = (Path(private_root) if private_root else Path.home() / '.config/eva-app/vod') / platform
    manifest = folder / 'license.json'
    if not manifest.is_file():
        return None
    value = json.loads(manifest.read_text())
    if value.get('applicationId') != IDENTIFIERS[platform] or not isinstance(value.get('licenseKey'), str) or not value['licenseKey'].strip():
        raise ValueError('VOD License application binding or key is invalid')
    cert = folder / 'AliVideoCert.crt'
    key = folder / 'encryptedApp.dat'
    for file in [cert, key]:
        if not file.is_file() or file.is_symlink() or file.stat().st_size == 0:
            raise ValueError('VOD client certificate or download key missing')
    try:
        encoded_key = key.read_text(encoding='utf-8-sig').strip()
    except UnicodeDecodeError as error:
        raise ValueError('VOD download key must preserve the vendor encoded file, not decoded bytes') from error
    if not re.fullmatch(r'[A-Za-z0-9_+/=-]+', encoded_key):
        raise ValueError('VOD download key is not the vendor encoded file')
    if platform == 'android' and value.get('signatureMD5') != '460ddea3a2119d0c4f11c43c24889b11':
        raise ValueError('VOD Android License does not match the original release certificate')
    return {'licenseKey': value['licenseKey'], 'certificate': str(cert), 'downloadKey': str(key)}

def prepare(platform, staging):
    assets = load_assets(platform)
    if not assets:
        print('VOD client License missing; cache stays unavailable. No credentials copied.')
        return
    staging = Path(staging).resolve()
    source = Path(__file__).resolve().parents[2] / ('Android' if platform == 'android' else 'HarmonyOS') / 'EvaDance'
    if staging == source or source in staging.parents or staging in source.parents:
        raise ValueError('VOD credentials may only be injected into an isolated build')
    if platform == 'android':
        target = staging / 'app/src/main/assets'
        manifest = staging / 'app/src/main/AndroidManifest.xml'
        ET.register_namespace('android', 'http://schemas.android.com/apk/res/android')
        document = ET.parse(manifest); app = document.getroot().find('application')
        namespace = '{http://schemas.android.com/apk/res/android}'
        for name, value in [('licensekey', assets['licenseKey']), ('licensefile', 'assets/AliVideoCert.crt')]:
            full = 'com.aliyun.alivc_license.' + name
            for old in list(app.findall('meta-data')):
                if old.get(namespace + 'name') == full: app.remove(old)
            ET.SubElement(app, 'meta-data', {namespace + 'name': full, namespace + 'value': value})
        document.write(manifest, encoding='utf-8', xml_declaration=True)
    else:
        target = staging / 'entry/src/main/resources/rawfile'
        manifest = staging / 'entry/src/main/module.json5'
        document = json.loads(manifest.read_text())
        items = document['module'].get('metadata', [])
        items = [row for row in items if not row['name'].startswith('com.aliyun.alivc_license.')]
        items += [{'name': 'com.aliyun.alivc_license.licensekey', 'value': assets['licenseKey']},
                  {'name': 'com.aliyun.alivc_license.licensefile', 'value': 'AliVideoCert.crt'}]
        document['module']['metadata'] = items
        manifest.write_text(json.dumps(document, ensure_ascii=False, indent=2) + '\n')
    target.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(assets['certificate'], target / 'AliVideoCert.crt')
    shutil.copyfile(assets['downloadKey'], target / 'encryptedApp.dat')
    print('App-bound VOD client assets prepared in isolated build; values withheld.')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('platform', choices=['android', 'harmony'])
    parser.add_argument('staging')
    args = parser.parse_args()
    prepare(args.platform, args.staging)
