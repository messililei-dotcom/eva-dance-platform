import crypto from 'crypto';
import fs from 'fs';
import https from 'https';
import path from 'path';

type RpcParams = Record<string, string | number | undefined>;
function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
const VOD_RPC_TIMEOUT_MS = positiveNumber(process.env.ALIYUN_VOD_RPC_TIMEOUT_MS, 60000);
const VOD_UPLOAD_TIMEOUT_MS = positiveNumber(process.env.ALIYUN_VOD_UPLOAD_TIMEOUT_MS, 300000);
const VOD_UPLOAD_TIMEOUT_BYTES_PER_SECOND = positiveNumber(process.env.ALIYUN_VOD_UPLOAD_TIMEOUT_BYTES_PER_SECOND, 512 * 1024);

export class VodRpcError extends Error {
  code = '';
  statusCode = 0;

  constructor(message: string, code = '', statusCode = 0) {
    super(message);
    this.name = 'VodRpcError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

type DecodedUploadAddress = {
  Endpoint?: string;
  Bucket?: string;
  FileName?: string;
};

type DecodedUploadAuth = {
  AccessKeyId?: string;
  AccessKeySecret?: string;
  SecurityToken?: string;
  Expiration?: string;
};

export type VodConfigStatus = {
  ready: boolean;
  region: string;
  hasAccessKeyId: boolean;
  hasAccessKeySecret: boolean;
  hasStorageLocation: boolean;
  hasAppId: boolean;
  hasTemplateGroupId: boolean;
  missingRequired: string[];
  missingOptional: string[];
};

export type VodUploadResult = {
  videoId: string;
  objectName: string;
  bucket: string;
  endpoint: string;
};

export type VodPlayOption = {
  url: string;
  format: string;
  definition: string;
  label: string;
  value: string;
  size: number;
  duration: number;
};

export type VodVideoInfo = {
  videoId: string;
  title: string;
  status: string;
  coverUrl: string;
  duration: number;
  size: number;
  creationTime: string;
};

export type VodCategoryInfo = {
  cateId: number;
  cateName: string;
  parentId: number;
  level: number;
  type: string;
  subTotal: number;
};

function vodRegion() {
  return process.env.ALIYUN_VOD_REGION || 'cn-shenzhen';
}

function vodNumber(...values: unknown[]) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
}

function vodVideoInfoFromRpc(item: any): VodVideoInfo {
  return {
    videoId: String(item?.VideoId || item?.VideoID || item?.VideoIDString || '').trim(),
    title: String(item?.Title || '').trim(),
    status: String(item?.Status || '').trim(),
    coverUrl: String(item?.CoverURL || item?.CoverUrl || item?.CoverURLString || '').trim(),
    duration: vodNumber(item?.Duration, item?.DurationSeconds),
    size: vodNumber(item?.Size, item?.FileSize, item?.Mezzanine?.FileSize),
    creationTime: String(item?.CreationTime || item?.CreationDate || item?.CreateTime || '').trim(),
  };
}

export function isVodConfigured() {
  return Boolean(process.env.ALIYUN_ACCESS_KEY_ID && process.env.ALIYUN_ACCESS_KEY_SECRET);
}

export function getVodConfigStatus(): VodConfigStatus {
  const hasAccessKeyId = Boolean(process.env.ALIYUN_ACCESS_KEY_ID);
  const hasAccessKeySecret = Boolean(process.env.ALIYUN_ACCESS_KEY_SECRET);
  const hasStorageLocation = Boolean(process.env.ALIYUN_VOD_STORAGE_LOCATION);
  const hasAppId = Boolean(process.env.ALIYUN_VOD_APP_ID);
  const hasTemplateGroupId = Boolean(process.env.ALIYUN_VOD_TEMPLATE_GROUP_ID);
  const missingRequired = [
    !hasAccessKeyId ? 'ALIYUN_ACCESS_KEY_ID' : '',
    !hasAccessKeySecret ? 'ALIYUN_ACCESS_KEY_SECRET' : '',
  ].filter(Boolean);
  const missingOptional = [
    !hasStorageLocation ? 'ALIYUN_VOD_STORAGE_LOCATION' : '',
    !hasAppId ? 'ALIYUN_VOD_APP_ID' : '',
    !hasTemplateGroupId ? 'ALIYUN_VOD_TEMPLATE_GROUP_ID' : '',
  ].filter(Boolean);
  return {
    ready: missingRequired.length === 0,
    region: vodRegion(),
    hasAccessKeyId,
    hasAccessKeySecret,
    hasStorageLocation,
    hasAppId,
    hasTemplateGroupId,
    missingRequired,
    missingOptional,
  };
}

function percentEncode(value: string) {
  return encodeURIComponent(value)
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/%7E/g, '~');
}

