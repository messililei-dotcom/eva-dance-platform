"""User-authorized official ADB navigation and unedited screenshot capture. Guest only."""
from pathlib import Path
import subprocess, xml.etree.ElementTree as E, re, json, hashlib
ADB='/Users/lilei/Library/Android/sdk/platform-tools/adb'
ROOT=Path(__file__).resolve().parent
SCREENSHOTS=ROOT.parent.parent/'materials/screenshots-build12'
def run(*args):
 return subprocess.check_output([ADB,'-s','emulator-5554',*args])
def state():
 run('shell','uiautomator','dump','/sdcard/swod-market.xml')
 raw=run('shell','cat','/sdcard/swod-market.xml')
 return raw,list(E.fromstring(raw).iter('node'))
def summary():
 _,ns=state()
 print('\n'.join((n.get('text') or n.get('content-desc'))+' '+n.get('bounds','') for n in ns if n.get('text') or n.get('content-desc')))
def tap(label):
 raw,ns=state();hits=[n for n in ns if n.get('text')==label or n.get('content-desc')==label]
 assert hits, 'Label not present: '+label
 n=hits[-1];a,b,c,d=map(int,re.findall(r'\d+',n.get('bounds')))
 run('shell','input','tap',str((a+c)//2),str((b+d)//2))
def capture(name,market=True):
 raw,ns=state();texts='\n'.join(n.get('text','') for n in ns)
 assert '测试2026' not in texts and '权益回归课程' not in texts
 png=run('exec-out','screencap','-p');dest=(SCREENSHOTS if market else ROOT)/(name+'.png');dest.write_bytes(png)
 (ROOT/(name+'.xml')).write_bytes(raw)
 return {'name':name,'file':str(dest),'sha256':hashlib.sha256(png).hexdigest(),'bytes':len(png),'texts':texts}
if __name__=='__main__':summary()
