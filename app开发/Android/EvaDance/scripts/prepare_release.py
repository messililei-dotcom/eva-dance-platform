#!/usr/bin/env python3
"""Package Android sources and explicitly scoped backend references, without local secrets."""
import argparse
import hashlib
import json
import re
import shutil
import zipfile
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
WORKSPACE = PROJECT.parents[2]
ADMIN = WORKSPACE/'10-统一平台admin-platform'

def package(destination):
    destination.mkdir(parents=True,exist_ok=True)
    files = {}
    def add(source, name):
        payload=source.read_bytes()
        files[name]=payload
    for source in PROJECT.rglob('*'):
        relative=source.relative_to(PROJECT)
        if not source.is_file() or any(part.startswith('._') or part in {'.gradle','build','__pycache__','.idea','.DS_Store'} for part in relative.parts): continue
        if source.name in {'local.properties','signing.local.properties'} or source.suffix in {'.p12','.jks','.keystore','.pem','.key','.log'}: continue
        add(source,'Android/EvaDance/'+relative.as_posix())
    for name in ['src/app/api/app/v1/[...path]/route.ts']+[str(p.relative_to(ADMIN)) for p in (ADMIN/'src/lib/server').glob('app-*.ts')]:
        add(ADMIN/name,'backend-delta/'+name)
    for source in (ADMIN/'src/lib/server').glob('app-*.ts'):
        add(source,'backend-reference/src/lib/server/'+source.name)
    add(ADMIN/'src/middleware.ts','backend-reference/src/middleware.ts')
    for name in ['app-profile.test.cjs','app-shop.test.cjs','app-session.test.cjs','app-event-music.test.cjs','app-event-summary.test.cjs']:
        add(ADMIN/'scripts'/name,'backend-tests/'+name)
    record=PROJECT.parent/'开发记录/20261014'
    for name in ['发布前检查.json','发布证书核对.json','发布前最后准备.md','构建与签名验收.json','后端上线验收.json','隔离会话验收.json','全自动完成记录.md']:
        add(record/name,'evidence/'+name)
    for source in (record/'模拟器验收').glob('*'):
        if not source.name.startswith('._') and source.suffix in {'.json','.png','.xml'}:
            add(source,'evidence/emulator/'+source.name)
    for source in (destination/'installers').glob('*'):
        if not source.name.startswith('._') and source.suffix in {'.apk','.aab'}:
            add(source,'installers/'+source.name)
    files['README.md']='''# 安卓发布准备包 1.0.0 (5)

当前为已构建、已部署后端、已通过模拟器检查的候选版。installers 中包含实际签名 APK 和 AAB；正式发布检查仍为 NOT_READY，真机及备案/应用市场材料尚未验证。

- Android/EvaDance 是可构建工程；SDK、私有签名配置均不在包内。
- backend-delta 是本轮 App API/资料变更，backend-reference 是 App 核心和中间件参考。它们依赖原统一平台的 mini API、会员、商城及服务器模块，不能独立运行。
- 后端部署前须对照线上基线建立隔离候选工程，检查新增 import 闭包和 schema，不得把当前工作区其他未验收变更一起覆盖到生产。
- backend-tests 是需在原统一平台运行的测试；测试数据库均为内存或临时目录。
- evidence 包含实际阻断项、签名材料核对和后续验收步骤。
- 使用 SHA256SUMS.json 核对包内完整性；不包含私钥、口令、数据库、环境变量文件或本地 SDK。
'''.encode()
    for name,data in files.items():
        if re.search(rb'(?m)^-----BEGIN (?:RSA |EC |ENCRYPTED )?PRIVATE KEY-----\r?$',data): raise ValueError('Private key content rejected')
    manifest={name:hashlib.sha256(data).hexdigest() for name,data in sorted(files.items())}
    archive=destination/'SWOD-Android-1.0.0-5-preparation.zip'
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as output:
        for name,data in sorted(files.items()):
            entry=zipfile.ZipInfo(name)
            entry.create_system=3
            entry.compress_type=zipfile.ZIP_DEFLATED
            executable=name.endswith(('.sh','.command')) or Path(name).name == 'gradlew'
            entry.external_attr=(0o100755 if executable else 0o100644)<<16
            output.writestr(entry,data)
        output.writestr('SHA256SUMS.json',json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    with zipfile.ZipFile(archive) as output:
        assert output.testzip() is None
        for name,digest in manifest.items(): assert hashlib.sha256(output.read(name)).hexdigest()==digest
    result={'artifactType':'signed-release-candidate','releaseReady':False,'productionBusinessWrites':False,
        'files':len(manifest),'zip':archive.name,'sha256':hashlib.sha256(archive.read_bytes()).hexdigest()}
    (destination/'package-manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(result,ensure_ascii=False))

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--output',type=Path,required=True)
    package(parser.parse_args().output.resolve())
