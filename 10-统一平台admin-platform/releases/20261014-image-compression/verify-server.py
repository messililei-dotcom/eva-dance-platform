import json,hashlib,subprocess,urllib.parse,os
from pathlib import Path
root=Path('/var/lib/eva-image-compression')
s=json.loads((root/'latest.json').read_text())
assert not s['dryRun'] and not s['errors'],s['errors']
assert not any(r['status']=='concurrent-change' for r in s['rows'])
assert subprocess.check_output(['systemctl','show','eva-image-compression.service','-p','Result','--value'],text=True).strip()=='success'
(root/'initial-20261014.json').write_text(json.dumps(s,ensure_ascii=False,indent=2))
checked=0
for r in s['rows']:
 if r['status']!='compressed':continue
 b=Path(r['filename']).read_bytes()
 assert len(b)==r['after'] and hashlib.sha256(b).hexdigest()==r['afterHash'],r['filename']
 checked+=1
samples=[]
for category in ['/uploads/event-covers/','/uploads/training-courses/','/uploads/online-course/series-covers/','/images/courses/','/images/reports/','/icons/pwa/']:
 r=next((r for r in s['rows'] if r['status']=='compressed' and category in r['filename']),None)
 if not r:continue
 host='admin.swod.com.cn' if '/admin-platform/' in r['filename'] else 'www.swod.com.cn'
 url='https://'+host+'/'+urllib.parse.quote(r['filename'].split('/public/')[1])+'?image-compression-check=20261014'
 b=subprocess.check_output(['curl','-fsS','--max-time','30','--resolve',host+':443:127.0.0.1',url])
 assert hashlib.sha256(b).hexdigest()==r['afterHash'],url
 samples.append({'category':category,'status':200,'bytes':len(b),'hashMatched':True})
health=[]
for host,url in [('admin.swod.com.cn','https://admin.swod.com.cn/login'),('www.swod.com.cn','https://www.swod.com.cn/')]:
 status=subprocess.check_output(['curl','-sS','--max-time','30','--resolve',host+':443:127.0.0.1','-o','/dev/null','-w','%{http_code}',url],text=True)
 assert status=='200';health.append({'host':host,'status':int(status)})
result={k:v for k,v in s.items() if k!='rows'}
result.update({'savedBytes':s['beforeBytes']-s['afterBytes'],'savedPercent':round((s['beforeBytes']-s['afterBytes'])/s['beforeBytes']*100,2),'compressedFilesHashChecked':checked,'publicSamples':samples,'health':health,'sourceSha256':hashlib.sha256(Path('/usr/local/lib/eva-image-compression/compress-server-images.cjs').read_bytes()).hexdigest()})
(root/'verification-20261014.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,ensure_ascii=False))
