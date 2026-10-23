import sharp from 'sharp';
import QRCode from 'qrcode';
import fs from 'node:fs';
import path from 'node:path';
const esc=(v:any)=>String(v||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
export async function exclusiveArtwork(o:any,token:string,qrOnly=false){
 const url=`https://www.swod.com.cn/o/${token}`;
 const qr=await QRCode.toBuffer(url,{width:720,margin:4,errorCorrectionLevel:'H'});
 const logoFile=path.join(process.cwd(),'public/logo_200-20261005.png');
 const logo=fs.existsSync(logoFile)?await sharp(logoFile).resize(96,96,{fit:'contain',background:'#ffffff'}).png().toBuffer():null;
 const branded=logo?await sharp(qr).composite([{input:await sharp({create:{width:116,height:116,channels:4,background:'#ffffff'}}).composite([{input:logo,left:10,top:10}]).png().toBuffer(),left:302,top:302}]).png().toBuffer():qr;
 if(qrOnly)return branded;
 const title=Array.from(String(o.title)).slice(0,44).join(''),lines=[Array.from(title).slice(0,22).join(''),Array.from(title).slice(22).join('')];
 const expires=o.expiresAt?new Date(o.expiresAt).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false}):'长期有效';
 const inactive=['cancelled','expired'].includes(o.status);
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="960"><rect width="1200" height="960" rx="36" fill="#10273e"/><rect x="30" y="30" width="1140" height="900" rx="24" fill="none" stroke="#d8b879" stroke-width="3"/><g font-family="Noto Sans CJK SC, WenQuanYi Micro Hei, sans-serif" fill="#f3dfb4"><text x="72" y="118" font-size="42" font-weight="bold">SWOD 伊娃东方舞 · 官方订单</text><text x="72" y="175" font-size="24">${esc(o.number)} · ${o.kind==='goods'?'专属商品订单':'专属课程订单'}</text><text x="72" y="275" font-size="46" fill="#fff">${esc(lines[0])}</text><text x="72" y="340" font-size="46" fill="#fff">${esc(lines[1])}</text><text x="72" y="407" font-size="28">${esc(String(o.spec).slice(0,38))}</text><text x="72" y="485" font-size="30">应付金额</text><text x="72" y="588" font-size="88" font-weight="bold">¥${(o.totalFen/100).toFixed(2)}</text><text x="72" y="660" font-size="28">课程／销售顾问：${esc(o.advisor)}</text><text x="72" y="713" font-size="24">有效期：${esc(expires)}</text><rect x="72" y="756" width="700" height="77" rx="16" fill="#d8b879"/><text x="107" y="808" font-size="34" fill="#10273e" font-weight="bold">${inactive?'订单已失效，请联系顾问':'查看订单并支付 →'}</text><text x="72" y="896" font-size="25">伊娃文化艺术发展（湖南）有限公司</text><text x="847" y="820" font-size="22">扫码确认订单并支付</text></g></svg>`;
 return sharp(Buffer.from(svg)).composite([{input:await sharp(branded).resize(290,290).toBuffer(),left:836,top:493}]).png().toBuffer();
}
