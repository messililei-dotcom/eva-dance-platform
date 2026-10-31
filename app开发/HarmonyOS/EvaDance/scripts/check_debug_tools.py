#!/usr/bin/env python3
"""Check actual debugger startup with bounded timeouts; never alter OS protections."""
import argparse
from datetime import datetime
import json
import os
from pathlib import Path
import subprocess
from zoneinfo import ZoneInfo


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--clt', type=Path)
    parser.add_argument('--timeout', type=float, default=8)
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    if args.timeout <= 0:
        parser.error('--timeout must be positive')
    root = args.clt or Path(os.environ.get('DEVECO_CLI_CLT_PATH',
        Path.home() / 'Library/Huawei/CommandLineTools/6.1.1.418/command-line-tools'))
    hdc = root / 'sdk/default/openharmony/toolchains/hdc'
    emulator = root / 'bin/Emulator'
    checks = []
    for name, command, expected in [
        ('hdcVersion', [str(hdc), '-v'], 'Ver:'),
        ('hdcTargets', [str(hdc), 'list', 'targets', '-v'], None),
        ('emulatorVersion', [str(emulator), '-version'], 'HarmonyOS Emulator'),
    ]:
        row = {'name': name, 'passed': False}
        try:
            result = subprocess.run(command, capture_output=True, text=True, timeout=args.timeout)
            output = result.stdout.strip()
            row['exitCode'] = result.returncode
            row['passed'] = result.returncode == 0 and bool(output) and (expected is None or expected in output)
            if name == 'hdcTargets':
                row['deviceCount'] = sum('Connected' in line.split() for line in output.splitlines())
                row['offlineDeviceCount'] = sum('Offline' in line.split() for line in output.splitlines())
            else:
                row['version'] = output if row['passed'] else None
        except subprocess.TimeoutExpired:
            row['error'] = 'STARTUP_TIMEOUT'
        except OSError as error:
            row['error'] = type(error).__name__
        checks.append(row)
    report = {
        'checkedAt': datetime.now(ZoneInfo('Asia/Shanghai')).isoformat(),
        'debugToolsWorking': all(row['passed'] for row in checks),
        'checks': checks,
        'note': '工具可启动不代表模拟器已启动、App已安装或真机验收通过。',
    }
    rendered = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding='utf-8')
    print(rendered, end='')
    return 0 if report['debugToolsWorking'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
