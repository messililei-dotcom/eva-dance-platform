#!/usr/bin/env python3
"""Sync only public mobile registration fields. Never read a private credential file."""
import argparse
import json
from pathlib import Path

shared = Path(__file__).resolve().parents[1]
apps = shared.parent
config = json.loads((shared / '配置/wechat-mobile.public.json').read_text())
allowed = {'schemaVersion', 'applicationType', 'applicationName', 'appId', 'universalLink',
           'loginEnabled', 'permissionStatus', 'iosBundleId', 'androidPackageName',
           'androidSignatureMD5', 'harmonyBundleName', 'harmonyIdentifier'}
if set(config) != allowed or config['applicationType'] != 'mobile' or config['loginEnabled'] is not False:
    raise SystemExit('Invalid public mobile configuration or unapproved login enablement.')
payload = json.dumps(config, ensure_ascii=False, indent=2) + '\n'
targets = [apps / 'iOS/EvaDance/Resources/wechat-mobile.public.json',
           apps / 'Android/EvaDance/app/src/main/assets/wechat-mobile.public.json',
           apps / 'HarmonyOS/EvaDance/entry/src/main/resources/rawfile/wechat-mobile.public.json']
check = argparse.ArgumentParser()
check.add_argument('--check', action='store_true')
args = check.parse_args()
for target in targets:
    if args.check:
        if not target.is_file() or target.read_text() != payload:
            raise SystemExit(f'Public configuration out of sync: {target}')
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(payload)
print('Public mobile configuration synchronized; login remains disabled.')
