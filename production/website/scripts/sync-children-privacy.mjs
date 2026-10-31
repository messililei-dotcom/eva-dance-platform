import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const website = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const root = path.resolve(website, '../..');
const policy = JSON.parse(fs.readFileSync(path.join(website, 'src/content/children-privacy.json'), 'utf8'));
const android = path.join(root, 'app开发/Android/EvaDance/app/src/main/assets');
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const style = 'body{max-width:820px;margin:32px auto;padding:0 20px;font:16px/1.85 system-ui,sans-serif;color:#20242b}h1{font-size:1.7em}h2{font-size:1.2em}p{margin:1em 0}a{color:#9f1d20}nav{margin-bottom:24px}a:focus-visible{outline:3px solid #9f1d20;outline-offset:3px}@media print{nav{display:none}body{margin:0}section{break-inside:avoid}}';
const nav = '<nav aria-label="政策导航"><a href="/privacy">隐私政策</a> · <a href="/app/children-privacy.html">儿童规则</a> · <a href="/app/terms.html">服务条款</a> · <a href="/app/processors.html">服务商与数据清单</a></nav>';
const document = (title, body) => `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>${style}</style></head><body>${nav}<main>${body}</main><footer><a href="https://www.swod.com.cn/contact">儿童隐私负责人及客服</a> · 湘ICP备2026005683号-5A</footer></body></html>\n`;
const plain = [policy.title, `规则版本：${policy.version}；更新与生效日期：${policy.updatedAt}`, `运营主体：${policy.operator}`, policy.scope, ...policy.sections.flatMap(section => [section.title, ...section.paragraphs])].join('\n\n');
const childrenHTML = document(policy.title, `<h1>${escape(policy.title)}</h1><p>规则版本：${escape(policy.version)}；更新与生效日期：${escape(policy.updatedAt)}</p><p>运营主体：${escape(policy.operator)}</p><p>${escape(policy.scope)}</p>${policy.sections.map(section => `<section><h2>${escape(section.title)}</h2>${section.paragraphs.map(p => `<p>${escape(p)}</p>`).join('')}</section>`).join('')}`);
const privacyPath = path.join(android, 'app-privacy.txt');
let privacy = fs.readFileSync(privacyPath, 'utf8');
const old = /七、未成年人、政策更新与联系\n[^\n]+/;
const current = /七、儿童个人信息保护\n[\s\S]*?八、政策更新与联系\n[^\n]+/;
const replacement = `七、儿童个人信息保护\n${plain}\n\n完整规则：https://www.swod.com.cn/app/children-privacy.html\n\n八、政策更新与联系\n重要变化将更新政策和同意版本，涉及儿童处理的实质变化需重新取得监护人同意。官方联系方式：13548955558，13548955558@qq.com，https://www.swod.com.cn/contact 。`;
if (current.test(privacy)) privacy = privacy.replace(current, () => replacement);
else if (old.test(privacy)) privacy = privacy.replace(old, () => replacement);
else throw new Error('Android privacy section not recognized; no files changed.');
privacy = privacy.replace(/更新与生效日期：2026年\d+月\d+日/, `更新与生效日期：${policy.updatedAt}`);
const infoPath = path.join(android, 'release-info.json');
const info = JSON.parse(fs.readFileSync(infoPath, 'utf8'));
info.privacyVersion = policy.version;
info.childrenPrivacyURL = 'https://www.swod.com.cn/app/children-privacy.html';
const privacyHTML = document('SWOD 安卓 App 隐私政策', privacy.split('\n\n').map((block, index) => {
  const [title, ...lines] = block.split('\n');
  const paragraph = lines.length ? `<p>${escape(lines.join('\n')).replaceAll('\n', '<br>')}</p>` : '';
  if (index === 0) return `<h1>${escape(title)}</h1>${paragraph}`;
  if (/^[一二三四五六七八九十]+、/.test(title)) return `<section><h2>${escape(title)}</h2>${paragraph}</section>`;
  return `<p>${escape(block).replaceAll('\n', '<br>')}</p>`;
}).join(''));
const outputs = new Map([
  [privacyPath, privacy],
  [infoPath, `${JSON.stringify(info, null, 2)}\n`],
  [path.join(website, 'public/app/privacy.html'), privacyHTML],
  [path.join(website, 'public/app/children-privacy.html'), childrenHTML],
]);
let mismatch = false;
for (const [file, content] of outputs) {
  if (process.argv.includes('--check')) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) { process.stderr.write(`Out of sync: ${file}\n`); mismatch = true; }
  } else fs.writeFileSync(file, content);
}
if (mismatch) process.exitCode = 1;
else process.stdout.write(`Children privacy ${policy.version}: ${process.argv.includes('--check') ? 'consistent' : 'synced'} across public pages and Android text.\n`);
