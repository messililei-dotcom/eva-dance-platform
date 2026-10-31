const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const ts=require(path.resolve(__dirname,'../../../../10-统一平台admin-platform/node_modules/typescript'));
const moduleObject={exports:{}};
new Function('module','exports',ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../entry/src/main/ets/services/CacheClock.ets'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(moduleObject,moduleObject.exports);
const trusted=moduleObject.exports.trustedCacheTime;
test('sleep-inclusive elapsed time expires at 24h without using editable wall time',()=>{assert.equal(trusted({server:1000,elapsed:2000,boot:'1'},86402000,'1'),86401000);});
test('reboot, unavailable boot identity and backwards elapsed time fail closed',()=>{for(const [anchor,elapsed,boot] of [[{server:1000,elapsed:2000,boot:'1'},3000,'2'],[{server:1000,elapsed:2000,boot:''},3000,''],[{server:1000,elapsed:2000,boot:'1'},1000,'1'],[{server:NaN,elapsed:2000,boot:'1'},3000,'1']])assert.ok(Number.isNaN(trusted(anchor,elapsed,boot)));});
