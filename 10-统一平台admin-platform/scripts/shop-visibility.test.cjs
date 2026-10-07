const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Database=require('better-sqlite3');
const db=new Database(':memory:');db.exec("CREATE TABLE shop_products(id TEXT PRIMARY KEY,name TEXT,status TEXT,stock INTEGER,sale_price REAL,cost_price REAL,updated_at TEXT,is_hidden INTEGER DEFAULT 0);INSERT INTO shop_products VALUES('p1','舞服','停售',5,99,50,'v1',0)");
const m={exports:{}};const code=ts.transpileModule(fs.readFileSync('src/app/api/ecommerce/products/[id]/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
new Function('require','module','exports',code)(()=>({hasAuth:r=>r.headers.get('authorization')==='test-admin',unauthorized:()=>new Response(null,{status:401}),openCommerceDb:()=>({prepare:q=>db.prepare(q),transaction:f=>db.transaction(f),close:()=>{}})}),m,m.exports);
const put=(data,auth='test-admin')=>m.exports.PUT(new Request('https://admin.example/api/ecommerce/products/p1',{method:'PUT',headers:{authorization:auth,'content-type':'application/json'},body:JSON.stringify(data)}),{params:Promise.resolve({id:'p1'})});
test('visibility API authenticates, validates conflicts and only updates visibility',async()=>{
 assert.equal((await put({hidden:true},'')).status,401);
 assert.equal((await put({hidden:'yes'})).status,400);
 assert.equal((await put({hidden:true,expectedUpdatedAt:'stale'})).status,409);
 assert.equal((await put({hidden:true,expectedUpdatedAt:'v1',stock:0,sale_price:1})).status,200);
 let p=db.prepare('SELECT * FROM shop_products').get();assert.equal(p.is_hidden,1);assert.equal(p.stock,5);assert.equal(p.sale_price,99);assert.equal(p.status,'停售');
 assert.equal((await put({hidden:false,expectedUpdatedAt:p.updated_at})).status,200);p=db.prepare('SELECT * FROM shop_products').get();assert.equal(p.is_hidden,0);assert.equal(p.status,'停售');
});
test.after(()=>db.close());
