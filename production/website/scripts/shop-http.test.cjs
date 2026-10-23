// Isolated HTTP integration: synthetic accounts, SQLite fixture and signing keys.
// No request is sent to a real payment gateway.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { createRequire } = require('node:module');
const admin = [process.env.SHOP_ADMIN_TEST_ROOT,path.resolve('../admin-platform'),path.resolve('../../10-统一平台admin-platform')].find(p=>p && fs.existsSync(path.join(p,'package.json')));
const Database = createRequire(path.join(admin,'package.json'))('better-sqlite3');
const dir = fs.mkdtempSync(path.resolve('.shop-http-'));
const filename = path.join(dir,'fixture.db');
const db = new Database(filename);
db.exec(`CREATE TABLE Member(id INTEGER PRIMARY KEY,name TEXT,phone TEXT DEFAULT '',province TEXT DEFAULT '',city TEXT DEFAULT '',address TEXT DEFAULT ''); INSERT INTO Member(id,name) VALUES(1,'测试用户'); INSERT INTO Member(id,name) VALUES(2,'其他用户');
CREATE TABLE shop_products(id TEXT PRIMARY KEY,name TEXT,category TEXT,spec TEXT,size TEXT,color TEXT,image TEXT,cost_price REAL,sale_price REAL,stock INTEGER,warning_stock INTEGER,status TEXT,created_at TEXT,updated_at TEXT);
INSERT INTO shop_products VALUES('test-sku','测试舞服','上衣','基础','M','黑','',7,19.99,10,3,'在售','','');
CREATE TABLE shop_stock_logs(id INTEGER PRIMARY KEY,product_id TEXT,product_name TEXT,change_type TEXT NOT NULL CHECK(change_type IN ('入库','出库','调整','销售')),quantity INTEGER,before_stock INTEGER,after_stock INTEGER,operator TEXT,remark TEXT,channel TEXT);
CREATE TABLE shop_sales(id INTEGER PRIMARY KEY,product_id TEXT,product_name TEXT,quantity INTEGER,unit_price REAL,total_amount REAL,member_id INTEGER,member_name TEXT,sale_date TEXT,remark TEXT,sale_type TEXT,channel TEXT,customer_phone TEXT,operator TEXT);`);
db.exec("ALTER TABLE shop_stock_logs ADD COLUMN created_at TEXT DEFAULT '';");
db.exec("CREATE TABLE CourseSeries(id INTEGER PRIMARY KEY,name TEXT,price REAL,promo_price REAL,is_free INTEGER,status TEXT);INSERT INTO CourseSeries VALUES(1,'系统课',100,80,0,'published'),(2,'隐藏课',100,0,0,'draft');\n CREATE TABLE CourseTemplate(id INTEGER PRIMARY KEY,websiteVisible INTEGER);INSERT INTO CourseTemplate VALUES(1,1);\n CREATE TABLE Course(id INTEGER PRIMARY KEY,name TEXT,price REAL,templateId INTEGER,status TEXT,category TEXT,sessions INTEGER,endDate TEXT,capacity INTEGER,remaining INTEGER);INSERT INTO Course VALUES(8,'公开期次',200,1,'planned','offline',10,'2099-12-01',1,1);\n CREATE TABLE CourseOrder(id INTEGER PRIMARY KEY,order_no TEXT,member_id INTEGER,series_id INTEGER,amount REAL,status TEXT,pay_method TEXT,paid_at TEXT,remark TEXT,updated_at TEXT);\n CREATE TABLE CourseAuthorization(id INTEGER PRIMARY KEY,member_id INTEGER,phone TEXT,series_id INTEGER,type TEXT,order_id INTEGER,granted_at TEXT,status TEXT,remark TEXT,expire_at TEXT,revoked_at TEXT);\n CREATE TABLE Payment(id INTEGER PRIMARY KEY,memberId INTEGER,memberName TEXT,memberPhone TEXT,courseId INTEGER,courseName TEXT,amount REAL,date TEXT,payment TEXT,remark TEXT,expireDate TEXT,remainingSessions INTEGER,paymentStatus TEXT,channel TEXT);\n CREATE TABLE OfflineEnrollment(id INTEGER PRIMARY KEY,enrollment_no TEXT,member_id INTEGER,course_id INTEGER,payment_id INTEGER,status TEXT,channel TEXT,amount REAL,activated_at TEXT,remark TEXT);\n CREATE TABLE OfflineEntitlement(id INTEGER PRIMARY KEY,member_id INTEGER,course_id INTEGER,enrollment_id INTEGER,payment_id INTEGER,total_sessions INTEGER,available_sessions INTEGER,valid_from TEXT,valid_until TEXT,status TEXT,used_sessions INTEGER DEFAULT 0,frozen_sessions INTEGER DEFAULT 0);\n CREATE TABLE orders(id INTEGER PRIMARY KEY,order_no TEXT,member_id INTEGER,member_name TEXT,member_phone TEXT,order_type TEXT,source_type TEXT,source_id TEXT,title TEXT,amount REAL,status TEXT,pay_method TEXT,paid_at TEXT,remark TEXT,updated_at TEXT);");
const keys=crypto.generateKeyPairSync('rsa',{modulusLength:2048});
const config={WECHAT_PAY_APP_ID:'web-app',WECHAT_PAY_MINI_APP_ID:'mini-app',WECHAT_PAY_MINI_ENABLED:'true',WECHAT_PAY_MCH_ID:'test-merchant',WECHAT_PAY_SERIAL:'test-serial',WECHAT_PAY_PRIVATE_KEY:keys.privateKey.export({type:'pkcs8',format:'pem'}),WECHAT_PAY_PUBLIC_KEY:keys.publicKey.export({type:'spki',format:'pem'}),WECHAT_PAY_PUBLIC_KEY_ID:'TEST_PUB_ID',WECHAT_PAY_API_V3_KEY:'12345678901234567890123456789012',SHOP_CHECKOUT_ENABLED:'true',ALIPAY_APP_ID:'test-app',ALIPAY_SELLER_ID:'test-seller',ALIPAY_PRIVATE_KEY:keys.privateKey.export({type:'pkcs8',format:'pem'}),ALIPAY_PUBLIC_KEY:keys.publicKey.export({type:'spki',format:'pem'})};
fs.writeFileSync(path.join(dir,'payments.json'),JSON.stringify(config));
db.exec("CREATE TABLE WechatIdentity(member_id INTEGER,app_id TEXT,openid TEXT);INSERT INTO WechatIdentity VALUES(1,'mini-app','mini-openid');");
const mock=path.join(dir,'gateway-mock.cjs');
fs.writeFileSync(mock, `const fs=require('fs'),crypto=require('crypto');const config=JSON.parse(fs.readFileSync(process.env.SHOP_CONFIG_FILE));const original=global.fetch;global.fetch=async function(url,options){if(String(url).startsWith('https://api.weixin.qq.com/sns/oauth2/access_token'))return Response.json({openid:'current-web-openid',access_token:'fixture-only'});if(!String(url).startsWith('https://api.mch.weixin.qq.com/'))return original(url,options);let payload;if(options.method==='POST'){const input=JSON.parse(options.body);fs.writeFileSync(process.env.SHOP_TEST_GATEWAY_CAPTURE,JSON.stringify(input));payload={prepay_id:'isolated-test-prepay'};}else{const input=JSON.parse(fs.readFileSync(process.env.SHOP_TEST_GATEWAY_CAPTURE));payload={appid:input.appid,mchid:input.mchid,out_trade_no:input.out_trade_no,trade_state:'NOTPAY'};}const raw=JSON.stringify(payload),timestamp=String(Math.floor(Date.now()/1000)),nonce='fixture';const signature=crypto.sign('RSA-SHA256',Buffer.from(timestamp+'\\n'+nonce+'\\n'+raw+'\\n'),config.WECHAT_PAY_PRIVATE_KEY).toString('base64');return new Response(raw,{headers:{'wechatpay-timestamp':timestamp,'wechatpay-nonce':nonce,'wechatpay-serial':config.WECHAT_PAY_PUBLIC_KEY_ID,'wechatpay-signature':signature}});};`);
const secret='isolated-shop-http-test-only';
const port=13012,origin=`http://127.0.0.1:${port}`;
let server,adminServer,output='';
const proxyOrigin='http://127.0.0.1:13013';
function token(id){const payload=Buffer.from(JSON.stringify({id,phone:db.prepare('SELECT phone FROM Member WHERE id=?').get(id)?.phone,exp:Date.now()+600000})).toString('base64url');return `${payload}.${crypto.createHmac('sha256',secret).update(payload).digest('base64url')}`;}
async function request(route,body,member=1,otherHeaders={}){
 return fetch(origin+'/api/shop/'+route,{method:body===undefined?'GET':'POST',headers:{Origin:'https://www.swod.com.cn',...(member?{Authorization:'Bearer '+token(member)}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...otherHeaders},...(body!==undefined?{body:JSON.stringify(body)}:{})});
}
test.before(async()=>{
 server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p',String(port)],{cwd:process.cwd(),env:{...process.env,ADMIN_DB_PATH:filename,ADMIN_SESSION_SECRET:secret,WECHAT_WEB_APP_ID:'web-app',WECHAT_WEB_APP_SECRET:'fixture-secret',SHOP_CONFIG_FILE:path.join(dir,'payments.json'),SHOP_TEST_GATEWAY_CAPTURE:path.join(dir,'gateway.json'),NODE_OPTIONS:'--require='+mock},stdio:['ignore','pipe','pipe']});
 server.stdout.on('data',chunk=>{output+=chunk;});server.stderr.on('data',chunk=>{output+=chunk;});
 for(let i=0;i<80;i++){try{const res=await fetch(origin+'/api/shop/products');if(res.ok)break;}catch{}await new Promise(resolve=>setTimeout(resolve,250));}
 if(!(await fetch(origin+'/api/shop/products')).ok) throw new Error('Fixture server failed to start: '+output.slice(-1000));
 if(process.env.SHOP_ADMIN_BUILD_ROOT){
  adminServer=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','13013'],{cwd:process.env.SHOP_ADMIN_BUILD_ROOT,env:{...process.env,ADMIN_DB_PATH:filename,ADMIN_SESSION_SECRET:secret,NEXT_DIST_DIR:'.next-build',SHOP_API_ORIGIN:origin,SHOP_CONFIG_FILE:path.join(dir,'payments.json')},stdio:['ignore','pipe','pipe']});
  adminServer.stdout.on('data',chunk=>{output+=chunk;});adminServer.stderr.on('data',chunk=>{output+=chunk;});
  for(let i=0;i<80;i++){try{if((await fetch(proxyOrigin+'/api/mini/shop/products')).ok)return;}catch{}await new Promise(resolve=>setTimeout(resolve,250));}
  throw new Error('Admin proxy fixture failed to start: '+output.slice(-1000));
 }
});
test.after(async()=>{if(process.env.SHOP_TEST_HOLD_MS)await new Promise(r=>setTimeout(r,Number(process.env.SHOP_TEST_HOLD_MS)));if(adminServer && adminServer.exitCode===null){adminServer.kill('SIGTERM');await new Promise(resolve=>adminServer.once('exit',resolve));}if(server && server.exitCode===null){server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve));}db.close();fs.rmSync(dir,{recursive:true,force:true});});
test('商城 HTTP 完整流程：同源、鉴权、实时商品、幂等下单、回调、归属和退款申请',async()=>{
 const catalogue=await (await request('products')).json();assert.equal(catalogue.products.length,1);assert.equal(catalogue.products[0].priceFen,1999);assert.equal('cost_price' in catalogue.products[0],false);
 assert.equal((await request('orders',undefined,0)).status,401);
 const payload={recipient:'测试收件人',phone:'13800000000',address:'广东省广州市测试区测试街一号',provider:'alipay',requestKey:crypto.randomUUID(),expectedTotalFen:3998,items:[{id:'test-sku',quantity:2}]};
 assert.equal((await request('orders',payload,1,{Origin:'https://untrusted.example'})).status,403);
 const created=await request('orders',payload);assert.equal(created.status,201);const {order}=await created.json();assert.equal(order.totalFen,3998);
 assert.equal((await (await request('orders',payload)).json()).order.id,order.id);
 assert.equal((await (await request('products')).json()).products[0].stock,8);
 assert.equal((await request('orders/'+order.id,undefined,2)).status,404);
 const data={app_id:'test-app',seller_id:'test-seller',out_trade_no:order.id,trade_no:'fixture-transaction',trade_status:'TRADE_SUCCESS',total_amount:'39.98'};
 const string=Object.keys(data).sort().map(key=>key+'='+data[key]).join('&');
 const raw=new URLSearchParams({...data,sign_type:'RSA2',sign:crypto.sign('RSA-SHA256',Buffer.from(string),keys.privateKey).toString('base64')}).toString();
 const notify=body=>fetch(origin+'/api/shop/notify/alipay',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
 assert.equal((await notify(raw.replace('39.98','0.01'))).status,400);
 assert.equal(await (await notify(raw)).text(),'success');assert.equal(await (await notify(raw)).text(),'success');
 assert.equal(db.prepare('SELECT count(*) n FROM shop_sales').get().n,1);
 assert.equal((await (await request('orders/'+order.id)).json()).order.status,'paid');
 const refunded=await request(`orders/${order.id}/refund`,{reason:'测试退款申请'});assert.equal(refunded.status,200);assert.equal((await refunded.json()).order.status,'refund_requested');
 const second=await (await request('orders',{...payload,requestKey:crypto.randomUUID()})).json();
 assert.equal((await request(`orders/${second.order.id}/cancel`,{})).status,200);
 assert.equal(db.prepare("SELECT stock FROM shop_products WHERE id='test-sku'").get().stock,8);
 db.prepare("UPDATE shop_products SET sale_price=22.99,updated_at='changed' WHERE id='test-sku'").run();
 assert.equal((await (await request('products')).json()).products[0].priceFen,2299);
 db.prepare("UPDATE shop_products SET status='下架' WHERE id='test-sku'").run();assert.equal((await (await request('products')).json()).products.length,0);
 fs.writeFileSync(path.join(dir,'payments.json'),JSON.stringify({...config,SHOP_CHECKOUT_ENABLED:'false'}));
 assert.equal((await request('orders',{...payload,requestKey:crypto.randomUUID()})).status,503);
});
test('小程序完整接口：地址双向同步、原生支付、签名通知、快递收货和退款申请',async()=>{
 fs.writeFileSync(path.join(dir,'payments.json'),JSON.stringify(config));
 db.prepare("UPDATE shop_products SET status='在售',stock=10,sale_price=19.99 WHERE id='test-sku'").run();
 db.prepare("UPDATE Member SET phone='13800000000',province='广东省',city='广州市',address='天河区测试街一号' WHERE id=1").run();
 let shipping=(await(await request('shipping')).json()).shipping;assert.equal(shipping.address,'广东省广州市天河区测试街一号');
 const address={recipient:'测试收件人',phone:'13900000000',address:'浙江省杭州市西湖区测试街二号'};
 const save=await fetch(origin+'/api/shop/shipping',{method:'PUT',headers:{Origin:'https://www.swod.com.cn',Authorization:'Bearer '+token(1),'Content-Type':'application/json'},body:JSON.stringify(address)});assert.equal(save.status,200);
 assert.equal(db.prepare('SELECT address FROM Member WHERE id=1').get().address,address.address);
 db.prepare("UPDATE Member SET province='四川省',city='成都市',address='武侯区测试路三号' WHERE id=1").run();
 shipping=(await(await request('shipping')).json()).shipping;assert.equal(shipping.address,'四川省成都市武侯区测试路三号');
 const miniHeaders={'x-client-platform':'miniprogram'};
 const payload={...shipping,requestKey:crypto.randomUUID(),provider:'wechat',expectedTotalFen:1999,items:[{id:'test-sku',quantity:1}]};
 const creation=await request('orders',payload,1,miniHeaders);assert.equal(creation.status,201);const order=(await creation.json()).order;
 assert.equal((await request('orders/'+order.id,undefined,2)).status,404);
 const payment=await request(`orders/${order.id}/pay`,{},1,miniHeaders);assert.equal(payment.status,200);const data=await payment.json();assert.equal(data.kind,'miniprogram');assert.equal(data.params.package,'prepay_id=isolated-test-prepay');
 const captured=JSON.parse(fs.readFileSync(path.join(dir,'gateway.json')));assert.equal(captured.appid,'mini-app');assert.equal(captured.payer.openid,'mini-openid');assert.equal(captured.amount.total,1999);
 assert.equal((await(await request(`orders/${order.id}/refresh`,{},1,miniHeaders)).json()).order.status,'pending');
 const resource={algorithm:'AEAD_AES_256_GCM',nonce:'123456789012',associated_data:'transaction'};
 const cipher=crypto.createCipheriv('aes-256-gcm',Buffer.from(config.WECHAT_PAY_API_V3_KEY),Buffer.from(resource.nonce));cipher.setAAD(Buffer.from(resource.associated_data));const cipherText=Buffer.concat([cipher.update(JSON.stringify({appid:'mini-app',mchid:'test-merchant',out_trade_no:order.id,transaction_id:'mini-test-transaction',trade_state:'SUCCESS',amount:{total:1999,currency:'CNY'}})),cipher.final(),cipher.getAuthTag()]);
 const raw=JSON.stringify({event_type:'TRANSACTION.SUCCESS',resource:{...resource,ciphertext:cipherText.toString('base64')}}),timestamp=String(Math.floor(Date.now()/1000)),nonce='notify';
 const notification=()=>fetch(origin+'/api/shop/notify/wechat',{method:'POST',headers:{'Content-Type':'application/json','wechatpay-timestamp':timestamp,'wechatpay-nonce':nonce,'wechatpay-serial':'TEST_PUB_ID','wechatpay-signature':crypto.sign('RSA-SHA256',Buffer.from(`${timestamp}\n${nonce}\n${raw}\n`),keys.privateKey).toString('base64')},body:raw});
 assert.equal((await notification()).status,204);assert.equal((await notification()).status,204);assert.equal((await(await request('orders/'+order.id)).json()).order.status,'paid');
 db.prepare("UPDATE shop_online_orders SET status='shipped',carrier='测试快递',tracking_no='TEST123',shipped_at=? WHERE id=?").run(Date.now(),order.id);
 const tracked=(await(await request('orders/'+order.id)).json()).order;assert.equal(tracked.trackingNo,'TEST123');assert.equal(tracked.carrier,'测试快递');
 assert.equal((await request(`orders/${order.id}/received`,{})).status,200);assert.equal((await request(`orders/${order.id}/refund`,{reason:'测试售后'})).status,200);
 assert.equal((await(await request('orders/'+order.id)).json()).order.status,'refund_requested');
});
test('统一后台小程序商城代理：匿名商品、鉴权地址、订单归属与禁止支付通知代理',{skip:!process.env.SHOP_ADMIN_BUILD_ROOT},async()=>{
 const products=await fetch(proxyOrigin+'/api/mini/shop/products');assert.equal(products.status,200);const catalogue=await products.json();assert.equal(catalogue.products[0].id,'test-sku');
 assert.equal((await fetch(proxyOrigin+'/api/mini/shop/orders')).status,401);
 const headers={Authorization:'Bearer '+token(1),'Content-Type':'application/json'};
 const updated=await fetch(proxyOrigin+'/api/mini/shop/shipping',{method:'PUT',headers,body:JSON.stringify({recipient:'代理地址',phone:'13800000000',address:'福建省厦门市思明区测试街四号'})});assert.equal(updated.status,200);
 assert.equal(db.prepare('SELECT address FROM Member WHERE id=1').get().address,'福建省厦门市思明区测试街四号');
 const address=(await(await fetch(proxyOrigin+'/api/mini/shop/shipping',{headers})).json()).shipping;assert.equal(address.recipient,'代理地址');
 assert.equal((await fetch(proxyOrigin+'/api/mini/shop/notify/wechat',{method:'POST',headers,body:'{}'})).status,404);
 const order=db.prepare('SELECT id FROM shop_online_orders WHERE member_id=1 LIMIT 1').get();
 assert.equal((await fetch(proxyOrigin+'/api/mini/shop/orders/'+order.id,{headers:{Authorization:'Bearer '+token(2)}})).status,404);
});
test('后台隐藏与显示立即同步官网和小程序，保留库存价格与历史订单',{skip:!process.env.SHOP_ADMIN_BUILD_ROOT},async()=>{
 const payload=Buffer.from(JSON.stringify({id:1,username:'fixture-admin',name:'测试管理员',role:'admin',exp:Date.now()+600000})).toString('base64url');
 const adminToken='local.'+payload+'.'+crypto.createHmac('sha256',secret).update(payload).digest('base64url');
 const before=db.prepare("SELECT stock,sale_price,status FROM shop_products WHERE id='test-sku'").get();
 const ordersBefore=db.prepare('SELECT count(*) n FROM shop_online_orders').get().n;
 const update=hidden=>fetch('http://127.0.0.1:13013/local-api/ecommerce/products/test-sku',{method:'PUT',headers:{Authorization:'Bearer '+adminToken,'Content-Type':'application/json'},body:JSON.stringify({hidden})});
 const hideResult=await update(true);assert.equal(hideResult.status,200,output.slice(-1800));
 assert.equal((await fetch(origin+'/shop/products/test-sku')).status,404);
 assert.equal((await(await request('products')).json()).products.length,0);
 assert.equal((await(await fetch('http://127.0.0.1:13013/api/mini/shop/products')).json()).products.length,0);
 const attempt=await request('orders',{recipient:'测试',phone:'13800000000',address:'广东省测试地址一号',provider:'wechat',requestKey:crypto.randomUUID(),expectedTotalFen:1999,items:[{id:'test-sku',quantity:1}]});assert.ok(attempt.status>=400);
 assert.deepEqual(db.prepare("SELECT stock,sale_price,status FROM shop_products WHERE id='test-sku'").get(),before);
 assert.equal(db.prepare('SELECT count(*) n FROM shop_online_orders').get().n,ordersBefore);
 assert.equal((await update(false)).status,200);
 assert.equal((await fetch(origin+'/shop/products/test-sku')).status,200);
 assert.equal((await(await request('products')).json()).products.length,1);
 assert.equal((await(await fetch('http://127.0.0.1:13013/api/mini/shop/products')).json()).products.length,1);
});
test('微信内网页付款完整授权回跳使用本次OpenID，旧小程序身份不混用',async()=>{
 fs.writeFileSync(path.join(dir,'payments.json'),JSON.stringify({...config,WECHAT_PAY_JSAPI_ENABLED:'true'}));
 const wxHeaders={'user-agent':'MicroMessenger'};
 const payload={recipient:'测试',phone:'13800000000',address:'广东省测试街道三号',provider:'wechat',requestKey:crypto.randomUUID(),expectedTotalFen:1999,items:[{id:'test-sku',quantity:1}]};
 const creation=await request('orders',payload);assert.equal(creation.status,201);const order=(await creation.json()).order;
 const first=await(await request(`orders/${order.id}/pay`,{},1,wxHeaders)).json();assert.equal(first.kind,'redirect');assert.ok(first.url.startsWith('/api/shop/wechat/authorize?order='));
 const headers={...wxHeaders,Authorization:'Bearer '+token(1)};
 const start=await fetch(origin+first.url,{headers,redirect:'manual'});assert.equal(start.status,307);const authorize=new URL(start.headers.get('location'));assert.equal(authorize.searchParams.get('scope'),'snsapi_base');
 const cookie=start.headers.getSetCookie().find(c=>c.startsWith('__Host-eva-wx-state=')).split(';')[0];
 const callback=await fetch(origin+'/api/shop/wechat/authorize?state='+authorize.searchParams.get('state')+'&code=fixture-code',{headers:{...headers,cookie},redirect:'manual'});assert.match(callback.headers.get('location'),/wx_pay_resume=1/);
 const identity=callback.headers.getSetCookie().find(c=>c.startsWith('__Host-eva-wx-pay=')).split(';')[0];
 const result=await(await request(`orders/${order.id}/pay`,{},1,{...wxHeaders,cookie:identity})).json();assert.equal(result.kind,'jsapi');assert.equal(result.params.appId,'web-app');
 const captured=JSON.parse(fs.readFileSync(path.join(dir,'gateway.json')));assert.equal(captured.payer.openid,'current-web-openid');assert.equal(captured.appid,'web-app');assert.equal(captured.amount.total,1999);
});

async function courseNotification(order, transactionId){
 const resource={algorithm:'AEAD_AES_256_GCM',nonce:'123456789012',associated_data:'transaction'};
 const cipher=crypto.createCipheriv('aes-256-gcm',Buffer.from(config.WECHAT_PAY_API_V3_KEY),Buffer.from(resource.nonce));cipher.setAAD(Buffer.from(resource.associated_data));
 const value={appid:'mini-app',mchid:'test-merchant',out_trade_no:order.id,transaction_id:transactionId,trade_state:'SUCCESS',amount:{total:order.totalFen,currency:'CNY'}};
 const encrypted=Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final(),cipher.getAuthTag()]);
 const raw=JSON.stringify({event_type:'TRANSACTION.SUCCESS',resource:{...resource,ciphertext:encrypted.toString('base64')}}),timestamp=String(Math.floor(Date.now()/1000)),nonce='course-notify';
 return fetch(origin+'/api/shop/notify/wechat',{method:'POST',headers:{'Content-Type':'application/json','wechatpay-timestamp':timestamp,'wechatpay-nonce':nonce,'wechatpay-serial':'TEST_PUB_ID','wechatpay-signature':crypto.sign('RSA-SHA256',Buffer.from(`${timestamp}\n${nonce}\n${raw}\n`),keys.privateKey).toString('base64')},body:raw});
}
test('线上课和线下期次经小程序支付、签名回调后自动开通，跨账户不能读取订单',async()=>{
 const miniHeaders={'x-client-platform':'miniprogram'};
 for(const [kind,id,fen] of [['online',1,8000],['offline',8,20000]]){
  const quote=await fetch(origin+`/api/shop/courses/${kind}/${id}`);assert.equal(quote.status,200);assert.equal((await quote.json()).offer.priceFen,fen);
  const miniQuote=await fetch('http://127.0.0.1:13013'+`/api/mini/shop/courses/${kind}/${id}`);assert.equal(miniQuote.status,200);
  const r=await request('orders',{kind,targetId:id,expectedTotalFen:fen,requestKey:'course-http-'+kind,provider:'wechat'},1,miniHeaders);assert.equal(r.status,201);const order=(await r.json()).order;
  assert.equal(order.kind,kind);assert.equal(order.address,'');assert.equal((await request('orders/'+order.id,undefined,2)).status,404);
  assert.equal((await request(`orders/${order.id}/pay`,{},1,miniHeaders)).status,200);
  assert.equal((await courseNotification(order,'receipt-'+kind)).status,204);assert.equal((await courseNotification(order,'receipt-'+kind)).status,204);
  assert.equal((await(await request('orders/'+order.id)).json()).order.status,'completed');
 }
 assert.equal(db.prepare('SELECT count(*) n FROM CourseAuthorization').get().n,1);
 assert.equal(db.prepare('SELECT count(*) n FROM Payment').get().n,1);
 assert.equal(db.prepare('SELECT available_sessions FROM OfflineEntitlement').get().available_sessions,10);
});

