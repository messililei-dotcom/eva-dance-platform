"""Capture the isolated screenshot harness package; only public GET data is read."""
from pathlib import Path
import argparse, subprocess, time

p = argparse.ArgumentParser()
p.add_argument('--apk', required=True)
p.add_argument('--phase', choices=['before', 'after'], required=True)
args = p.parse_args()
root = Path(__file__).resolve().parents[1]
adb = '/Users/lilei/Library/Android/sdk/platform-tools/adb'
subprocess.run([adb, 'install', '-r', args.apk], check=True, capture_output=True)
for tab, name in enumerate(['academy', 'offline', 'events', 'shop', 'account']):
    subprocess.run([adb, 'shell', 'am', 'force-stop', 'cn.com.swod.app.uiqa'], check=True, capture_output=True)
    subprocess.run([adb, 'shell', 'am', 'start', '-n', 'cn.com.swod.app.uiqa/cn.com.swod.app.MainActivity', '--ei', 'ui_tab', str(tab)], check=True, capture_output=True)
    time.sleep(5)
    (root / args.phase / ('android-' + name + '.png')).write_bytes(subprocess.check_output([adb, 'exec-out', 'screencap', '-p']))
    print(args.phase + ': Android ' + name, flush=True)
