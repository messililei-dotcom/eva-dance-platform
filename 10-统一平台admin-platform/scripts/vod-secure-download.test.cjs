const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
const m={exports:{}};
new Function('require','module','exports',ts.transpileModule(fs.readFileSync('src/lib/server/aliyun-vod.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText)(require,m,m.exports);
const validate=m.exports.validateVodOfflineStreams;
const response=rows=>({VideoBase:{Status:'Normal'},PlayInfoList:{PlayInfo:rows}});
test('missing, clear or mixed cloud streams cannot issue an offline credential',()=>{
 for(const r of [{},response([]),response([{Format:'m3u8',Encrypt:0}]),response([{Format:'m3u8',Encrypt:1},{Format:'mp4',Encrypt:0}]),response([{Format:'mp4'}]),{...response([{Format:'mp4',Encrypt:1}]),VideoBase:{Status:'Transcoding'}}])assert.throws(()=>validate(r));
});
test('only a complete encrypted playable set is eligible',()=>{
 assert.doesNotThrow(()=>validate(response([{Format:'m3u8',Encrypt:'1'},{Format:'mp4',Encrypt:1}])));
 assert.throws(()=>validate(response([{Format:'flv',Encrypt:1}])));
});
