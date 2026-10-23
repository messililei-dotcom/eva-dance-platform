import crypto from 'crypto';
import https from 'https';

type RpcParams = Record<string, string | number | undefined>;

export type VodPlayOption = {
  url: string;
  format: string;
  definition: string;
  label: string;
  value: string;
  duration?: number;
};

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

function vodRegion() {
  return process.env.ALIYUN_VOD_REGION || 'cn-shenzhen';
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
  const timeout = Number(process.env.ALIYUN_VOD_RPC_TIMEOUT_MS || 60000);

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
          reject(new Error(`VOD 响应解析失败：${data.slice(0, 200)}`));
          return;
        }
        if (res.statusCode && res.statusCode >= 400) {
          reject(new VodRpcError(parsed.Message || parsed.message || `VOD 请求失败 (${res.statusCode})`, parsed.Code || parsed.code || '', res.statusCode));
          return;
        }
        if (parsed.Code && parsed.Code !== 'OK') {
          reject(new VodRpcError(parsed.Message || parsed.Code, parsed.Code));
          return;
        }
        resolve(parsed as T);
      });
    });
    req.on('error', reject);
    req.setTimeout(timeout, () => req.destroy(new Error('VOD 请求超时，请稍后重试')));
    req.write(body);
    req.end();
  });
}

function asArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function vodDefinitionLabel(definition: string) {
  const labels: Record<string, string> = {
    fd: '流畅',
    ld: '流畅',
    sd: '标清',
    hd: '高清',
    od: '原画',
    '2k': '2K',
    '4k': '4K',
  };
  return labels[definition.toLowerCase()] || definition.toUpperCase() || '自动';
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

export async function getVodPlayOptions(videoId: string): Promise<VodPlayOption[]> {
  if (!videoId) return [];
  const response = await callVodRpc<any>('GetPlayInfo', {
    VideoId: videoId,
    Formats: process.env.ALIYUN_VOD_PLAY_FORMATS || 'm3u8,mp4',
    AuthTimeout: Number(process.env.ALIYUN_VOD_PLAY_AUTH_TIMEOUT || 3600),
    PlayConfig: JSON.stringify({
      PlayDomain: process.env.ALIYUN_VOD_PLAY_DOMAIN || 'vod.swod.com.cn',
    }),
  });
  const byDefinition = new Map<string, VodPlayOption>();
  asArray(response?.PlayInfoList?.PlayInfo)
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
        duration: Number(item.Duration || 0),
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

export async function getVodPlayUrl(videoId: string) {
  const options = await getVodPlayOptions(videoId);
  const preferred = options.find(item => item.format === 'm3u8')
    || options.find(item => item.definition === 'od' || item.definition === 'hd')
    || options.find(item => item.format === 'mp4')
    || options[0];
  return preferred?.url || '';
}

export async function getVodVideoDuration(videoId: string): Promise<number> {
  if (!videoId) return 0;

  try {
    const response = await callVodRpc<any>('GetVideoInfo', { VideoId: videoId });
    const duration = Number(response?.Video?.Duration || 0);
    if (Number.isFinite(duration) && duration > 0) return Math.round(duration);
  } catch (err) {
    if (isVodVideoMissingError(err)) throw err;
  }

  const options = await getVodPlayOptions(videoId);
  const duration = Math.max(...options.map(item => Number(item.duration || 0)), 0);
  return Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 0;
}

export async function deleteEventAudio(videoId: string) { await callVodRpc('DeleteVideo', { VideoIds: videoId }); }
async function eventAudioCategory(name: string, parentId = -1): Promise<number> {
  const response = await callVodRpc<any>('GetCategories', { CateId: parentId });
  const existing = asArray<any>(response?.SubCategories?.Category).find(item => item.CateName === name);
  if (existing) return Number(existing.CateId);
  const created = await callVodRpc<any>('AddCategory', { CateName: name, ParentId: parentId });
  const id = Number(created?.Category?.CateId || created?.CateId || 0);
  if (!id) throw new Error('VOD分类创建失败'); return id;
}
export async function archiveEventAudio(filePath: string, fileName: string, eventId: number, eventName: string) {
  const fs = await import('fs/promises');
  const parentId = await eventAudioCategory('赛事音乐');
  const categoryId = await eventAudioCategory(`${eventId}-${eventName}`.slice(0,64), parentId);
  const response = await callVodRpc<any>('CreateUploadVideo', {
    Title: fileName.replace(/\.[^.]+$/, '').slice(0,128), FileName: fileName, CateId: categoryId,
    StorageLocation: process.env.ALIYUN_VOD_STORAGE_LOCATION, AppId: process.env.ALIYUN_VOD_APP_ID,
    // Archive the original; playback uses the checked local original, independent of transcoding.
    TemplateGroupId: 'VOD_NO_TRANSCODE',
  });
  if (!response.VideoId || !response.UploadAddress || !response.UploadAuth) throw new Error('VOD上传凭证不完整');
  try {
    const address = JSON.parse(Buffer.from(response.UploadAddress, 'base64').toString());
    const auth = JSON.parse(Buffer.from(response.UploadAuth, 'base64').toString());
    const content = await fs.readFile(filePath), date = new Date().toUTCString(), type = 'application/octet-stream';
    const canonical = `PUT\n\n${type}\n${date}\nx-oss-security-token:${auth.SecurityToken}\n/${address.Bucket}/${address.FileName}`;
    const signature = crypto.createHmac('sha1', auth.AccessKeySecret).update(canonical).digest('base64');
    const endpoint = String(address.Endpoint).replace(/^https?:\/\//, '');
    const url = `https://${address.Bucket}.${endpoint}/${String(address.FileName).split('/').map(encodeURIComponent).join('/')}`;
    const result = await fetch(url, { method: 'PUT', headers: { Authorization: `OSS ${auth.AccessKeyId}:${signature}`, Date: date, 'Content-Type': type, 'x-oss-security-token': auth.SecurityToken }, body: content, signal: AbortSignal.timeout(60000) });
    if (!result.ok) throw new Error(`VOD原件上传失败 (${result.status})`);
    return { vodId: String(response.VideoId), categoryId, status: 'vod' };
  } catch (error) { await deleteEventAudio(response.VideoId).catch(() => undefined); throw error; }
}
