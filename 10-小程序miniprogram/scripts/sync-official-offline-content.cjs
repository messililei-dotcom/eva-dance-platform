// Generate mini-program presentation copy from the website; never copy sale prices or rights.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),website=path.join(root,'02-官方网站工程设计/官方网站');
const ts=require(path.join(root,'10-统一平台admin-platform/node_modules/typescript'));
function load(file){const m={exports:{}};const text=fs.readFileSync(file,'utf8');const code=ts.transpileModule(text,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;new Function('exports','module',code)(m.exports,m);return m.exports;}
(async()=>{
 const config=path.join(website,'src/config/courses.ts'),detail=path.join(website,'src/app/offline/[id]/page.tsx');
 const all=load(config).courses,match=load(path.join(website,'src/lib/course-match.ts'));
 const source=ts.createSourceFile(detail,fs.readFileSync(detail,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let overrideText;
 for(const statement of source.statements)if(ts.isVariableStatement(statement))for(const v of statement.declarationList.declarations)if(v.name.getText(source)==='platformCourseIntroOverrides')overrideText=v.initializer.getText(source);
 if(!overrideText)throw Error('Official offline introduction overrides not found');
 const overrides=vm.runInNewContext('('+overrideText+')');
 const fields=c=>({title:c.title,description:c.description||'',fullDescription:c.fullDescription||'',outline:c.outline||[],level:c.level||''});
 const courses=Object.fromEntries(all.filter(c=>c.category==='offline').map(c=>[c.id,fields(c)]));
 const response=await fetch('https://www.swod.com.cn/api/platform-offline-courses',{signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Official catalogue unavailable');const body=await response.json();if(!Array.isArray(body.data))throw Error('Invalid official catalogue');
 const aliases={};for(const row of body.data){const id=String(row.legacyCourseId||'');if(courses[id])aliases[row.officialMatchKey||match.normalizeCourseKey(row.title)]=id;}
 const result={source:'official website courses and offline detail introductions',sourceHash:crypto.createHash('sha256').update(fs.readFileSync(config)).update(overrideText).digest('hex'),courses,aliases,periodOverrides:Object.fromEntries(Object.entries(overrides).map(([id,c])=>[id,fields(c)]))};
 const target=path.resolve(__dirname,'../shared/official-offline-content.js'),text='// Generated from the official website; run scripts/sync-official-offline-content.cjs to refresh.\nmodule.exports = '+JSON.stringify(result,null,2)+';\n';if(process.argv.includes('--check')){if(fs.readFileSync(target,'utf8')!==text)throw Error('Official offline copy changed; run sync-official-offline-content.cjs');}else fs.writeFileSync(target,text);
 console.log(JSON.stringify({courses:Object.keys(courses).length,aliases:Object.keys(aliases).length,periodOverrides:Object.keys(overrides).length,bytes:Buffer.byteLength(text),check:process.argv.includes('--check')}));
})().catch(e=>{console.error(e.message);process.exit(1)});
