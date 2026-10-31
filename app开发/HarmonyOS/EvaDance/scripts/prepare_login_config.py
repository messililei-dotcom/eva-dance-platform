#!/usr/bin/env python3
"""Copy the existing client scheme to an isolated build; never print its value."""
import json
from pathlib import Path
import sys

source = Path(__file__).resolve().parents[1]
project = Path(sys.argv[1]).resolve()
if project == source or source in project.parents:
    raise SystemExit('号码认证配置只能写入独立编译副本。')
private = Path.home() / '.config/eva-app/harmony-number-auth.json'
config = json.loads(private.read_text()) if private.is_file() else {}
allowed = ['bundleName', 'appIdentifier', 'certificateSHA256', 'sdkSecret']
target = project / 'entry/src/main/resources/rawfile/number-auth.local.json'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps({key: config.get(key, '') for key in allowed}))
target.chmod(0o600)
print('Client scheme configuration prepared; values withheld.')
import subprocess
subprocess.run([sys.executable, str(source.parents[1] / '共享资料/scripts/prepare_vod_config.py'), 'harmony', str(project)], check=True)

private_push = Path.home() / '.config/eva-app/push/harmony.json'
push = json.loads(private_push.read_text()) if private_push.is_file() else {}
push_target = project / 'entry/src/main/resources/rawfile/push.local.json'
push_target.write_text(json.dumps({key: push.get(key, '') for key in ['appKey', 'appSecret']}))
push_target.chmod(0o600)
