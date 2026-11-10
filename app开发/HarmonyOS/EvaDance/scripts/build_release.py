#!/usr/bin/env python3
"""Build in a local cache, sign with existing private material, and verify artifacts."""
import argparse
from datetime import datetime
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import zipfile
from zoneinfo import ZoneInfo


def main():
    project = Path(__file__).resolve().parents[1]
    platform = project.parent
    home = Path.home()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--work-dir', type=Path, default=home / 'Library/Caches/SWOD/HarmonyOS/release/EvaDance')
    parser.add_argument('--output', type=Path, default=platform / '发布准备包' / datetime.now(ZoneInfo('Asia/Shanghai')).strftime('%Y%m%d'))
    args = parser.parse_args()
    work, output = args.work_dir.resolve(), args.output.resolve()
    if work == project or project in work.parents or work in project.parents:
        raise SystemExit('编译目录必须与源码目录分开。')
    clt = Path(os.environ.get('DEVECO_CLI_CLT_PATH', home / 'Library/Huawei/CommandLineTools/6.1.1.418/command-line-tools'))
    java_home = Path(os.environ.get('JAVA_HOME', home / 'Library/Developer/EvaToolchains/jdk-17.0.20.1+1/Contents/Home'))
    java = java_home / 'bin/java'
    sdk = clt / 'sdk/default/openharmony/toolchains/lib'
    private = home / 'Library/Application Support/EvaAppSigning/harmonyos-release'
    key_store = private / 'eva-dance-harmony-release.p12'
    profile = private / 'SWOD-HarmonyOS-Push-Release-20261029.p7b'
    certificate = platform / '备案资料/20261002/EvaDance-HarmonyOS-Release.cer'
    for path in [java, clt / 'bin/hvigorw', key_store, profile, certificate, private / 'keystore-password.txt']:
        if not path.is_file():
            raise SystemExit('缺少本地构建资料：' + str(path))
    secret = (private / 'keystore-password.txt').read_text().strip()
    if not secret:
        raise SystemExit('签名密码文件为空。')
    profile_json = json.loads(subprocess.check_output([
        'openssl', 'cms', '-verify', '-inform', 'DER', '-in', str(profile), '-noverify',
    ], stderr=subprocess.DEVNULL))
    assert profile_json['bundle-info']['bundle-name'] == 'cn.com.swod.evadance'
    assert 'com.huawei.service.push.base_service' in profile_json.get('app-services-capabilities', {}), '发布Profile缺少推送服务能力'
    output.mkdir(parents=True, exist_ok=True)
    evidence = output / 'evidence'
    evidence.mkdir(exist_ok=True)
    shutil.copytree(project, work, dirs_exist_ok=True,
                    ignore=shutil.ignore_patterns('._*', '.DS_Store', 'build', '.hvigor', 'oh_modules', 'node_modules'))
    subprocess.run([sys.executable, str(project / 'scripts/prepare_login_config.py'), str(work)], check=True)
    env = os.environ.copy()
    env.update(JAVA_HOME=str(java_home), DEVECO_CLI_CLT_PATH=str(clt),
               DEVECO_SDK_HOME=str(clt / 'sdk'), DEVECO_NODE_HOME=str(clt / 'tool/node'))
    env['PATH'] = str(clt / 'tool/node/bin') + os.pathsep + str(java_home / 'bin') + os.pathsep + env.get('PATH', '')

    def run(command, log, success=None):
        result = subprocess.run([str(value) for value in command], cwd=work, env=env,
                                stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
        text = result.stdout.replace(secret, '<REDACTED>')
        (evidence / log).write_text(text)
        if result.returncode or (success and success not in text):
            raise SystemExit('步骤失败，见 ' + str(evidence / log) + '\n' + '\n'.join(text.splitlines()[-15:]))
        print(log + ': passed', flush=True)

    run([clt / 'bin/ohpm', 'install'], 'dependencies.log')
    run([clt / 'tool/node/bin/node', project / 'scripts/assemble_signed_app.cjs', work, certificate],
        'build-release.log', 'BUILD SUCCESSFUL')
    built = work / 'entry/build/default/outputs/default'
    run([sys.executable, project / 'scripts/verify_display_name.py',
         built / 'entry-default-unsigned.hap', '--output', evidence / 'display-name.json'],
        'verify-display-name.log')
    with zipfile.ZipFile(built / 'entry-default-unsigned.hap') as archive:
        manifest = json.loads(archive.read('module.json'))
        assert manifest['app']['bundleName'] == 'cn.com.swod.evadance'
        assert manifest['app']['debug'] is False
        assert manifest['app']['targetAPIVersion'] == 60002022
        resources = archive.read('resources.index')
        filing = '湘ICP备2026005683号-5A'
        assert filing.encode('utf-8') in resources or filing.encode('utf-16-le') in resources
    version = manifest['app']['versionName'] + '-' + str(manifest['app']['versionCode'])
    installers = output / 'installers'
    installers.mkdir(exist_ok=True)
    hap = installers / ('SWOD-' + version + '-release.hap')
    app = installers / ('SWOD-' + version + '-release.app')
    shutil.copy2(built / 'entry-default-signed.hap', hap)
    run([java, '-jar', sdk / 'hap-sign-tool.jar', 'verify-app', '-inFile', hap,
         '-outCertChain', evidence / 'hap-cert-chain.cer', '-outProfile', evidence / 'hap-profile.p7b'],
        'verify-hap.log', 'verify-app success')
    assert (evidence / 'hap-profile.p7b').read_bytes() == profile.read_bytes()
    signed_apps = list((work / 'build/outputs/default').glob('*-default-signed.app'))
    if len(signed_apps) != 1:
        raise SystemExit('无法唯一确定本次签名 APP：' + str(signed_apps))
    shutil.copy2(signed_apps[0], app)
    run([java, '-jar', sdk / 'hap-sign-tool.jar', 'verify-app', '-inFile', app,
         '-outCertChain', evidence / 'app-cert-chain.cer', '-outProfile', evidence / 'app-profile.p7b'],
        'verify-app.log', 'verify-app success')
    assert (evidence / 'app-profile.p7b').read_bytes() == profile.read_bytes()
    with zipfile.ZipFile(app) as archive:
        assert 'entry-default.hap' in archive.namelist()
        assert 'pac.json' in archive.namelist()
        assert json.loads(archive.read('pack.info'))['summary']['app']['bundleName'] == 'cn.com.swod.evadance'
    (evidence / 'module.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    records = [{'file': str(path.relative_to(output)), 'bytes': path.stat().st_size,
                'sha256': hashlib.sha256(path.read_bytes()).hexdigest()} for path in [hap, app]]
    report = {'builtAt': datetime.now(ZoneInfo('Asia/Shanghai')).isoformat(), 'bundleName': 'cn.com.swod.evadance',
              'version': version, 'filingNumber': filing, 'releaseBuild': True, 'signatureVerified': True,
              'appSigned': True, 'deviceAccepted': False, 'uploaded': False, 'published': False,
              'artifacts': records}
    (output / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print('已生成并校验：' + str(hap) + '\n' + str(app))


if __name__ == '__main__':
    main()