function signedRpcParams(action: string, params: RpcParams) {
  const accessKeyId = process.env.ALIYUN_ACCESS_KEY_ID || '';
  const accessKeySecret = process.env.ALIYUN_ACCESS_KEY_SECRET || '';
  if (!accessKeyId || !accessKeySecret) throw new Error('阿里云 AccessKey 未配置');

  const allParams: Record<string, string> = {
    Action: action,
    Version: '2017-03-21',
    Format: 'JSON',
    SignatureMethod: 'HMAC-SHA1',
    SignatureNonce: `${Date.now()}${Math.random()}`,
    SignatureVersion: '1.0',
    AccessKeyId: accessKeyId,
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
    RegionId: vodRegion(),
  };
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') allParams[key] = String(value);
  });

  const canonicalizedQuery = Object.keys(allParams)
    .sort()
    .map(key => `${percentEncode(key)}=${percentEncode(allParams[key])}`)
    .join('&');
  const stringToSign = `POST&${percentEncode('/')}&${percentEncode(canonicalizedQuery)}`;
  const signature = crypto.createHmac('sha1', `${accessKeySecret}&`).update(stringToSign).digest('base64');
  return { ...allParams, Signature: signature };
}

async function callVodRpc<T = any>(action: string, params: RpcParams): Promise<T> {
  const body = new URLSearchParams(signedRpcParams(action, params)).toString();
  const hostname = `vod.${vodRegion()}.aliyuncs.com`;

  return new Promise<T>((resolve, reject) => {
    const req = https.request({
      hostname,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed: any = null;
        try {
          parsed = JSON.parse(data || '{}');
        } catch {
          return reject(new Error(`VOD 响应解析失败：${data.slice(0, 200)}`));
        }
        if (res.statusCode && res.statusCode >= 400) {
          return reject(new VodRpcError(parsed.Message || parsed.message || `VOD 请求失败 (${res.statusCode})`, parsed.Code || parsed.code || '', res.statusCode));
        }
        if (parsed.Code && parsed.Code !== 'OK') {
          return reject(new VodRpcError(parsed.Message || parsed.Code, parsed.Code));
        }
        resolve(parsed as T);
      });
    });
    req.on('error', reject);
    req.setTimeout(VOD_RPC_TIMEOUT_MS, () => {
      req.destroy(new Error('VOD 请求超时，请稍后重试'));
    });
    req.write(body);
    req.end();
  });
}

function decodeVodBase64<T>(value: string): T {
  return JSON.parse(Buffer.from(value, 'base64').toString('utf8')) as T;
}

