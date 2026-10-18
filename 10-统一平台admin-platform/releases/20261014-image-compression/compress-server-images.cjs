'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('/www/wwwroot/dongfangwuquan/admin-platform/node_modules/sharp');
sharp.concurrency(1); sharp.cache({ memory: 32, files: 0, items: 32 });
const base = '/www/wwwroot/dongfangwuquan';
const roots = ['admin-platform/public','admin-platform/data/bonus-vouchers','website/public','website/.cache/event-covers','miniprogram/images'].map(x=>path.join(base,x));
const stateDir = '/var/lib/eva-image-compression';
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const extensions = new Set(['.jpg','.jpeg','.png','.webp','.gif','.avif','.tif','.tiff','.bmp','.heic','.ico','.svg']);
async function inventory() {
 const files=[];
 async function walk(dir) {
  for(const entry of await fs.readdir(dir,{withFileTypes:true}).catch(()=>[])) {
   if(entry.name.startsWith('._') || entry.isSymbolicLink()) continue;
   const p=path.join(dir,entry.name);
   if(entry.isDirectory()) await walk(p);
   else if(entry.isFile() && extensions.has(path.extname(p).toLowerCase())) files.push(p);
  }
 }
 for(const root of roots) await walk(root);
 return files.sort();
}
async function optimize(input,filename) {
 const ext=path.extname(filename).toLowerCase();
 if(['.svg','.ico'].includes(ext)) return {buffer:input,reason:'vector-or-icon'};
 if(input.length<64*1024)return {buffer:input,reason:'already-small'};
 const meta=await sharp(input,{animated:true,limitInputPixels:100_000_000}).metadata();
 if(['webp','avif'].includes(meta.format) && input.length<256*1024)return {buffer:input,meta,reason:'already-optimized'};
 const lossless = /\/certificates\/|\/icons\/|\/splash\/|\/miniprogram\/images\/|\/(?:pwa|apple-touch|favicon|logo-master)/.test(filename);
 const isText = /voucher|\/payments\//.test(filename);
 let pipe=sharp(input,{animated:true,limitInputPixels:100_000_000});
 if(!lossless) pipe=pipe.rotate().resize({width:1800,height:isText?16000:12000,fit:'inside',withoutEnlargement:true});
 switch(ext) {
 case '.jpg':case '.jpeg': pipe=pipe.jpeg({quality:84,mozjpeg:true});break;
 case '.png': pipe=lossless?pipe.png({compressionLevel:9}):pipe.png({compressionLevel:6,palette:true,quality:90,colours:256,dither:0.5,effort:1});break;
 case '.webp': pipe=pipe.webp({quality:isText?86:84,effort:5});break;
 case '.avif':pipe=pipe.avif({quality:65,effort:4});break;
 case '.gif':pipe=pipe.gif({effort:7});break;
 case '.tif':case '.tiff':pipe=pipe.tiff({compression:'lzw'});break;
 default:return {buffer:input,reason:'unsupported-preserved',meta};
 }
 const buffer=await pipe.toBuffer();
 const result=await sharp(buffer,{animated:true,limitInputPixels:100_000_000}).metadata();
 await sharp(buffer,{animated:true,limitInputPixels:100_000_000}).stats();
 if((meta.pages||1)!==(result.pages||1))throw new Error('Animation frame count changed');
 if(meta.hasAlpha && !result.hasAlpha && !(await sharp(input).stats()).isOpaque)throw new Error('Transparency lost');
 if(lossless && (meta.width!==result.width || meta.height!==result.height))throw new Error('Protected dimensions changed');
 return {buffer,meta,result,reason:'encoded'};
}
async function main() {
 await fs.mkdir(stateDir,{recursive:true,mode:0o700});
 const statePath=path.join(stateDir,'state.json');
 const state=JSON.parse(await fs.readFile(statePath,'utf8').catch(()=>'{}'));
 const rows=[]; const files=await inventory();
 if(process.argv.includes('--inventory')){console.log(JSON.stringify(files));return;}
 const dry=process.argv.includes('--dry-run');
 for(const filename of files) {
  if(rows.length && rows.length%100===0)console.error(JSON.stringify({processed:rows.length,total:files.length}));
  let tmp;
  try {
   const stat=await fs.lstat(filename);if(!stat.isFile())continue;
   if(state[filename]?.size===stat.size && state[filename]?.mtimeMs===stat.mtimeMs){rows.push({filename,status:'unchanged',before:stat.size,after:stat.size});continue;}
   const input=await fs.readFile(filename);const beforeHash=hash(input);
   const encoded=await optimize(input,filename);
   const smaller=encoded.buffer.length<=input.length*0.95 && input.length-encoded.buffer.length>=1024;
   const row={filename,status:smaller?'compressed':'already-small',before:input.length,after:smaller?encoded.buffer.length:input.length,beforeHash,afterHash:smaller?hash(encoded.buffer):beforeHash,format:encoded.meta?.format,width:encoded.meta?.width,height:encoded.meta?.height,outputWidth:encoded.result?.width,outputHeight:encoded.result?.height,reason:encoded.reason};
   if(smaller && !dry) {
    tmp=filename+'.compress-'+crypto.randomUUID();
    const h=await fs.open(tmp,'wx',stat.mode);await h.writeFile(encoded.buffer);await h.sync();await h.close();
    await fs.chown(tmp,stat.uid,stat.gid);await fs.chmod(tmp,stat.mode);
    const current=await fs.lstat(filename);
    if(!current.isFile() || current.ino!==stat.ino || current.mtimeMs!==stat.mtimeMs || hash(await fs.readFile(filename))!==beforeHash){await fs.unlink(tmp);tmp=null;rows.push({...row,status:'concurrent-change',after:input.length});continue;}
    await fs.rename(tmp,filename);tmp=null;
   }
   if(!dry){const current=await fs.lstat(filename);if(!current.isFile() || hash(await fs.readFile(filename))!==row.afterHash){rows.push({...row,status:'concurrent-change',after:current.size});continue;}state[filename]={size:current.size,mtimeMs:current.mtimeMs,hash:row.afterHash};}
   rows.push(row);
  }catch(e){if(tmp)await fs.unlink(tmp).catch(()=>{});rows.push({filename,status:'error',error:e.message});}
 }
 const summary={time:new Date().toISOString(),dryRun:dry,files:rows.length,compressed:rows.filter(x=>x.status==='compressed').length,errors:rows.filter(x=>x.status==='error'),beforeBytes:rows.reduce((n,x)=>n+(x.before||0),0),afterBytes:rows.reduce((n,x)=>n+(x.after||0),0),rows};
 const report=path.join(stateDir,dry?'preview.json':'latest.json');await fs.writeFile(report,JSON.stringify(summary,null,2),{mode:0o600});
 if(!dry){await fs.writeFile(statePath+'.tmp',JSON.stringify(state),{mode:0o600});await fs.rename(statePath+'.tmp',statePath);}
 console.log(JSON.stringify({...summary,rows:undefined}));
 if(summary.errors.length)process.exitCode=1;
}
module.exports={optimize,inventory};
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
