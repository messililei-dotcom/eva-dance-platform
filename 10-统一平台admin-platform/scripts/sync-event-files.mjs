// Server originals remain authoritative. Private OSS copies are verified before recording success.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
export const bucket='csdfwq';
const host=`${bucket}.oss-rg-china-mainland.aliyuncs.com`;
const base='/www/wwwroot/dongfangwuquan/admin-platform';
export const stateRoot='/var/lib/swod-event-oss';
let cachedCredentials;
export function credentials(){return cachedCredentials ||= JSON.parse(execFileSync('pm2',['jlist'],{encoding:'utf8'})).find(p=>p.name==='dongfangwuquan-website').pm2_env;}
export async function oss(method,key,body,extra={}){
 const e=credentials(),date=new Date().toUTCString();
 const headers={Date:date,...extra};
 const md5=body?crypto.createHash('md5').update(body).digest('base64'):'';
 const type=body?'application/octet-stream':'';
 if(body){headers['Content-MD5']=md5;headers['Content-Type']=type;}
 const canonical=Object.keys(headers).filter(k=>k.startsWith('x-oss-')).sort().map(k=>`${k}:${headers[k]}\n`).join('');
 const sig=crypto.createHmac('sha1',e.ALIYUN_ACCESS_KEY_SECRET).update(`${method}\n${md5}\n${type}\n${date}\n${canonical}/${bucket}/${key}`).digest('base64');
 headers.Authorization=`OSS ${e.ALIYUN_ACCESS_KEY_ID}:${sig}`;
 const r=await fetch(`https://${host}/${key.split('/').map(encodeURIComponent).join('/')}`,{method,headers,body,signal:AbortSignal.timeout(120000)});
 if(!r.ok)throw new Error(`OSS ${method} failed (${r.status})`);
 return r;
}
export const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
export async function loadManifest(){try{return JSON.parse(await fs.readFile(path.join(stateRoot,'manifest.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return {};throw e;}}
async function inventory(){
 const script=`import sqlite3,json\nc=sqlite3.connect('file:${base}/admin.db?mode=ro',uri=True)\nprint(json.dumps({'music':[list(r) for r in c.execute('select competition_id,file_url from event_music_files')],'covers':[list(r) for r in c.execute('select id,cover_url from event_competitions')]}))`;
 const db=JSON.parse(execFileSync('python3',['-c',script],{encoding:'utf8'}));
 const files=[];
 for(const [kind,root] of [['music',`${base}/private/event-music`],['music',`${base}/public/uploads/event-music`],['covers',`${base}/public/uploads/event-covers`]]){
  const source=kind==='music'?db.music:db.covers;
  const prefix=kind==='music'?'/uploads/event-music/':'/uploads/event-covers/';
  const owners=new Map(source.filter(r=>r[1]?.startsWith(prefix)).map(r=>[r[1].slice(prefix.length),r[0]]));
  async function walk(dir){for(const item of await fs.readdir(dir,{withFileTypes:true}).catch(e=>{if(e.code==='ENOENT')return [];throw e;})){
   if(item.name.startsWith('.'))continue;
   const file=path.join(dir,item.name);
   if(item.isDirectory())await walk(file);
   else if(item.isFile()){
    const relative=path.relative(root,file).split(path.sep).join('/');
    const event=owners.get(relative)||relative.match(/^(\d+)-/)?.[1]||'_unassigned';
    const area=root.includes('/private/')?'private':'uploads';
    files.push({file,key:`events/${event}/${kind}/${area}/${relative}`});
   }
  }}await walk(root);
 }return files;
}
export async function sync(sample=false){
 await fs.mkdir(stateRoot,{recursive:true,mode:0o700});
 const manifest=await loadManifest();
 await oss('PUT','events/',Buffer.alloc(0),{'x-oss-object-acl':'private','x-oss-forbid-overwrite':'true'}).catch(e=>{if(!e.message.includes('(409)'))throw e;});
 const list=await inventory();let uploaded=0,checked=0;
 for(const entry of (sample?list.slice(0,1):list)){
  const stat=await fs.stat(entry.file);if(Date.now()-stat.mtimeMs<60000)continue;
  const bytes=await fs.readFile(entry.file),hash=sha(bytes);
  let valid=false;
  if(manifest[entry.file]?.sha256===hash&&manifest[entry.file]?.key===entry.key){
   try{const head=await oss('HEAD',entry.key);valid=head.headers.get('x-oss-meta-sha256')===hash&&Number(head.headers.get('content-length'))===bytes.length;}catch(e){if(!e.message.includes('(404)'))throw e;}
  }
  if(!valid){
   await oss('PUT',entry.key,bytes,{'x-oss-object-acl':'private','x-oss-meta-sha256':hash});
   const copy=Buffer.from(await (await oss('GET',entry.key)).arrayBuffer());
   if(sha(copy)!==hash)throw new Error('OSS checksum verification failed');
   uploaded++;
  }
  manifest[entry.file]={key:entry.key,sha256:hash,bytes:bytes.length,verifiedAt:new Date().toISOString()};checked++;
 }
 await fs.writeFile(path.join(stateRoot,'manifest.tmp'),JSON.stringify(manifest,null,2),{mode:0o600});
 await fs.rename(path.join(stateRoot,'manifest.tmp'),path.join(stateRoot,'manifest.json'));
 const result={time:new Date().toISOString(),bucket,prefix:'events/',discovered:list.length,checked,uploaded};console.log(JSON.stringify(result));return result;
}
if(process.argv[1]&&path.resolve(process.argv[1])===new URL(import.meta.url).pathname)await sync(process.argv.includes('--sample'));
