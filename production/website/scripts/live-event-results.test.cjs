const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
test('public results refresh within five seconds and on return, pause when hidden, and clean up listeners',()=>{
 const originalWindow=global.window,originalDocument=global.document;let timer,delay,cleanup,count=0,cleared=false;const listeners=new Map();
 global.window={setInterval:(fn,ms)=>{timer=fn;delay=ms;return 7},clearInterval:id=>{assert.equal(id,7);cleared=true},addEventListener:(key,fn)=>listeners.set('window:'+key,fn),removeEventListener:(key,fn)=>{assert.equal(listeners.get('window:'+key),fn);listeners.delete('window:'+key)}};
 global.document={visibilityState:'visible',addEventListener:(key,fn)=>listeners.set(key,fn),removeEventListener:(key,fn)=>{assert.equal(listeners.get(key),fn);listeners.delete(key)}};
 try{
 const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync('src/components/events/LiveEventResultsRefresh.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(name=>name==='react'?{useEffect:fn=>cleanup=fn()}:{useRouter:()=>({refresh:()=>count++})},mod,mod.exports);
 mod.exports.default();assert.equal(delay,5000);timer();assert.equal(count,1);document.visibilityState='hidden';timer();assert.equal(count,1);document.visibilityState='visible';listeners.get('visibilitychange')();listeners.get('window:focus')();assert.equal(count,3);cleanup();assert.equal(cleared,true);assert.equal(listeners.size,0);
 }finally{global.window=originalWindow;global.document=originalDocument}
});
test('public scoreboard HTML and group routes forbid shared caching',()=>{
 const mod={exports:{}};new Function('require','module','exports',ts.transpileModule(fs.readFileSync('src/proxy.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText)(name=>{
 if(name==='next/server')return {NextResponse:{next:()=>new Response(null),redirect:(url,status)=>new Response(null,{status,headers:{Location:String(url)}})}};
 if(name.endsWith('legacy-browser'))return {shouldUseLegacyProfile:()=>false};if(name.endsWith('mobile-course-navigation'))return {getMobileCourseVideoPath:()=>null};return {};
 },mod,mod.exports);
 for(const path of ['/event-results/100060','/events/event-2026-100060','/events/event-2026-100060/groups/203944']){
  const response=mod.exports.proxy({nextUrl:new URL('https://www.swod.com.cn'+path),method:'GET',headers:new Headers()});assert.match(response.headers.get('Cache-Control'),/no-store/);assert.doesNotMatch(response.headers.get('Cache-Control'),/s-maxage=300/);
 }
});
