const fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const dir=path.resolve('.push-worker');fs.mkdirSync(dir,{recursive:true,mode:0o700});
fs.writeFileSync(path.join(dir,'package.json'),'{"type":"commonjs"}');
const compile=source=>ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
for(const name of ['admin-db','app-session','inbox','app-push','aliyun-push'])fs.writeFileSync(path.join(dir,name+'.js'),compile(fs.readFileSync('src/lib/server/'+name+'.ts','utf8')));
fs.writeFileSync(path.join(dir,'worker.cjs'),compile(fs.readFileSync('scripts/app-push-worker.ts','utf8').replaceAll('../src/lib/server/','./')));
console.log('Push worker built; starting it does not enable delivery.');
