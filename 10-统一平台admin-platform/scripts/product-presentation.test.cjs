const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Database=require('better-sqlite3');
function load(file, requireFn) {
 const m={exports:{}};
 const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 new Function('require','exports','module',code)(requireFn,m.exports,m);return m.exports;
}
const presentation=load('src/lib/product-presentation.ts', require);
function fixture() {
 const db=new Database(':memory:');
 const context={hasAuth:()=>true,openCommerceDb:()=>({...db,prepare:db.prepare.bind(db),transaction:db.transaction.bind(db),close(){}}),unauthorized:()=>Response.json({error:'未登录'},{status:401})};
 load('src/app/api/ecommerce/_db.ts',()=>({})).ensureCommerceTables(db);
 const route=file=>load('src/app/api/ecommerce/'+file,id=>id.includes('product-presentation')?presentation:context);
 return {db,route,context};
}
const req=(method,body)=>new Request('http://localhost/local-api/ecommerce/products',{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
test('商品创建、展示字段更新及清空保留每个规格的库存价格',async()=>{
 const {db,route}=fixture();try {
  const response=await route('products/route.ts').POST(req('POST',{id:'sku',name:'长裤-黑',stock:8,sale_price:169,group_name:'练习长裤',storefront_category:'练习舞服',detail_text:'实际商品描述'}));
  assert.equal(response.status,200);
  const update=route('products/[id]/route.ts');
  assert.equal((await update.PUT(req('PUT',{detail_text:'更新详情',group_name:''}),{params:Promise.resolve({id:'sku'})})).status,200);
  const row=db.prepare('SELECT * FROM shop_products').get();assert.equal(row.stock,8);assert.equal(row.sale_price,169);assert.equal(row.group_name,'');assert.equal(row.storefront_category,'练习舞服');assert.equal(row.detail_text,'更新详情');
 }finally{db.close();}
});
test('无效详情图片在写入前被拒绝；未登录无权修改',async()=>{
 const {db,route,context}=fixture();try{
  assert.equal((await route('products/route.ts').POST(req('POST',{name:'测试',detail_images:'javascript:alert(1)'}))).status,400);
  assert.equal(db.prepare('SELECT count(*) n FROM shop_products').get().n,0);
  context.hasAuth=()=>false;
  assert.equal((await route('products/route.ts').POST(req('POST',{name:'测试'}))).status,401);
 }finally{db.close();}
});
test('新增颜色尺码继承商城分组详情，库存分别入账',async()=>{
 const {db,route}=fixture();try{
  await route('products/route.ts').POST(req('POST',{id:'base',name:'练习裤',category:'裤子',spec:'基础款',color:'黑',size:'S',stock:4,sale_price:169,group_name:'A1练习裤',storefront_category:'舞服',detail_text:'商品详情'}));
  const result=await route('stock-in/route.ts').POST(req('POST',{product_id:'base',name:'练习裤',category:'裤子',spec:'基础款',color:'紫',size:'M',quantity:3,sale_price:179}));assert.equal(result.status,200);
  const rows=db.prepare('SELECT * FROM shop_products ORDER BY id').all();assert.equal(rows.length,2);assert.equal(rows[0].stock,4);assert.equal(rows[1].stock,3);assert.equal(rows[1].group_name,'A1练习裤');assert.equal(rows[1].detail_text,'商品详情');
 }finally{db.close();}
});
