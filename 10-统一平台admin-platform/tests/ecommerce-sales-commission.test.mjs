import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { DatabaseSync } from 'node:sqlite';

function load(path, mocks = {}) {
  const module = {exports:{}};
  const code = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  new Function('require','module','exports',code)(name => {
    if (name in mocks) return mocks[name];
    throw Error(name);
  },module,module.exports);
  return module.exports;
}
const commission = load('../src/lib/sale-commission.ts');
function fixture() {
  const sqlite = new DatabaseSync(':memory:');
  const db = {exec:sql=>sqlite.exec(sql),prepare:sql=>sqlite.prepare(sql),close:()=>{},transaction:fn=>(...args)=>{
    const nested=sqlite.isTransaction;
    if(!nested)sqlite.exec('BEGIN');
    try { const result=fn(...args);if(!nested)sqlite.exec('COMMIT');return result; }
    catch(error) {if(!nested)sqlite.exec('ROLLBACK');throw error;}
  }};
  const schema = load('../src/app/api/ecommerce/_db.ts', {'@/lib/server/admin-db':{openAdminDb:()=>db},'../_local-auth':{verifyLocalToken:()=>null}});
  schema.ensureCommerceTables(db);
  db.prepare("INSERT INTO shop_products(id,name,sale_price,stock) VALUES('p','测试商品',149,5)").run();
  const mocks = {'@/lib/sale-commission':commission,'../_db':{hasAuth:()=>true,openCommerceDb:()=>db},'../../_db':{hasAuth:()=>true,openCommerceDb:()=>db}};
  return {sqlite,db,create:load('../src/app/api/ecommerce/sales/route.ts',mocks).POST,edit:load('../src/app/api/ecommerce/sales/[id]/route.ts',mocks).PUT,schema};
}
const request = body=>new Request('https://example.test/api/ecommerce/sales',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
test('提成以实收金额计算，支持 0 和 100 百分比并四舍五入到分',()=>{
  assert.equal(commission.calculateSaleCommission(149,25),37.25);
  assert.equal(commission.calculateSaleCommission(99.99,12.5),12.5);
  assert.equal(commission.calculateSaleCommission(0,25),0);
  assert.equal(commission.calculateSaleCommission(149,100),149);
  assert.equal(commission.saleCommissionFields({salesAdvisor:' 顾问 ',commissionRate:25,commissionAmount:999},149).commissionAmount,37.25);
});
test('迁移可重复执行，新增销售保存顾问、比例、提成并扣库存',async()=>{
 const f=fixture();
 try {
  f.schema.ensureCommerceTables(f.db);
  const response=await f.create(request({productId:'p',quantity:2,amount:250,salesAdvisor:'测试顾问',commissionRate:12.5,commissionAmount:999}));
  assert.equal(response.status,200);
  const sale=f.db.prepare('SELECT * FROM shop_sales').get();
  assert.equal(sale.sales_advisor,'测试顾问');assert.equal(sale.commission_rate,12.5);assert.equal(sale.commission_amount,31.25);
  assert.equal(f.db.prepare("SELECT stock FROM shop_products WHERE id='p'").get().stock,3);
 } finally {f.sqlite.close();}
});
test('编辑金额重算提成，未传顾问比例时保留，零实收不回退单价',async()=>{
 const f=fixture();
 try {
  await f.create(request({productId:'p',quantity:1,amount:149,salesAdvisor:'测试顾问',commissionRate:25}));
  assert.equal((await f.edit(request({amount:80}),{params:Promise.resolve({id:'1'})})).status,200);
  let sale=f.db.prepare('SELECT * FROM shop_sales WHERE id=1').get();
  assert.equal(sale.sales_advisor,'测试顾问');assert.equal(sale.commission_rate,25);assert.equal(sale.commission_amount,20);
  await f.edit(request({amount:0}),{params:Promise.resolve({id:'1'})});
  sale=f.db.prepare('SELECT * FROM shop_sales WHERE id=1').get();
  assert.equal(sale.total_amount,0);assert.equal(sale.commission_amount,0);
 } finally {f.sqlite.close();}
});
test('非法比例或缺少顾问时拒绝保存，不扣库存或改销售',async()=>{
 const f=fixture();
 try {
  for(const fields of [{commissionRate:-1},{commissionRate:101},{commissionRate:'bad'},{commissionRate:10},{commissionRate:10,salesAdvisor:'   '}]){
   assert.equal((await f.create(request({productId:'p',quantity:1,amount:149,...fields}))).status,400);
  }
  assert.equal(f.db.prepare('SELECT count(*) AS n FROM shop_sales').get().n,0);
  assert.equal(f.db.prepare("SELECT stock FROM shop_products WHERE id='p'").get().stock,5);
  await f.create(request({productId:'p',quantity:1,amount:149}));
  assert.equal((await f.edit(request({quantity:3,commissionRate:150}),{params:Promise.resolve({id:'1'})})).status,400);
  assert.equal(f.db.prepare("SELECT stock FROM shop_products WHERE id='p'").get().stock,4);
  assert.equal(f.db.prepare('SELECT quantity FROM shop_sales WHERE id=1').get().quantity,1);
 } finally {f.sqlite.close();}
});
