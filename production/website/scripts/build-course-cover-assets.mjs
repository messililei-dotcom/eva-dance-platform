import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import process from 'process';
import sharp from 'sharp';

const projectRoot = process.cwd();
const platformSource = process.argv[2]
  || process.env.ADMIN_COURSE_COVERS_SOURCE
  || '/www/wwwroot/dongfangwuquan/admin-platform/public/uploads/online-course/series-covers';
const platformOutput = path.join(projectRoot, 'public/images/courses/platform');
const onlineSource = path.join(projectRoot, 'public/images/courses/online');
const manifestPath = path.join(projectRoot, 'src/generated/course-cover-manifest.json');
const sourceExtensions = new Set(['.jpg', '.jpeg', '.png']);

async function imageFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && sourceExtensions.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, 'zh-CN'));
}

async function optimizedBuffers(sourcePath) {
  const input = await fs.readFile(sourcePath);
  const pipeline = sharp(input, { failOn: 'warning' })
    .rotate()
    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true });
  const [metadata, webp, avif] = await Promise.all([
    sharp(input).metadata(),
    pipeline.clone().webp({ quality: 74, effort: 6, smartSubsample: true }).toBuffer(),
    pipeline.clone().avif({ quality: 52, effort: 6, chromaSubsampling: '4:2:0' }).toBuffer(),
  ]);
  return { input, metadata, webp, avif };
}

async function writeOptimized(targetPath, optimized) {
  await fs.writeFile(targetPath, optimized);
  return optimized.length;
}

async function buildPlatformCovers() {
  await fs.mkdir(platformOutput, { recursive: true });
  const manifest = {};
  const files = await imageFiles(platformSource);

  for (const filename of files) {
    const sourcePath = path.join(platformSource, filename);
    const { input, metadata, webp, avif } = await optimizedBuffers(sourcePath);
    const digest = crypto.createHash('sha256').update(input).digest('hex').slice(0, 16);
    const baseName = `course-cover-${digest}`;
    const webpName = `${baseName}.webp`;
    const avifName = `${baseName}.avif`;
    await fs.writeFile(path.join(platformOutput, webpName), webp);
    await fs.writeFile(path.join(platformOutput, avifName), avif);
    manifest[filename] = {
      webp: `/images/courses/platform/${webpName}`,
      avif: `/images/courses/platform/${avifName}`,
      width: metadata.width || 0,
      height: metadata.height || 0,
      sourceBytes: input.length,
      webpBytes: webp.length,
      avifBytes: avif.length,
    };
  }

  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, `${JSON.stringify({ version: 1, covers: manifest }, null, 2)}\n`);
  return Object.values(manifest);
}

async function buildBundledOnlineCovers() {
  const files = await imageFiles(onlineSource);
  const results = [];
  for (const filename of files) {
    const sourcePath = path.join(onlineSource, filename);
    const { input, webp, avif } = await optimizedBuffers(sourcePath);
    const basePath = path.join(onlineSource, path.basename(filename, path.extname(filename)));
    const webpBytes = await writeOptimized(`${basePath}.webp`, webp);
    const avifBytes = await writeOptimized(`${basePath}.avif`, avif);
    results.push({ sourceBytes: input.length, webpBytes, avifBytes });
  }
  return results;
}

function total(rows, key) {
  return rows.reduce((sum, row) => sum + Number(row[key] || 0), 0);
}

const [platformRows, onlineRows] = await Promise.all([
  buildPlatformCovers(),
  buildBundledOnlineCovers(),
]);

console.log(JSON.stringify({
  platformCovers: platformRows.length,
  platformSourceMB: +(total(platformRows, 'sourceBytes') / 1024 / 1024).toFixed(2),
  platformWebpMB: +(total(platformRows, 'webpBytes') / 1024 / 1024).toFixed(2),
  platformAvifMB: +(total(platformRows, 'avifBytes') / 1024 / 1024).toFixed(2),
  bundledOnlineCovers: onlineRows.length,
  bundledSourceMB: +(total(onlineRows, 'sourceBytes') / 1024 / 1024).toFixed(2),
  bundledWebpMB: +(total(onlineRows, 'webpBytes') / 1024 / 1024).toFixed(2),
  bundledAvifMB: +(total(onlineRows, 'avifBytes') / 1024 / 1024).toFixed(2),
}, null, 2));
