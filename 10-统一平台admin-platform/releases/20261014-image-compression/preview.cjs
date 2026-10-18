const fs=require('fs'),sharp=require('/www/wwwroot/dongfangwuquan/admin-platform/node_modules/sharp'),{optimize}=require('./compress-server-images.cjs');
(async()=>{
const root='/www/wwwroot/dongfangwuquan/admin-platform/public/uploads';
const files=[root+'/event-covers/凰之翎第六届国际舞蹈艺术节-1791545306136-2b0141b2.png',root+'/training-courses/weekend-coach-training.png'];
const layers=[];for(let i=0;i<files.length;i++){const b=fs.readFileSync(files[i]),o=await optimize(b,files[i]);console.log(JSON.stringify({file:files[i],before:b.length,after:o.buffer.length}));for(const [j,img] of [b,o.buffer].entries()){layers.push({input:await sharp(img).resize(600,700,{fit:'contain',background:'#fff'}).png().toBuffer(),left:j*600,top:i*700});}}
await sharp({create:{width:1200,height:1400,channels:3,background:'#fff'}}).composite(layers).png().toFile('/tmp/eva-image-comparison.png');
})();
