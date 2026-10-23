import { unlinkSync } from 'node:fs';
import path from 'node:path';
import type { AdminDb } from './admin-db';

// Only remove managed local images after all member references have moved away.
export function removeUnusedAvatars(db: AdminDb, avatars: unknown[]) {
  for (const value of new Set(avatars)) {
    if (typeof value !== 'string' || !/^\/uploads\/(wechat-avatar|members)\/[a-zA-Z0-9_-]+\.(jpg|jpeg|png|webp)$/.test(value)) continue;
    if (db.prepare('SELECT id FROM Member WHERE avatar=? OR wx_avatar_url=? LIMIT 1').get(value, value)) continue;
    try {
      unlinkSync(path.join(process.cwd(), 'public', value));
    } catch (error: any) {
      if (error.code !== 'ENOENT') console.error('旧头像清理失败', error.code);
    }
  }
}
