#!/usr/bin/env python3
"""Report local HarmonyOS prerequisites without reading signing secrets."""
import argparse
import json
import os
from pathlib import Path
import shutil
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--studio', type=Path, help='DevEco Studio .app path')
    parser.add_argument('--clt', type=Path, help='Official Command Line Tools root')
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    home = Path.home()
    studios = [args.studio] if args.studio else [
        Path('/Applications/DevEco-Studio.app'),
        Path('/Applications/DevEco Studio.app'),
        home / 'Applications/DevEco-Studio.app',
        home / 'Applications/DevEco Studio.app',
    ]
    studio = next((path for path in studios if path.is_dir()), None)
    installed_clt = home / 'Library/Huawei/CommandLineTools/6.1.1.418/command-line-tools'
    clt_value = args.clt or os.environ.get('DEVECO_CLI_CLT_PATH') or (installed_clt if installed_clt.is_dir() else None)
    clt = Path(clt_value).expanduser() if clt_value else None
    roots = ([studio / 'Contents'] if studio else []) + ([clt] if clt and clt.is_dir() else [])

    def find(relative_paths, executable_name):
        for root in roots:
            for relative in relative_paths:
                candidate = root / relative
                if candidate.is_file() and os.access(candidate, os.X_OK):
                    return str(candidate)
        return shutil.which(executable_name)

    node = find(['tool/node/bin/node', 'tools/node/bin/node', 'tools/node/node', 'node/bin/node', 'node/node'], 'node')
    java = find(['jbr/Contents/Home/bin/java', 'jbr/bin/java'], 'java')
    ohpm = find(['bin/ohpm', 'tools/ohpm/bin/ohpm', 'ohpm/bin/ohpm'], 'ohpm')
    hvigor = find(['bin/hvigorw', 'tools/hvigor/bin/hvigorw', 'hvigor/bin/hvigorw'], 'hvigorw')
    sdk_candidates = [root / 'sdk' for root in roots]
    for key in ['DEVECO_SDK_HOME', 'HARMONYOS_SDK_HOME']:
        if os.environ.get(key):
            sdk_candidates.append(Path(os.environ[key]).expanduser())
    sdk_candidates.append(home / 'Library/Huawei/Sdk')
    sdk = [str(path) for path in sdk_candidates if path.is_dir()]
    missing = [name for name, value in {
        'DevEco Studio or official Command Line Tools': roots,
        'Node.js': node, 'Java': java, 'ohpm': ohpm, 'Hvigor': hvigor,
        'HarmonyOS SDK directory': sdk,
    }.items() if not value]
    result = {
        'status': 'BLOCKED_MISSING_TOOLCHAIN' if missing else 'TOOLCHAIN_DETECTED_UNVERIFIED',
        'requiredSdk': 'HarmonyOS 6.0.2 (API 22)',
        'studio': str(studio) if studio else None,
        'clt': str(clt) if clt and clt.is_dir() else None,
        'tools': {'node': node, 'java': java, 'ohpm': ohpm, 'hvigor': hvigor},
        'sdkDirectories': sdk,
        'missing': missing,
        'sdkCompatibilityVerified': False,
        'compiled': False,
        'note': '仅探测文件路径；Java/SDK版本、依赖安装、ArkTS编译、签名及真机运行须另行验证。',
    }
    rendered = json.dumps(result, ensure_ascii=False, indent=2) + '\n'
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding='utf-8')
    print(rendered, end='')
    return 1 if missing else 0


if __name__ == '__main__':
    sys.exit(main())
