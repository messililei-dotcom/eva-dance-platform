"""Capture native Simulator screens with local fixtures; no production writes."""
from pathlib import Path
import argparse, os, shutil, subprocess, tempfile, time
from PIL import Image, ImageStat

p = argparse.ArgumentParser()
p.add_argument('--app', required=True)
p.add_argument('--device', default='AABD227B-C321-4344-BA51-8C8C13CA166F')
p.add_argument('--phase', choices=['before', 'after'], required=True)
args = p.parse_args()
root = Path(__file__).resolve().parents[1]
scratch = Path(tempfile.mkdtemp(prefix='swod-capture-'))
def sim(*values, check=True, env=None):
    return subprocess.run(['xcrun', 'simctl', *values], check=check, env=env, capture_output=True)
sim('terminate', args.device, 'cn.com.swod.app', check=False)
sim('install', args.device, args.app)
try:
    for tab, name in enumerate(['academy', 'offline', 'events', 'shop', 'account']):
        sim('terminate', args.device, 'cn.com.swod.app', check=False)
        env = os.environ.copy()
        env['SIMCTL_CHILD_EVA_API_BASE'] = 'http://127.0.0.1:18765/api/app/v1'
        env['SIMCTL_CHILD_EVA_UI_TAB'] = str(tab)
        sim('launch', args.device, 'cn.com.swod.app', env=env)
        time.sleep(4)
        target = scratch / (name + '.png')
        for attempt in range(2):
            sim('io', args.device, 'screenshot', str(target))
            image = Image.open(target).convert('RGB')
            crop = image.crop((0, 200, image.width, int(image.height * .88)))
            if max(ImageStat.Stat(crop).stddev) > 12:
                break
            time.sleep(3)
        else:
            raise RuntimeError('Simulator is still showing a blank launch screen: ' + name)
        shutil.copy2(target, root / args.phase / ('ios-' + name + '.png'))
        print(args.phase + ': iOS ' + name, flush=True)
finally:
    shutil.rmtree(scratch)
