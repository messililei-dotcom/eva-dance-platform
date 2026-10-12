import sharp from 'sharp';

// Keep receipt text legible, including long transaction screenshots. Only the
// re-encoded output is persisted; orientation and private metadata are removed.
export async function compressVoucherImage(input: Buffer): Promise<Buffer> {
  return sharp(input, { limitInputPixels: 80_000_000 })
    .rotate()
    .resize({ width: 1800, height: 12000, fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();
}
