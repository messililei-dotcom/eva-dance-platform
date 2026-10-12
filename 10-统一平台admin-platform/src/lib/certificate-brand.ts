import { QrCode, Ecc } from '@rc-component/qrcode/lib/libs/qrcodegen';

export const CERTIFICATE_BRAND_PREFIX = '伊娃东方舞｜';
export const CERTIFICATE_ART_ROOT = '/uploads/certificates/templates/eva-sealed-20261008-';
export const CERTIFICATE_FONT = "'Noto Serif CJK SC','Songti SC','SimSun',serif";
export function certificateWebsiteUrl(no = '') {
  return `https://www.swod.com.cn/certification${no ? `?no=${encodeURIComponent(no)}` : ''}`;
}
export function certificateBrandKind(seriesId: number, name: string) {
  return seriesId < 0 ? 'offline' : name.includes('成品舞') ? 'performance' : 'online';
}
export function certificateBrandTemplate(seriesId: number, name: string) {
  const kind = certificateBrandKind(seriesId, name);
  return {
    series_id: seriesId,
    template_name: `${CERTIFICATE_BRAND_PREFIX}${name}｜${kind === 'offline' ? '研修金章' : kind === 'performance' ? '舞台华章' : '艺学金章'}`,
    template_image_url: `${CERTIFICATE_ART_ROOT}${kind}.png`,
    width: 1536, height: 1024, status: 'active',
    fields: [
      { key: 'memberName', label: '姓名', x: 50, y: 46, fontSize: 48, color: '#332238', align: 'middle' },
      { key: 'courseName', label: '课程', x: 50, y: 57, fontSize: 30, color: '#493647', align: 'middle' },
      { key: 'issueDate', label: '日期', x: 57, y: 76, fontSize: 22, color: '#493647', align: 'middle' },
      { key: 'certificateNo', label: '编号', x: 50, y: 85, fontSize: 15, color: '#78684F', align: 'middle' },
    ],
  };
}
export function isBrandedCertificate(template: { template_name?: string }) {
  return Boolean(template.template_name?.startsWith(CERTIFICATE_BRAND_PREFIX));
}
function xml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
export function certificateBrandOverlay(seriesId: number, courseName: string, no = '', logo = '/apple-touch-icon-20261005.png') {
  const kind = certificateBrandKind(seriesId, courseName);
  const heading = kind === 'offline' ? '研修结业证书' : kind === 'performance' ? '成品舞结业证书' : '课程结业证书';
  const english = kind === 'offline' ? 'CERTIFICATE OF TRAINING' : 'CERTIFICATE OF COMPLETION';
  const qr = QrCode.encodeText(certificateWebsiteUrl(no), Ecc.MEDIUM);
  const modules: string[] = [];
  for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) if (qr.getModule(x, y)) modules.push(`M${x + 4},${y + 4}h1v1h-1z`);
  return `<g font-family="${xml(CERTIFICATE_FONT)}" text-anchor="middle">
    <image href="${xml(logo)}" x="718" y="75" width="100" height="100"/>
    <text x="768" y="210" font-size="26" letter-spacing="8" fill="#493047">伊娃东方舞</text>
    <text x="768" y="292" font-size="58" letter-spacing="8" fill="#352139">${heading}</text>
    <text x="768" y="333" font-family="Georgia,serif" font-size="18" letter-spacing="5" fill="#9B7948">${english}</text>
    <path d="M570 363H738M798 363H966" fill="none" stroke="#B18C50"/><path d="M768 355l8 8-8 8-8-8z" fill="#B18C50"/>
    <text x="768" y="415" font-size="18" letter-spacing="6" fill="#8F7A5F">兹授予</text>
    <text x="768" y="530" font-size="19" letter-spacing="3" fill="#8F7A5F">已完成以下课程学习</text>
    <text x="768" y="662" font-size="17" letter-spacing="5" fill="#9B7948">以热爱为始 · 以精进为章</text>
    <path d="M330 729H610M758 729H992" stroke="#C7AC7E"/>
    <text x="470" y="778" font-size="23" fill="#493647">伊娃东方舞</text>
    <text x="470" y="814" font-size="13" letter-spacing="3" fill="#96805F">颁发机构 · ISSUED BY</text>
    <text x="875" y="814" font-size="13" letter-spacing="3" fill="#96805F">颁发日期 · DATE</text>
    <a href="${xml(certificateWebsiteUrl(no))}" target="_blank"><svg x="1118" y="716" width="112" height="112" viewBox="0 0 ${qr.size + 8} ${qr.size + 8}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><path d="${modules.join('')}" fill="#302136"/></svg>
    <text x="1174" y="847" font-size="13" fill="#78684F">扫码官网核验</text>
    <text x="768" y="892" font-family="Georgia,serif" font-size="13" letter-spacing="1" fill="#78684F">www.swod.com.cn/certification</text></a>
  </g>`;
}
export function certificateTextLines(value: string, key: string, fontSize: number, width: number) {
  if (key !== 'courseName') return { lines: [value], fontSize: key === 'memberName' ? Math.min(fontSize, width * .60 / Math.max(1, value.length)) : fontSize };
  const maxWidth = width * .64;
  const units = (s: string) => Array.from(s).reduce((n, c) => n + (/[^\x00-\xff]/.test(c) ? 1 : .56), 0);
  const size = Math.min(fontSize, maxWidth * 2 / Math.max(1, units(value)));
  const lines: string[] = []; let line = '';
  for (const c of value) { if (line && units(line + c) * size > maxWidth) { lines.push(line); line = ''; } line += c; }
  if (line) lines.push(line);
  return { lines, fontSize: size };
}
