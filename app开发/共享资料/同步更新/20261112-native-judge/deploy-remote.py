from pathlib import Path
import hashlib,json,shutil,subprocess,urllib.request,time,sqlite3
base=Path('/www/wwwroot/dongfangwuquan');root=base/'admin-platform';stage=base/'releases/native-judge-20261112'
files=list(json.loads((stage/'baseline.json').read_text()))
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
for n,h in json.loads((stage/'baseline.json').read_text()).items():assert digest(root/n)==h,'Concurrent target change: '+n
for p in (root/'src').rglob('*'):
 if p.is_file():
  n=str(p.relative_to(root))
  if n not in files:assert (stage/n).exists() and digest(p)==digest(stage/n),'Concurrent source change: '+n
old=json.loads((root/'.next-build/server/app-paths-manifest.json').read_text());new=json.loads((stage/'.next-build/server/app-paths-manifest.json').read_text());assert set(old)<=set(new),'Missing routes'
assert (stage/'.next-build/BUILD_ID').exists()
backup=base/'deploy-backups/native-judge-20261112';backup.mkdir(exist_ok=False)
with sqlite3.connect(root/'admin.db') as source,sqlite3.connect(backup/'before-deploy.db') as target:
 source.backup(target);assert target.execute('PRAGMA quick_check').fetchone()[0]=='ok'
for n in files:
 p=backup/n;p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/n,p)
subprocess.run(['rsync','-a','--ignore-existing',str(root/'.next-build/static')+'/',str(stage/'.next-build/static')+'/'],check=True)
def health():
 for i in range(30):
  try:
   with urllib.request.urlopen('http://127.0.0.1:3003/api/mini/events',timeout=10) as r:assert r.status==200
   return
  except Exception:
   if i==29:raise
   time.sleep(1)
try:
 subprocess.run(['pm2','stop','admin-platform'],check=True,stdout=subprocess.DEVNULL)
 (root/'.next-build').rename(backup/'build')
 (stage/'.next-build').rename(root/'.next-build')
 for n in files:shutil.copy2(stage/n,root/n)
 subprocess.run(['pm2','restart','admin-platform'],check=True,stdout=subprocess.DEVNULL)
 health()
except:
 subprocess.run(['pm2','stop','admin-platform'],stdout=subprocess.DEVNULL)
 if (backup/'build').exists():
  if (root/'.next-build').exists():(root/'.next-build').rename(stage/'.next-build-failed')
  (backup/'build').rename(root/'.next-build')
 for n in files:shutil.copy2(backup/n,root/n)
 subprocess.run(['pm2','restart','admin-platform'],stdout=subprocess.DEVNULL)
 raise
result={'buildId':(root/'.next-build/BUILD_ID').read_text().strip(),'backup':str(backup),'health':'passed','files':{n:digest(root/n) for n in files}}
(stage/'deployment-result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))
