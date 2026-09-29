import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { renderCertificateSvg, type CertificateTemplate } from './certificates';

export async function renderCertificatePng(record: unknown, template: CertificateTemplate) {
  let image = template.template_image_url;
  if (image && !image.startsWith('data:image/')) {
    const url = new URL(image, 'https://admin.swod.com.cn');
    if (!['admin.swod.com.cn', 'www.swod.com.cn'].includes(url.hostname)) {
      throw new Error('证书底图需上传至平台后预览');
    }
    const root = path.resolve(process.cwd(), 'public', 'uploads');
    const filename = path.resolve(process.cwd(), 'public', '.' + decodeURIComponent(url.pathname));
    if (!filename.startsWith(root + path.sep)) throw new Error('证书底图路径无效');
    const background = await sharp(await fs.readFile(filename)).png().toBuffer();
    image = `data:image/png;base64,${background.toString('base64')}`;
  }
  // librsvg does not load external image URLs; embed the uploaded background.
  const svg = renderCertificateSvg(record, { ...template, template_image_url: image });
  return sharp(Buffer.from(svg)).resize({ width: 1600, withoutEnlargement: true }).png().toBuffer();
}
