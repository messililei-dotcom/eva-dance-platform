const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const home=process.env.HOME, root=process.argv[2];
if (!root) throw new Error('Missing working project path');
const original=fs.readFileSync(path.join(root,'build-profile.json5'),'utf8');
const source=path.join(home,'Library/Application Support/EvaAppSigning/harmonyos-release');
const secret=fs.readFileSync(path.join(source,'keystore-password.txt'),'utf8').trim();
const dir=path.join(root,'.signing-material-temporary');
fs.rmSync(dir,{recursive:true,force:true});fs.mkdirSync(dir,{recursive:true,mode:0o700});
for(const [from,to] of [['eva-dance-harmony-release.p12','release.p12'],['SWOD-HarmonyOS-Push-Release-20261029.p7b','release.p7b']])fs.copyFileSync(path.join(source,from),path.join(dir,to));
fs.copyFileSync(process.argv[3],path.join(dir,'release.cer'));
const md=path.join(dir,'material');fs.mkdirSync(md,{mode:0o700});
const fd=path.join(md,'fd');fs.mkdirSync(fd,{mode:0o700});
let parts=[];for(let i=0;i<3;i++){let v=crypto.randomBytes(16);parts.push(v);let d=path.join(fd,String(i));fs.mkdirSync(d,{mode:0o700});fs.writeFileSync(path.join(d,'x'),v,{mode:0o600});}
const ac=path.join(md,'ac');fs.mkdirSync(ac,{mode:0o700});const salt=crypto.randomBytes(16);fs.writeFileSync(path.join(ac,'x'),salt,{mode:0o600});
const comp=Buffer.from([49,243,9,115,214,175,91,184,211,190,177,88,101,131,192,119]);let combined=Buffer.alloc(16);for(const part of [...parts,comp])for(let i=0;i<16;i++)combined[i]^=part[i];
const rootKey=crypto.pbkdf2Sync(combined.toString(),salt,10000,16,'sha256'),workKey=crypto.randomBytes(16);
function enc(key,data){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-128-gcm',key,iv),value=Buffer.concat([cipher.update(data),cipher.final()]),head=Buffer.alloc(4);head.writeUInt32BE(value.length+16);return Buffer.concat([head,iv,value,cipher.getAuthTag()]);}
const ce=path.join(md,'ce');fs.mkdirSync(ce,{mode:0o700});fs.writeFileSync(path.join(ce,'x'),enc(rootKey,workKey),{mode:0o600});
const encrypted=enc(workKey,Buffer.from(secret)).toString('hex');
const config={name:'release',type:'HarmonyOS',material:{storePassword:encrypted,certpath:path.join(dir,'release.cer'),keyAlias:'evadance-release',keyPassword:encrypted,profile:path.join(dir,'release.p7b'),signAlg:'SHA256withECDSA',storeFile:path.join(dir,'release.p12')}};
const changed=original.replace('"signingConfigs": [],','"signingConfigs": ['+JSON.stringify(config)+'],').replace('"name": "default",','"name": "default", "signingConfig": "release",');
const bp=path.join(root,'build-profile.json5');fs.writeFileSync(bp,changed,{mode:0o600});
const clt=path.join(home,'Library/Huawei/CommandLineTools/6.1.1.418/command-line-tools'),java=path.join(home,'Library/Developer/EvaToolchains/jdk-17.0.20.1+1/Contents/Home');
const env={...process.env,JAVA_HOME:java,DEVECO_CLI_CLT_PATH:clt,DEVECO_SDK_HOME:path.join(clt,'sdk'),DEVECO_NODE_HOME:path.join(clt,'tool/node'),PATH:path.join(clt,'tool/node/bin')+':'+path.join(java,'bin')+':'+process.env.PATH};
try{const r=cp.spawnSync(path.join(clt,'bin/hvigorw'),['assembleApp','-p','product=default','-p','buildMode=release','--no-daemon'],{cwd:root,env,encoding:'utf8',maxBuffer:20*1024*1024});const out=(r.stdout+r.stderr).replaceAll(secret,'<REDACTED>').replaceAll(encrypted,'<REDACTED>');console.log(out);if(r.status!==0) process.exitCode=r.status||1;}
finally{fs.writeFileSync(bp,original);fs.rmSync(dir,{recursive:true,force:true});}