function adminToken(id=10,username='test-advisor'){const payload=Buffer.from(JSON.stringify({id,username,role:'admin',exp:Date.now()+600000})).toString('base64url');return `local.${payload}.${crypto.createHmac('sha256',secret).update(payload).digest('base64url')}`;}
async function exclusiveRequest(card,action,body,member=1,extra={}){return fetch(`${origin}/api/exclusive/${card}/${action}`,{method:body===undefined?'GET':'POST',headers:{Origin:'https://www.swod.com.cn',Authorization:'Bearer '+token(member),'Content-Type':'application/json',...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});}
test('专属订单 HTTP：管理员权限、多人独立付款、匿名隐私、品牌卡片及过期校验',async()=>{
 if(!adminServer)throw Error('exclusive integration requires admin fixture');
 db.exec(`CREATE TABLE IF NOT EXISTS User(id INTEGER PRIMARY KEY,username TEXT,name TEXT,role TEXT,status TEXT,permPaymentCreate INTEGER,permPaymentView INTEGER);
 INSERT INTO User VALUES(10,'test-advisor','测试顾问','admin','active',1,1),(11,'denied','无权限','teacher','active',0,0);
 UPDATE Member SET phone='1380000000'||id;
 INSERT INTO CourseSeries VALUES(90,'专属课程测试',100,80,0,'published');
 ALTER TABLE CourseAuthorization ADD COLUMN sales TEXT;
 ALTER TABLE Payment ADD COLUMN sales TEXT;`);
 fs.writeFileSync(path.join(dir,'payments.json'),JSON.stringify(config));
 const adminRequest=(body,bearer=adminToken())=>fetch(proxyOrigin+'/api/exclusive-orders',{method:body?'POST':'GET',headers:{Origin:'https://admin.swod.com.cn',Authorization:'Bearer '+bearer,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
 assert.equal((await adminRequest(undefined,'bad')).status,401);
 assert.equal((await adminRequest(undefined,adminToken(11,'denied'))).status,403);
 const input={action:'create',kind:'online',targetId:90,unitFen:4500,quantity:1,publish:true,requestKey:'http-exclusive',internalNote:'INTERNAL_ONLY_SECRET',customerNote:'欢迎学习',expiresAt:Date.now()+86400000};
 const created=await adminRequest(input);assert.equal(created.status,201,await created.clone().text());const card=await created.json(),cardToken=card.shareUrl.split('/').pop();
 assert.equal((await (await adminRequest(input)).json()).id,card.id);
 const anonymous=await fetch(origin+'/api/exclusive/'+cardToken+'/view');assert.equal(anonymous.status,200);const anonText=await anonymous.text();assert.ok(!anonText.includes('INTERNAL_ONLY_SECRET'));assert.ok(!anonText.includes('13800000001'));
 const body={confirmed:true,totalFen:4500,provider:'alipay'};
 assert.equal((await exclusiveRequest(cardToken,'confirm',{...body,totalFen:1})).status,409);
 assert.equal((await exclusiveRequest(cardToken,'confirm',body,1,{Origin:'https://evil.example'})).status,403);
 assert.equal((await exclusiveRequest(cardToken,'confirm',body,1,{Authorization:'Bearer bad'})).status,401);
 const legacyPayload=Buffer.from(JSON.stringify({id:1,exp:Date.now()+600000})).toString('base64url');const legacyToken=legacyPayload+'.'+crypto.createHmac('sha256',secret).update(legacyPayload).digest('base64url');
 const forged=Buffer.from(JSON.stringify({id:1,phone:'13800000001',exp:Date.now()+600000})).toString('base64url')+'.invalid';
 assert.equal((await exclusiveRequest(cardToken,'confirm',body,1,{Authorization:'Bearer '+forged,Cookie:'__Host-eva_session='+legacyToken})).status,401);
 const responses=await Promise.all([1,2].map(id=>exclusiveRequest(cardToken,'confirm',body,id)));for(const r of responses)assert.equal(r.status,201,await r.clone().text());
 const paidOrders=await Promise.all(responses.map(r=>r.json()));assert.notEqual(paidOrders[0].order.id,paidOrders[1].order.id);
 assert.equal(paidOrders[0].order.totalFen,4500);assert.equal(paidOrders[1].order.totalFen,4500);
 assert.equal((await request('orders/'+paidOrders[0].order.id,undefined,2)).status,404);
 for(const {order} of paidOrders){const params={app_id:'test-app',seller_id:'test-seller',out_trade_no:order.id,trade_no:'exclusive-'+order.id,total_amount:'45.00',trade_status:'TRADE_SUCCESS',sign_type:'RSA2'};const canonical=Object.keys(params).filter(k=>k!=='sign_type').sort().map(k=>`${k}=${params[k]}`).join('&');const raw=new URLSearchParams({...params,sign:crypto.sign('RSA-SHA256',Buffer.from(canonical),keys.privateKey).toString('base64')}).toString();assert.equal(await(await fetch(origin+'/api/shop/notify/alipay',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:raw})).text(),'success');}
 assert.equal(db.prepare('SELECT count(*) n FROM CourseAuthorization WHERE series_id=90').get().n,2);
 const again=await exclusiveRequest(cardToken,'confirm',body,1);assert.equal(again.status,201);assert.equal((await again.json()).order.id,paidOrders[0].order.id);
 const page=await fetch(origin+'/o/'+cardToken);assert.equal(page.status,200);assert.match(await page.text(),/og:title/);
 const image=await fetch(origin+'/api/exclusive/'+cardToken+'/card');assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/png');const imageBytes=Buffer.from(await image.arrayBuffer());assert.ok(imageBytes.length>5000);fs.writeFileSync('/tmp/exclusive-card-preview.png',imageBytes);
 const qr=await fetch(origin+'/api/exclusive/'+cardToken+'/qr');assert.equal(qr.status,200);
 const list=await(await adminRequest()).json();const found=list.orders.find(o=>o.id===card.id);assert.equal(found.paidCount,2);assert.equal(found.paidFen,9000);
 fs.writeFileSync('/tmp/exclusive-ui-fixture.json',JSON.stringify({url:origin+'/o/'+cardToken,adminUrl:proxyOrigin+'/orders',adminToken:adminToken(),studentToken:token(1)}));
 const expiredInput={...input,requestKey:'http-expired'};const exp=await(await adminRequest(expiredInput)).json();db.prepare('UPDATE exclusive_orders SET expires_at=? WHERE id=?').run(Date.now()-1,exp.id);assert.equal((await exclusiveRequest(exp.shareUrl.split('/').pop(),'confirm',body)).status,409);
});
