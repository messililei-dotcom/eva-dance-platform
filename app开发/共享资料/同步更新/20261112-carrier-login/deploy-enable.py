from pathlib import Path
from datetime import datetime, timezone
import os,json,hashlib,subprocess,time,urllib.request,urllib.error,shutil
root=Path('/www/wwwroot/dongfangwuquan/admin-platform')
config=root/'.env.production'
assert hashlib.sha256(config.read_bytes()).hexdigest()=='a6492407327a4b5fbe8a47df6a1349330e79482ad6b5752c1f4af2978ac9aad6','Production environment changed; inspect before deploying'
assert hashlib.sha256((root/'src/lib/server/app-carrier-auth.ts').read_bytes()).hexdigest()=='6a4fa02b47730a4e52c2278e5d951c92faf56c64dd899b4f511a010885af4e6b','Carrier implementation changed'
old_build=(root/'.next-build/BUILD_ID').read_text().strip()
processes=json.loads(subprocess.check_output(['pm2','jlist']))
process=next(p for p in processes if p['name']=='admin-platform')
old_flag=process['pm2_env'].get('APP_ONE_TAP_ENABLED')
backup=root.parent/'deploy-backups'/('carrier-login-'+datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ'))
backup.mkdir(parents=True,mode=0o700,exist_ok=False)
shutil.copy2(config,backup/'env.production.before');os.chmod(backup/'env.production.before',0o600)
dump=Path.home()/'.pm2/dump.pm2'
if dump.exists():shutil.copy2(dump,backup/'pm2-dump.before');os.chmod(backup/'pm2-dump.before',0o600)
original=config.read_text()
lines=[line for line in original.splitlines() if not line.strip().startswith('APP_ONE_TAP_ENABLED=')]
lines.append('APP_ONE_TAP_ENABLED=true')
result={'checkedAt':datetime.now(timezone.utc).isoformat(),'backup':str(backup),'buildId':old_build,'priorRuntimeFlag':old_flag,'changedKeys':['APP_ONE_TAP_ENABLED'],'nativePackageChanged':False,'secretsPrinted':False}
def restart(value):
 env=os.environ.copy();env['APP_ONE_TAP_ENABLED']=value
 subprocess.run(['pm2','restart','admin-platform','--update-env'],env=env,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
def read_config():
 req=urllib.request.Request('http://127.0.0.1:3003/api/app/v1/config',headers={'x-client-platform':'ios'})
 with urllib.request.urlopen(req,timeout=10) as response:return json.load(response)['data']
try:
 temporary=config.with_name('.env.production.carrier-new');temporary.write_text('\n'.join(lines)+'\n');os.chmod(temporary,config.stat().st_mode&0o777);os.replace(temporary,config)
 restart('true')
 for i in range(30):
  try:
   data=read_config();assert data['oneTapLogin'] is True;assert data['offlineDownload'] is False;assert not data['push']['enabled'];break
  except Exception:
   if i==29:raise
   time.sleep(1)
 assert (root/'.next-build/BUILD_ID').read_text().strip()==old_build
 subprocess.run(['pm2','save'],check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
 result['health']={'oneTapLogin':data['oneTapLogin'],'offlineDownload':data['offlineDownload'],'pushEnabled':data['push']['enabled']}
 result['status']='deployed'
except Exception:
 shutil.copy2(backup/'env.production.before',config);restart(old_flag or 'false')
 result['status']='rolled-back';(backup/'result.json').write_text(json.dumps(result,indent=2));raise
(backup/'result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
