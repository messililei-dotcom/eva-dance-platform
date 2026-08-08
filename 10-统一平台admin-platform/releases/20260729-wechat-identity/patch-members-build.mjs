import fs from 'node:fs';
import path from 'node:path';

const admin = '/www/wwwroot/dongfangwuquan/admin-platform';
const build = path.join(admin, '.next-build');
const oldName = 'page-7b86e878f9775177.js';
const newName = 'page-wechat-id-hotfix-20260729.js';
const clientOld = path.join(build, 'static/chunks/app/(admin)/members', oldName);
const clientNew = path.join(build, 'static/chunks/app/(admin)/members', newName);
const serverPage = path.join(build, 'server/app/(admin)/members/page.js');

const identity = variable => `(e=>{let r=e&&e.raw||{},u=e&&e.wxUnionid||e&&e.wx_unionid||r.wxUnionid||r.wx_unionid||"",o=e&&e.wxOpenid||e&&e.wx_openid||r.wxOpenid||r.wx_openid||"";return{wxUnionid:String(u||"").trim(),wxOpenid:String(o||"").trim()}})(${variable})`;
const shortId = variable => `(e=>{e=String(e||"").trim();return e.length<=16?e:e.slice(0,8)+"..."+e.slice(-4)})(${variable})`;

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label} expected once, found ${count}`);
  return source.replace(before, after);
}

let client = fs.readFileSync(clientOld, 'utf8');
client = replaceOnce(client, 'getMemberIdentity(t)', identity('t'), 'client identity');
client = replaceOnce(client, 'shortWxId(a)', shortId('a'), 'client short id');
fs.writeFileSync(clientNew, client);

let server = fs.readFileSync(serverPage, 'utf8');
server = replaceOnce(server, 'getMemberIdentity(b)', identity('b'), 'server identity');
server = replaceOnce(server, 'shortWxId(e)', shortId('e'), 'server short id');
fs.writeFileSync(serverPage, server);

const referenceFiles = [
  'server/app/members.rsc',
  'server/app/members.segments/_full.segment.rsc',
  'server/app/(admin)/members/page_client-reference-manifest.js',
  'server/app/(admin)/members/[id]/page_client-reference-manifest.js',
  'server/app/members.html',
];

for (const relative of referenceFiles) {
  const target = path.join(build, relative);
  const source = fs.readFileSync(target, 'utf8');
  const count = source.split(oldName).length - 1;
  if (count < 1) throw new Error(`${relative} has no old chunk reference`);
  fs.writeFileSync(target, source.split(oldName).join(newName));
}

fs.unlinkSync(clientOld);

