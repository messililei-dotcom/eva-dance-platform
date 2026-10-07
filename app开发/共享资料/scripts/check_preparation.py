"""Read-only local readiness check. No login, SMS, token exchange, deployment or secret output."""
from pathlib import Path
import json, shutil, subprocess, ssl, urllib.request, urllib.error, datetime
ROOT=Path(__file__).resolve().parents[2]
CONFIG=ROOT/'共享资料/上线准备/平台配置.json'
OUTPUT=ROOT/'共享资料/上线准备/20261003/准备检查.json'
config=json.loads(CONFIG.read_text())
rows=[]
def record(name,state,detail): rows.append({'item':name,'state':state,'detail':detail})
for key,p in config['platforms'].items():
    if key=='h5':
        record('h5.scheme','prepared',p['schemeCode']);continue
    local=Path.home()/f'.config/eva-app/{key}-number-auth.json'
    if not local.exists():record(key+'.carrierConfig','missing','私有配置不存在');continue
    private=json.loads(local.read_text())
    identity=private.get('bundleID') or private.get('packageName') or private.get('bundleName')
    good=identity==p['applicationID'] and private.get('schemeCode')==p['schemeCode'] and bool(private.get('sdkSecret'))
    record(key+'.carrierConfig','prepared' if good else 'mismatch','应用标识、方案号、SDK配置存在性核验；不输出密钥')
for name,path in [('xcode','/Applications/Xcode.app'),('androidStudio','/Applications/Android Studio.app'),('devecoStudio','/Applications/DevEco-Studio.app')]:
    found=Path(path).exists()
    if name=='devecoStudio':found=found or any(Path('/Applications').glob('*DevEco*'))
    record(name,'installed' if found else 'missing',path)
java=subprocess.run(['/usr/libexec/java_home'],capture_output=True,text=True)
record('java','installed' if java.returncode==0 else 'missing','java_home 检查')
for key,directory in [('android','Android'),('harmony','HarmonyOS')]:
    project=ROOT/directory/'EvaDance'
    record(key+'.clientProject','exists' if project.exists() else 'missing','尚未检出客户端工程' if not project.exists() else str(project))
for key,url in [('publicCourses',config['publicAPIBase']+'/public/series'),('appConfig',config['apiBase']+'/config')]:
    try:
        with urllib.request.urlopen(url,timeout=15) as response:
            data=json.loads(response.read(2_000_000))
            record(key,'reachable',{'status':response.status,'success':data.get('success'),'note':'只核验公开接口响应，不代表登录或播放通过'})
    except urllib.error.HTTPError as error:record(key,'blocked',{'status':error.code})
    except Exception as error:record(key,'unverified',type(error).__name__)
report={'asOf':datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat(),'releaseReady':False,'checks':rows,'notTested':['真实短信及号码认证','三端实际安装包签名','微信登录回调','付费课程播放及安全离线','支付退款','应用商店审核']}
OUTPUT.write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
