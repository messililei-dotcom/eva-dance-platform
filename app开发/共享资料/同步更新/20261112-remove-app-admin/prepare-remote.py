from pathlib import Path
import shutil,json,hashlib,sqlite3
root=Path('/www/wwwroot/dongfangwuquan/admin-platform');stage=root.parent/'releases/remove-app-admin-20261112'
stage.mkdir(exist_ok=False)
for name in ['src','tests']:
 if (root/name).exists():shutil.copytree(root/name,stage/name)
for p in root.iterdir():
 if p.is_file() and (p.suffix in ['.json','.js','.ts','.mjs'] or p.name.startswith('.env')) and p.name!='tsconfig.tsbuildinfo':shutil.copy2(p,stage/p.name)
for name in ['node_modules','public','data','private']:
 if (root/name).exists():(stage/name).symlink_to(root/name,target_is_directory=True)
with sqlite3.connect('file:'+str(root/'admin.db')+'?mode=ro',uri=True) as source,sqlite3.connect(stage/'admin.db') as copy:source.backup(copy);assert copy.execute('PRAGMA quick_check').fetchone()[0]=='ok'
files=['src/middleware.ts','src/lib/native-management-access.ts']
(stage/'baseline.json').write_text(json.dumps({n:hashlib.sha256((root/n).read_bytes()).hexdigest() if (root/n).exists() else None for n in files}))
p=stage/'src/middleware.ts';s=p.read_text();assert 'blocksNativeManagement' not in s
s=s.replace("import { NextRequest, NextResponse } from 'next/server';", "import { NextRequest, NextResponse } from 'next/server';\nimport { blocksNativeManagement } from './lib/native-management-access';",1)
s=s.replace('  const { pathname } = request.nextUrl;', "  const { pathname } = request.nextUrl;\n  if (blocksNativeManagement(pathname, request.headers.get('x-client-platform'))) {\n    return NextResponse.json({ success: false, error: 'App 不提供后台管理，请使用网页后台' }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } });\n  }",1)
p.write_text(s);print(str(stage))
