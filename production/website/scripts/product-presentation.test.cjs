const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load(file) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }}).outputText;
  const mod = {exports:{}}; new Function('exports', 'module', output)(mod.exports, mod); return mod.exports;
}
const { groupCatalog, productShareDescription } = load('src/lib/product-presentation.ts');
const { parseProductPresentation } = load(require('node:path').join(process.env.SHOP_ADMIN_TEST_ROOT || '../../10-统一平台admin-platform', 'src/lib/product-presentation.ts'));
const sku = (id, extra={}) => ({id,name:'长裤',category:'舞服',spec:'基础款',size:'M',color:'黑色',priceFen:16900,stock:3,image:'',...extra});
test('未设置商品组时同名商品独立展示，显式分组不跨分类', () => {
  assert.equal(groupCatalog([sku('a'),sku('b')]).length,2);
  assert.equal(groupCatalog([sku('a',{groupName:'练习裤'}),sku('b',{groupName:'练习裤',category:'配饰'})]).length,2);
});
test('多规格合并展示总库存、价格范围，同时保留原SKU和库存', () => {
  const rows=[sku('a',{groupName:'练习裤',stock:0}),sku('b',{groupName:'练习裤',color:'紫色',size:'S',priceFen:18900,stock:7,image:'/image.jpg'})];
  const [group]=groupCatalog(rows); assert.equal(group.id,'b'); assert.equal(group.stock,7); assert.equal(group.priceFen,16900); assert.equal(group.maxPriceFen,18900); assert.equal(group.variants[0].stock,0); assert.equal(rows[0].stock,0);
});
test('分享只取公开价格规格，不包含传入的个人资料', () => {
  const text=productShareDescription({...sku('a'),token:'secret',phone:'13800000000',recipient:'某用户'});
  assert.match(text,/¥169.00/); assert.match(text,/M/); assert.doesNotMatch(text,/secret|13800000000|某用户/);
});
test('商城展示字段可清空，拒绝脚本、非图片路径和过多图片', () => {
  assert.deepEqual(parseProductPresentation({group_name:'',stock:999}).values,{group_name:''});
  assert.ok(parseProductPresentation({detail_images:'javascript:alert(1)'}).error);
  assert.ok(parseProductPresentation({detail_images:'/api/private'}).error);
  assert.ok(parseProductPresentation({detail_images:Array(13).fill('https://example.com/a.jpg').join('\n')}).error);
  assert.equal(parseProductPresentation({detail_images:'/uploads/products/a.jpg\nhttps://example.com/b.jpg'}).error,undefined);
});
