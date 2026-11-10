const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
function button(document, platform='Win32') {
  const hints=[]; let state=0;
  const exports={};
  const jsx=(type,props)=>({type,props});
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/components/PWAFullscreen.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText, {
    exports, document, navigator:{platform}, require:name=>name==='react'?{useEffect(){},useState:()=>[[true,false,''][state++],value=>hints.push(value)]}:name==='react/jsx-runtime'?{jsx,jsxs:jsx}:name==='lucide-react'?{}:{isStandalonePwa:()=>true},
  });
  const tree=exports.default();
  return {click:tree.props.children[0].props.onClick,hints};
}
test('desktop button requests and exits native fullscreen',async()=>{
  let entered=0,exited=0;
  await button({documentElement:{requestFullscreen:async()=>entered++}}).click();
  await button({fullscreenElement:{},exitFullscreen:async()=>exited++}).click();
  assert.equal(entered,1); assert.equal(exited,1);
});
test('unsupported and rejected fullscreen provides keyboard or window instructions',async()=>{
  for(const platform of ['Win32','MacIntel']){
    const result=button({documentElement:{}},platform);await result.click();
    assert.match(result.hints[0],platform==='Win32'?/F11/:/绿色按钮/);
  }
  const result=button({documentElement:{requestFullscreen:async()=>{throw Error('denied')}}});
  await result.click();assert.match(result.hints[0],/F11/);
});
