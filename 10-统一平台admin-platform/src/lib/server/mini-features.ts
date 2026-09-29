import type { AdminDb } from './admin-db';

function ensureFeatures(db: AdminDb) {
  db.exec(`CREATE TABLE IF NOT EXISTS MiniFeatureConfig (
    key TEXT PRIMARY KEY, value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
}

export function getMiniFeatures(db: AdminDb) {
  ensureFeatures(db);
  const row = db.prepare('SELECT value FROM MiniFeatureConfig WHERE key=?').get<{ value: string }>('videoPlaybackEnabled');
  return { videoPlaybackEnabled: row?.value === 'true' };
}

export function setMiniVideoPlayback(db: AdminDb, enabled: boolean) {
  ensureFeatures(db);
  db.prepare(`INSERT INTO MiniFeatureConfig (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP`)
    .run('videoPlaybackEnabled', String(enabled));
  return getMiniFeatures(db);
}

// The endpoint is shared with web clients. Only the mini-program channel follows this switch.
export function isMiniVideoPlaybackBlocked(db: AdminDb, channel?: string | null) {
  return String(channel || '').trim().toLowerCase() === 'miniprogram'
    && !getMiniFeatures(db).videoPlaybackEnabled;
}