function ossObjectUrl(endpoint: string, bucket: string, objectName: string) {
  const cleanedEndpoint = endpoint.replace(/^https?:\/\//, '');
  return `https://${bucket}.${cleanedEndpoint}/${objectName.split('/').map(percentEncode).join('/')}`;
}

function ossCanonicalResource(bucket: string, objectName: string) {
  return `/${bucket}/${objectName}`;
}

function signOssPut(auth: DecodedUploadAuth, bucket: string, objectName: string, date: string, contentType: string) {
  if (!auth.AccessKeyId || !auth.AccessKeySecret) throw new Error('VOD 上传凭证缺少 AccessKey');
  const headers = auth.SecurityToken ? `x-oss-security-token:${auth.SecurityToken}\n` : '';
  const stringToSign = [
    'PUT',
    '',
    contentType,
    date,
    headers + ossCanonicalResource(bucket, objectName),
  ].join('\n');
  const signature = crypto.createHmac('sha1', auth.AccessKeySecret).update(stringToSign).digest('base64');
  return `OSS ${auth.AccessKeyId}:${signature}`;
}

function uploadTimeoutForSize(fileSize: number) {
  const speed = Math.max(128 * 1024, VOD_UPLOAD_TIMEOUT_BYTES_PER_SECOND);
  return Math.max(VOD_UPLOAD_TIMEOUT_MS, Math.ceil(fileSize / speed) * 1000);
}

async function putObjectByUploadAuth(filePath: string, uploadAddress: DecodedUploadAddress, uploadAuth: DecodedUploadAuth) {
  const endpoint = uploadAddress.Endpoint || '';
  const bucket = uploadAddress.Bucket || '';
  const objectName = uploadAddress.FileName || '';
  if (!endpoint || !bucket || !objectName) throw new Error('VOD 上传地址缺少 Endpoint/Bucket/FileName');

  const stat = fs.statSync(filePath);
  const date = new Date().toUTCString();
  const contentType = 'application/octet-stream';
  const url = new URL(ossObjectUrl(endpoint, bucket, objectName));

  await new Promise<void>((resolve, reject) => {
    const readStream = fs.createReadStream(filePath);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
      method: 'PUT',
      headers: {
        Authorization: signOssPut(uploadAuth, bucket, objectName, date, contentType),
        Date: date,
        'Content-Type': contentType,
        'Content-Length': stat.size,
        ...(uploadAuth.SecurityToken ? { 'x-oss-security-token': uploadAuth.SecurityToken } : {}),
      },
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`OSS 上传失败 (${res.statusCode})：${data.slice(0, 300)}`));
          return;
        }
        resolve();
      });
    });
    req.on('error', reject);
    req.setTimeout(uploadTimeoutForSize(stat.size), () => {
      const err = new Error('VOD 上传超时，请稍后重试或检查服务器上行带宽');
      readStream.destroy(err);
      req.destroy(err);
    });
    readStream.on('error', reject).pipe(req);
  });

  return { endpoint, bucket, objectName };
}

function titleForVod(name: string) {
  const base = path.basename(name, path.extname(name)).trim() || '素材视频';
  return Array.from(base).slice(0, 128).join('');
}

function fileNameForVodUpload(name: string) {
  const original = path.basename(name || '').trim() || `video-${Date.now()}.mp4`;
  const ext = (path.extname(original) || '.mp4').toLowerCase();
  const base = path.basename(original, ext)
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72) || 'material-video';
  const hash = crypto.createHash('sha1').update(original).digest('hex').slice(0, 10);
  return `${base}-${hash}${ext}`;
}

export async function updateVodVideoInfo(input: {
  videoId: string;
  title?: string;
  description?: string;
  tags?: string;
  coverUrl?: string;
}) {
  if (!input.videoId) return null;
  return callVodRpc('UpdateVideoInfo', {
    VideoId: input.videoId,
    Title: input.title ? titleForVod(input.title) : undefined,
    Description: input.description,
    Tags: input.tags,
    CoverURL: input.coverUrl,
  });
}

export function isVodVideoMissingError(err: unknown) {
  const code = String((err as any)?.code || '').toLowerCase();
  const message = String((err as any)?.message || '').toLowerCase();
  return (
    (code.includes('video') && (
      code.includes('notfound')
      || code.includes('not.found')
      || code.includes('notexist')
      || code.includes('not.exist')
    ))
    || message.includes('video does not exist')
    || message.includes('video is not exist')
    || message.includes('视频不存在')
  );
}

export async function getVodVideoStatus(videoId: string) {
  const id = String(videoId || '').trim();
  if (!id) return { exists: false, status: null };
  try {
    const response = await callVodRpc<any>('GetVideoInfo', { VideoId: id });
    const video = response?.Video ? vodVideoInfoFromRpc(response.Video) : null;
    return {
      exists: Boolean(video?.videoId || response?.Video),
      status: video?.status || null,
      videoId: video?.videoId || id,
      title: video?.title || '',
      coverUrl: video?.coverUrl || '',
      duration: video?.duration || 0,
      size: video?.size || 0,
      creationTime: video?.creationTime || '',
    };
  } catch (err) {
    if (isVodVideoMissingError(err)) return { exists: false, status: null };
    throw err;
  }
}

