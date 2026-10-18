const assert=require('node:assert/strict');
const sharp=require('/www/wwwroot/dongfangwuquan/admin-platform/node_modules/sharp');
const {optimize}=require('./compress-server-images.cjs');
(async()=>{
for(const [name,width,height,channels,background] of [
 ['cover.jpg',3600,2400,3,'#777'],['payments/long.png',1080,14000,3,'#fff'],['transparent.png',2000,1800,4,{r:255,g:0,b:0,alpha:0.3}],['certificates/template.png',2400,3600,4,{r:255,g:0,b:0,alpha:0.3}],['icons/pwa.png',512,512,4,{r:255,g:0,b:0,alpha:0.3}]
]){
 let input=sharp({create:{width,height,channels,background}});input=await (name.endsWith('.jpg')?input.jpeg():input.png()).toBuffer();
 const r=await optimize(input,'/test/'+name),m=await sharp(r.buffer).metadata();
 assert.equal(m.format,name.endsWith('.jpg')?'jpeg':'png');
 if(name.includes('long'))assert.equal(m.height,height);
 if(name.includes('certificates')||name.includes('icons')){
  assert.equal(m.width,width);assert.equal(m.height,height);
  assert.deepEqual(await sharp(r.buffer).raw().toBuffer(),await sharp(input).raw().toBuffer());
 }
 if(channels===4)assert.equal(m.hasAlpha,true);
 assert.ok(m.width<=width&&m.height<=height);
 console.log(name,'OK',m.width,m.height);
}
const frames=await sharp({create:{width:64,height:128,channels:4,background:{r:255,g:0,b:0,alpha:0.5}}}).raw().toBuffer();
for(let i=64*64*4;i<frames.length;i+=4){frames[i]=0;frames[i+2]=255;}
const gif=await sharp(frames,{raw:{width:64,height:128,channels:4,pageHeight:64}}).gif({delay:[200,300],loop:0}).toBuffer();
const r=await optimize(gif,'/test/animated.gif');const m=await sharp(r.buffer,{animated:true}).metadata();assert.equal(m.pages,2);assert.deepEqual(m.delay,[200,300]);console.log('animation OK');
})();
