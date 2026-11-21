import fs from 'node:fs';
import path from 'node:path';

export function resolveEventMusicFile(fileUrl: string) {
  const prefix = '/uploads/event-music/';
  if (!fileUrl.startsWith(prefix)) throw new Error('音乐路径无效');
  const suffix = fileUrl.slice(prefix.length);
  const privateRoot = path.resolve(process.cwd(), 'private/event-music');
  const root = path.resolve(process.env.EVENT_MUSIC_UPLOAD_ROOT || (
    fs.existsSync(path.join(privateRoot, suffix)) ? privateRoot : path.join(process.cwd(), 'public/uploads/event-music')
  ));
  const file = path.resolve(root, suffix);
  if (!file.startsWith(root + path.sep)) throw new Error('音乐路径无效');
  const realFile = fs.realpathSync(file);
  if (!realFile.startsWith(fs.realpathSync(root) + path.sep) || !fs.statSync(realFile).isFile()) throw new Error('音乐路径无效');
  return realFile;
}
