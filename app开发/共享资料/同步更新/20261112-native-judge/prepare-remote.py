from pathlib import Path
import shutil,json,hashlib,sqlite3
root=Path('/www/wwwroot/dongfangwuquan/admin-platform');stage=root.parent/'releases/native-judge-20261112'
stage.mkdir(exist_ok=False)
for name in ['src','tests']:
 if (root/name).exists():shutil.copytree(root/name,stage/name)
for p in root.iterdir():
 if p.is_file() and (p.suffix in ['.json','.js','.ts','.mjs'] or p.name.startswith('.env')) and p.name!='tsconfig.tsbuildinfo':shutil.copy2(p,stage/p.name)
for name in ['node_modules','public','data','private']:
 if (root/name).exists():(stage/name).symlink_to(root/name,target_is_directory=True)
with sqlite3.connect('file:'+str(root/'admin.db')+'?mode=ro',uri=True) as source,sqlite3.connect(stage/'admin.db') as copy:source.backup(copy);assert copy.execute('PRAGMA quick_check').fetchone()[0]=='ok'
f='src/lib/server/app-route-map.ts';(stage/'baseline.json').write_text(json.dumps({f:hashlib.sha256((root/f).read_bytes()).hexdigest()}))
p=stage/f;s=p.read_text();needle='const routes: Entry[] = [';assert needle in s
entry='  {pattern:/^events\\/([1-9]\\d*)\\/judge$/,methods:["GET", "POST"],public:false,load:()=>import("@/app/api/mini/events/[id]/judge/route")},'
assert '/judge$/' not in s
p.write_text(s.replace(needle,needle+'\n'+entry,1));print(str(stage))