export async function listVodVideos(input: { page?: number; pageSize?: number } = {}) {
  const page = Math.max(1, Math.floor(Number(input.page || 1)));
  const pageSize = Math.max(1, Math.min(100, Math.floor(Number(input.pageSize || 50))));
  const response = await callVodRpc<any>('GetVideoList', {
    PageNo: page,
    PageSize: pageSize,
  });
  const videos = asArray(response?.VideoList?.Video)
    .map((item: any): VodVideoInfo => vodVideoInfoFromRpc(item))
    .filter(item => item.videoId);
  return {
    page,
    pageSize,
    total: Number(response?.Total || response?.TotalCount || 0),
    videos,
  };
}

function vodCategoryFromRaw(item: any): VodCategoryInfo | null {
  const cateId = Number(item?.CateId ?? item?.cateId ?? 0);
  if (!Number.isFinite(cateId) || cateId <= 0) return null;
  return {
    cateId,
    cateName: String(item?.CateName ?? item?.cateName ?? '').trim(),
    parentId: Number(item?.ParentId ?? item?.parentId ?? -1),
    level: Number(item?.Level ?? item?.level ?? 0),
    type: String(item?.Type ?? item?.type ?? ''),
    subTotal: Number(item?.SubTotal ?? item?.subTotal ?? 0),
  };
}

export async function getVodSubCategories(parentId = -1) {
  const response = await callVodRpc<any>('GetCategories', { CateId: parentId });
  return asArray(response?.SubCategories?.Category)
    .map(vodCategoryFromRaw)
    .filter((item): item is VodCategoryInfo => Boolean(item));
}

export async function addVodCategory(input: { name: string; parentId?: number }) {
  const response = await callVodRpc<any>('AddCategory', {
    CateName: input.name,
    ParentId: Number.isFinite(Number(input.parentId)) ? Number(input.parentId) : -1,
  });
  const category = vodCategoryFromRaw(response?.Category);
  const cateId = category?.cateId || Number(response?.CateId || 0);
  if (!cateId) throw new Error('VOD 未返回分类 ID');
  return cateId;
}

export async function updateVodCategory(input: { cateId: number; name: string }) {
  await callVodRpc('UpdateCategory', {
    CateId: input.cateId,
    CateName: input.name,
  });
  return true;
}

export async function ensureVodCategory(input: { name: string; parentId?: number }) {
  const name = String(input.name || '').trim();
  if (!name) throw new Error('VOD 分类名称不能为空');
  const parentId = Number.isFinite(Number(input.parentId)) ? Number(input.parentId) : -1;
  const existing = (await getVodSubCategories(parentId)).find(item => item.cateName === name);
  if (existing) return existing.cateId;
  return addVodCategory({ name, parentId });
}

export async function deleteVodVideos(videoIds: string[]) {
  const ids = Array.from(new Set(videoIds.map(id => String(id || '').trim()).filter(Boolean)));
  if (!ids.length) return { deleted: 0, missing: 0 };
  let deleted = 0;
  let missing = 0;
  for (const id of ids) {
    try {
      await callVodRpc('DeleteVideo', { VideoIds: id });
      deleted += 1;
    } catch (err) {
      if (isVodVideoMissingError(err)) {
        missing += 1;
        continue;
      }
      throw err;
    }
  }
  return { deleted, missing };
}

