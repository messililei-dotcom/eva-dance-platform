#!/usr/bin/env python3
"""Read-only release checks. This never deploys, logs in, or creates business records."""
import argparse
import hashlib
import json
import re
import subprocess
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
ANDROID = PROJECT.parent
NS = '{http://schemas.android.com/apk/res/android}'

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def http_check(path, predicate, token=False):
    request = urllib.request.Request('https://admin.swod.com.cn/api/' + path,
        headers={'x-client-platform':'android', **({'Authorization':'Bearer release-preflight-invalid'} if token else {})})
    try:
        with urllib.request.build_opener(NoRedirect).open(request, timeout=15) as response:
            code = response.status
            data = json.loads(response.read(2_000_000))
    except urllib.error.HTTPError as error:
        code, data = error.code, {}
    except Exception as error:
        return {'passed':False, 'error':type(error).__name__}
    return {'passed':bool(predicate(code,data)), 'httpStatus':code}

def run(output, apk=None, acceptance=None):
    checks = {}
    manifest = ET.parse(PROJECT/'app/src/main/AndroidManifest.xml').getroot()
    app = manifest.find('application')
    activities = app.findall('activity')
    checks['manifest'] = {'passed':app.get(NS+'allowBackup') == 'false' and app.get(NS+'usesCleartextTraffic') == 'false'
        and all(a.get(NS+'exported') == 'false' for a in activities if a.get(NS+'name') != '.MainActivity')}
    resource = PROJECT/'app/src/main/res'
    try:
        for file in resource.rglob('*.xml'):
            if not file.name.startswith('._'): ET.parse(file)
        checks['resourceXML'] = {'passed':True}
    except ET.ParseError:
        checks['resourceXML'] = {'passed':False}
    sdk = Path.home()/'Library/Android/sdk'
    checks['sdk'] = {'passed':(sdk/'platforms/android-36/android.jar').is_file()
        and (sdk/'build-tools/36.0.0/apksigner').is_file(), 'licenseAccepted':(sdk/'licenses/android-sdk-license').is_file()}
    signing = Path.home()/'.config/eva-app/android-signing.properties'
    checks['privateSigningConfig'] = {'passed':signing.is_file() and not (PROJECT/'signing.local.properties').exists()}
    apk = (apk or PROJECT/'app/build/outputs/apk/release/app-release.apk').resolve()
    apk_sha = hashlib.sha256(apk.read_bytes()).hexdigest() if apk.is_file() else None
    artifact = {'passed':False, 'path':str(apk), 'apkExists':apk.is_file(), 'sha256':apk_sha}
    signer = sdk/'build-tools/36.0.0/apksigner'
    if apk.is_file() and signer.is_file():
        result = subprocess.run([str(signer),'verify','--verbose','--print-certs',str(apk)],capture_output=True,text=True)
        cert = re.search(r'certificate SHA-256 digest:\s*([a-fA-F0-9]+)',result.stdout)
        expected = json.loads((ANDROID/'备案资料/20261002/备案特征信息.json').read_text())['certificate_sha256']
        artifact.update(passed=result.returncode == 0 and bool(cert) and cert.group(1).upper() == expected,
            certificateMatchesFiling=bool(cert) and cert.group(1).upper() == expected)
    checks['signedAPK'] = artifact
    checks['publicCourses'] = http_check('mini/public/series',lambda c,d:c == 200 and d.get('success') is True and isinstance(d.get('data'),list))
    checks['appConfig'] = http_check('app/v1/config',lambda c,d:c == 200 and d.get('success') is True and d.get('data',{}).get('version') == 1)
    checks['appProducts'] = http_check('app/v1/shop/products',lambda c,d:c == 200 and d.get('success') is True and isinstance(d.get('data',{}).get('products'),list))
    checks['invalidSessionDenied'] = http_check('app/v1/member/profile',lambda c,d:c == 401,True)
    evidence_path = acceptance or ANDROID/'上线准备/manual-acceptance.json'
    evidence = json.loads(evidence_path.read_text()) if evidence_path.is_file() else {}
    checks['deviceAcceptance'] = {'passed':bool(apk_sha) and evidence.get('apkSHA256') == apk_sha and
        all(evidence.get(k) is True for k in ['nativeUI','loginLogout','courseAuthorization','playbackProgress','notesBookmarks','profile','orders','events','privacyDeletion'])}
    checks['filingAndStoreMaterial'] = {'passed':evidence.get('filingVerified') is True and evidence.get('storeMaterialVerified') is True}
    blockers = [key for key,value in checks.items() if not value['passed']]
    report = {'status':'READY_FOR_RELEASE_REVIEW' if not blockers else 'NOT_READY',
        'packageName':'cn.com.swod.app', 'versionName':'1.0.0','versionCode':5,
        'productionWrites':False,'checks':checks,'blockers':blockers}
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'status':report['status'],'blockers':blockers,'report':str(output)},ensure_ascii=False))
    return 1 if blockers else 0

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--apk',type=Path,help='Check the exact distribution APK instead of the build output')
    parser.add_argument('--acceptance',type=Path,help='Acceptance record tied to that APK SHA-256')
    args = parser.parse_args()
    raise SystemExit(run(args.output.resolve(), args.apk, args.acceptance))
