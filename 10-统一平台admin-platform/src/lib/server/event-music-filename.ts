import path from 'node:path';

export function legacyEventMusicUrl(value: string): URL | undefined {
  if (!value.startsWith('https://')) return;
  const url = URL.parse(value);
  // Only the original event-music bucket and its imported object keys may be fetched.
  if (url?.origin === 'https://csdfwq.oss-rg-china-mainland.aliyuncs.com' &&
      !url.username && !url.password && !url.search && !url.hash &&
      /^\/[a-f0-9-]+\.(?:mp3|wav|m4a|aac|flac|ogg|mp4|unknown)$/i.test(url.pathname)) {
    return url;
  }
}

export function eventMusicExtension(fileUrl: string, legacyUrl = legacyEventMusicUrl(fileUrl)) {
  const extension = path.extname(legacyUrl?.pathname || fileUrl).toLowerCase();
  // The migrated objects with an .unknown suffix contain MP3 audio.
  if (legacyUrl) return extension === '.unknown' ? '.mp3' : extension;
  return ['.mp3', '.wav', '.m4a', '.aac', '.flac'].includes(extension) ? extension : '';
}

export function filenamePart(value: string, fallback: string) {
  return String(value || '').normalize('NFC').replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g, '_')
    .replace(/^\.+/, '_').replace(/[. ]+$/, '').trim() || fallback;
}

export function limitBytes(value: string, limit: number) {
  let result = '';
  for (const character of value) {
    if (Buffer.byteLength(result + character) > limit) break;
    result += character;
  }
  return result;
}

export function eventMusicFilename(group: string, order: number, name: string, title: string, extension: string) {
  return [limitBytes(filenamePart(group, '未分组'), 80), order > 0 ? String(order) : '未排序',
    limitBytes(filenamePart(name, '未填写姓名'), 48), limitBytes(filenamePart(title, '未填写节目名称'), 70)].join('-') + extension;
}