export async function uploadLocalVideoToVod(input: {
  filePath: string;
  fileName: string;
  fileSize?: number;
  title?: string;
  description?: string;
  templateGroupId?: string;
  cateId?: number;
}): Promise<VodUploadResult> {
  const fileName = input.fileName || path.basename(input.filePath);
  const response = await callVodRpc<{
    VideoId?: string;
    UploadAddress?: string;
    UploadAuth?: string;
  }>('CreateUploadVideo', {
    Title: titleForVod(input.title || fileName),
    FileName: fileNameForVodUpload(fileName),
    FileSize: input.fileSize || fs.statSync(input.filePath).size,
    Description: input.description,
    StorageLocation: process.env.ALIYUN_VOD_STORAGE_LOCATION,
    AppId: process.env.ALIYUN_VOD_APP_ID,
    TemplateGroupId: input.templateGroupId || process.env.ALIYUN_VOD_TEMPLATE_GROUP_ID,
    CateId: Number(input.cateId || 0) > 0 ? Number(input.cateId) : undefined,
  });

  if (!response.VideoId || !response.UploadAddress || !response.UploadAuth) {
    throw new Error('VOD 未返回完整上传凭证');
  }

  const uploadAddress = decodeVodBase64<DecodedUploadAddress>(response.UploadAddress);
  const uploadAuth = decodeVodBase64<DecodedUploadAuth>(response.UploadAuth);
  let uploaded: Awaited<ReturnType<typeof putObjectByUploadAuth>>;
  try {
    uploaded = await putObjectByUploadAuth(input.filePath, uploadAddress, uploadAuth);
  } catch (err) {
    await deleteVodVideos([response.VideoId]).catch(() => null);
    throw err;
  }
  return {
    videoId: response.VideoId,
    objectName: uploaded.objectName,
    bucket: uploaded.bucket,
    endpoint: uploaded.endpoint,
  };
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function vodDefinitionLabel(definition: string) {
  const key = definition.toLowerCase();
  const labels: Record<string, string> = {
    fd: '流畅',
    ld: '流畅',
    sd: '标清',
    hd: '高清',
    od: '原画',
    '2k': '2K',
    '4k': '4K',
  };
  return labels[key] || definition.toUpperCase() || '自动';
}

function definitionRank(definition: string) {
  const ranks: Record<string, number> = {
    fd: 10,
    ld: 20,
    sd: 30,
    hd: 40,
    od: 50,
    '2k': 60,
    '4k': 70,
  };
  return ranks[definition.toLowerCase()] || 0;
}

function preferPlayInfo(current: VodPlayOption | undefined, next: VodPlayOption) {
  if (!current) return next;
  if (current.format !== 'm3u8' && next.format === 'm3u8') return next;
  return current;
}

export function normalizeVodPlayUrl(value: string) {
  const playDomain = String(process.env.ALIYUN_VOD_PLAY_DOMAIN || 'vod.swod.com.cn')
    .trim()
    .toLowerCase();
  const legacyDomains = new Set(
    String(process.env.ALIYUN_VOD_LEGACY_PLAY_DOMAINS || 'vod.dongfangwuquan.com')
      .split(',')
      .map(item => item.trim().toLowerCase())
      .filter(Boolean),
  );
  if (!value || !playDomain || !legacyDomains.size) return value;

  try {
    const url = new URL(value);
    if (!legacyDomains.has(url.hostname.toLowerCase())) return value;
    url.hostname = playDomain;
    return url.toString();
  } catch {
    return value;
  }
}

export async function getVodPlayOptions(videoId: string): Promise<VodPlayOption[]> {
  if (!videoId) return [];
  const response = await callVodRpc<any>('GetPlayInfo', {
    VideoId: videoId,
    Formats: process.env.ALIYUN_VOD_PLAY_FORMATS || 'm3u8,mp4',
    AuthTimeout: Number(process.env.ALIYUN_VOD_PLAY_AUTH_TIMEOUT || 3600),
  });
  const playInfo = asArray(response?.PlayInfoList?.PlayInfo);
  const byDefinition = new Map<string, VodPlayOption>();
  playInfo
    .map((item: any) => {
      const definition = String(item.Definition || '').toLowerCase();
      const format = String(item.Format || '').toLowerCase();
      return {
        // Older VOD assets can keep returning the retired playback domain even
        // when PlayConfig requests the current one. The old CDN has no CORS
        // response and is unreliable outside mainland China, while both
        // domains address the same signed VOD object.
        url: normalizeVodPlayUrl(String(item.PlayURL || '')),
        format,
        definition,
        label: vodDefinitionLabel(definition),
        value: definition || format || 'auto',
        size: vodNumber(item.Size, item.FileSize),
        duration: vodNumber(item.Duration),
      };
    })
    .filter(item => item.url)
    .forEach(item => {
      const key = item.definition || item.value;
      byDefinition.set(key, preferPlayInfo(byDefinition.get(key), item));
    });
  return Array.from(byDefinition.values())
    .sort((left, right) => definitionRank(left.definition) - definitionRank(right.definition));
}

export async function getVodPlayUrl(videoId: string, formatPolicy: 'default' | 'hls-only' = 'default') {
  if (!videoId) return '';
  const options = await getVodPlayOptions(videoId);
  if (formatPolicy === 'hls-only') {
    return options.find(item => item.format === 'm3u8')?.url || '';
  }
  const preferred = options.find(item => item.format === 'm3u8')
    || options.find(item => item.definition === 'od' || item.definition === 'hd')
    || options.find(item => item.format === 'mp4')
    || options[0];
  return preferred?.url || '';
}
