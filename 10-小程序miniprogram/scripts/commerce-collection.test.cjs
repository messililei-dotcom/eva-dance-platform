const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const crypto=require('node:crypto');
test('实际托管的后台收款码保持已确认原图',()=>{
  const root=path.resolve(__dirname,'../..');
  for(const file of ['10-统一平台admin-platform/public/payments/yiwa-unified-collection-v1.jpg']){
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex'),'9f25e157ece906ac1e49b615d28f49cd39919e22c8bab4322be2f1a5b3e603c2');
  }
});
test('查看码和复制信息不发起支付或写订单，非待付款订单不能复制付款指引',()=>{
  let page,preview,clipboard;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../pages/commerce-orders/commerce-orders.js'),'utf8'),{
    require:name=>name.includes('shared/share')?require('../shared/share'):({request:()=>{throw new Error('付款指引不应调用业务 API');}}),
    Page:value=>{page=value;},
    wx:{previewImage:value=>{preview=value;},setClipboardData:value=>{clipboard=value;},showToast:()=>{}},
  });
  page.data.orders=[{id:'o1',status:'pending',amount:'29.90',contact_name:'测试学员',title:'测试课程'},{id:'o2',status:'paid'}];
  page.previewCollectionCode();
  assert.equal(preview.urls[0],'https://admin.swod.com.cn/payments/yiwa-unified-collection-v1.jpg');
  page.copyPaymentDetails({currentTarget:{dataset:{id:'o1'}}});
  assert.match(clipboard.data,/29\.90/);
  assert.match(clipboard.data,/订单号：o1/);
  assert.match(clipboard.data,/已付款请勿重复支付/);
  assert.equal(page.data.orders[0].status,'pending');
  clipboard=null;
  page.copyPaymentDetails({currentTarget:{dataset:{id:'o2'}}});
  assert.equal(clipboard,null);
});

test('代码包排除超限原图，订单展示与预览使用同一张托管原图',()=>{
  const root=path.resolve(__dirname,'..');
  const config=JSON.parse(fs.readFileSync(path.join(root,'project.config.json'),'utf8'));
  const image='images/payments/yiwa-unified-collection-v1.jpg';
  assert.ok(config.packOptions.ignore.some(item=>item.type==='file' && item.value===image));
  const template=fs.readFileSync(path.join(root,'pages/commerce-orders/commerce-orders.wxml'),'utf8');
  assert.ok(template.includes('src="{{collectionCodeUrl}}"'));
  const media=/\.(png|jpe?g|gif|webp|svg|mp3|m4a|aac|wav|mp4|mov)$/i;
  function walk(dir){
    for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
      const file=path.join(dir,entry.name),relative=path.relative(root,file).split(path.sep).join('/');
      if(config.packOptions.ignore.some(item=>relative===item.value || (item.type==='folder' && relative.startsWith(item.value+'/'))))continue;
      if(entry.isDirectory())walk(file);
      else if(media.test(entry.name))assert.ok(fs.statSync(file).size<=200000,relative+' 超过 200 K');
    }
  }
  walk(root);
});
