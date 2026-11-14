const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const ts=require(path.resolve(__dirname,'../../../../10-统一平台admin-platform/node_modules/typescript'));
const root=path.resolve(__dirname,'../../../..');
const receipt=JSON.parse(fs.readFileSync(path.join(root,'app开发/共享资料/同步更新/20261113-bundled-artwork/bundled-manifest.json'),'utf8'));
const source=fs.readFileSync(path.resolve(__dirname,'../entry/src/main/ets/services/BundledArtwork.ets'),'utf8');
const mod={exports:{}};new Function('module','exports','$r',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(mod,mod.exports,value=>value);
test('only exact public cover URLs receive bundled fallback; query changes and private images do not',()=>{
 for(const item of receipt.entries){assert.equal(mod.exports.bundledArtwork(item.url),'app.media.'+path.parse(item.file).name);assert.equal(mod.exports.bundledArtwork(item.url+'?v=new'),'');}
 for(const url of ['https://admin.swod.com.cn/api/member/avatar/a.jpg','https://example.com/cover.jpg','',receipt.entries[0].url.replace('https:','http:')])assert.equal(mod.exports.bundledArtwork(url),'');
});
test('all three native resource copies retain the exact approved public-image bytes',()=>{
 assert.equal(receipt.entries.length,26);assert.ok(receipt.totalBytes<=8*1024*1024);
 const folders=['iOS/EvaDance/Resources/BundledArtwork','Android/EvaDance/app/src/main/assets/bundled-artwork','HarmonyOS/EvaDance/entry/src/main/resources/base/media'];
 for(const item of receipt.entries){assert.ok(!item.file.startsWith('._'));assert.equal(new URL(item.url).search,'');for(const folder of folders){const bytes=fs.readFileSync(path.join(root,'app开发',folder,item.file));assert.equal(bytes.length,item.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),item.sha256);}}
});
