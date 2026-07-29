import path from 'path';
import { Readable } from 'stream';

const Busboy = require('next/dist/compiled/busboy');

export const MAX_COVER_IMAGE_SIZE = 2 * 1024 * 1024;
export const MAX_COVER_IMAGE_SIZE_TEXT = '2M';
const MAX_MULTIPART_BODY_SIZE = MAX_COVER_IMAGE_SIZE + 512 * 1024;

const MIME_EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',
};

export type ParsedCoverImageUpload = {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
  fields: Map<string, string>;
};

export function coverUploadError(message: string, status = 400) {
  const err = new Error(message);
  (err as any).status = status;
  return err;
}

export function coverUploadMessage(err: any) {
  const message = String(err?.message || '').trim();
  if (/Single item size exceeds maxSize|File size limit exceeded|图片太大|file too large/i.test(message)) {
    return { message: `图片太大，不能超过${MAX_COVER_IMAGE_SIZE_TEXT}`, status: 413 };
  }
  if (/Unexpected end of form|Multipart/i.test(message)) {
    return { message: '图片上传数据不完整，请重新选择图片上传', status: 400 };
  }
  return {
    message: message || '上传课程主图失败',
    status: Number(err?.status || err?.statusCode || 500),
  };
}

export function extensionFromCoverUpload(mimeType: string, filename: string) {
  const mimeExtension = MIME_EXTENSION[mimeType || ''];
  if (mimeExtension) return mimeExtension;
  const ext = path.extname(filename || '').replace('.', '').toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : '';
}

function busboyFileInfo(infoOrFilename: any, encoding?: string, mimeType?: string) {
  if (typeof infoOrFilename === 'object' && infoOrFilename) {
    return {
      filename: String(infoOrFilename.filename || ''),
      mimeType: String(infoOrFilename.mimeType || infoOrFilename.mime || ''),
    };
  }
  return {
    filename: String(infoOrFilename || ''),
    mimeType: String(mimeType || ''),
  };
}

export async function parseCoverImageUpload(request: Request): Promise<ParsedCoverImageUpload> {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('multipart/form-data')) {
    throw coverUploadError('请使用表单上传课程主图', 400);
  }

  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_MULTIPART_BODY_SIZE) {
    throw coverUploadError(`图片太大，不能超过${MAX_COVER_IMAGE_SIZE_TEXT}`, 413);
  }

  const body = Buffer.from(await request.arrayBuffer());
  if (body.byteLength > MAX_MULTIPART_BODY_SIZE) {
    throw coverUploadError(`图片太大，不能超过${MAX_COVER_IMAGE_SIZE_TEXT}`, 413);
  }

  const fields = new Map<string, string>();
  let uploadedFile: Omit<ParsedCoverImageUpload, 'fields'> | null = null;

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const busboy = Busboy({
      headers: Object.fromEntries(request.headers.entries()),
      defCharset: 'utf8',
      defParamCharset: 'utf8',
      limits: {
        fileSize: MAX_COVER_IMAGE_SIZE,
        files: 1,
        fields: 20,
      },
    });

    const fail = (err: any) => {
      if (settled) return;
      settled = true;
      reject(err);
    };

    busboy.on('field', (name: string, value: string) => {
      fields.set(name, value);
    });

    busboy.on('file', (fieldName: string, fileStream: NodeJS.ReadableStream, infoOrFilename: any, encoding?: string, mimeType?: string) => {
      if (fieldName !== 'file' || uploadedFile) {
        fileStream.resume();
        return;
      }

      const info = busboyFileInfo(infoOrFilename, encoding, mimeType);
      if (!String(info.mimeType || '').startsWith('image/')) {
        fileStream.resume();
        fail(coverUploadError('课程主图仅支持图片文件', 400));
        return;
      }

      const chunks: Buffer[] = [];
      let size = 0;
      let limited = false;

      fileStream.on('data', (chunk: Buffer) => {
        size += chunk.length;
        chunks.push(chunk);
      });
      fileStream.on('limit', () => {
        limited = true;
        fileStream.resume();
        fail(coverUploadError(`图片太大，不能超过${MAX_COVER_IMAGE_SIZE_TEXT}`, 413));
      });
      fileStream.on('error', fail);
      fileStream.on('end', () => {
        if (limited || settled) return;
        uploadedFile = {
          buffer: Buffer.concat(chunks, size),
          originalName: info.filename || `cover-${Date.now()}`,
          mimeType: info.mimeType,
          size,
        };
      });
    });

    busboy.on('filesLimit', () => {
      fail(coverUploadError('一次只能上传一张课程主图', 400));
    });
    busboy.on('error', fail);
    busboy.on('finish', () => {
      if (settled) return;
      settled = true;
      resolve();
    });

    Readable.from(body).pipe(busboy);
  });

  const parsedFile = uploadedFile as Omit<ParsedCoverImageUpload, 'fields'> | null;
  if (!parsedFile) throw coverUploadError('请选择课程主图', 400);
  if (parsedFile.size > MAX_COVER_IMAGE_SIZE) {
    throw coverUploadError(`图片太大，不能超过${MAX_COVER_IMAGE_SIZE_TEXT}`, 413);
  }

  return { ...parsedFile, fields };
}
