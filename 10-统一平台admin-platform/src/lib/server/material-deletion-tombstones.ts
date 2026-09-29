import type { AdminDb } from './admin-db';

export type DeletableMaterial = {
  id?: number | string | null;
  name?: string | null;
  vod_video_id?: string | null;
};

function cleanText(value: unknown) {
  return String(value ?? '').normalize('NFC').trim();
}

export function ensureMaterialDeletionTombstoneSchema(db: AdminDb) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS MaterialDeletionTombstone (
      vod_video_id TEXT PRIMARY KEY,
      material_id INTEGER NOT NULL DEFAULT 0,
      material_name TEXT NOT NULL DEFAULT '',
      deleted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_material_deletion_tombstone_deleted_at
      ON MaterialDeletionTombstone(deleted_at);
  `);
}

export function materialDeletionTombstoneIds(db: AdminDb) {
  ensureMaterialDeletionTombstoneSchema(db);
  const rows = db.prepare('SELECT vod_video_id FROM MaterialDeletionTombstone').all<{ vod_video_id?: string }>();
  return new Set(rows.map(row => cleanText(row.vod_video_id)).filter(Boolean));
}

export function recordMaterialDeletionTombstones(db: AdminDb, materials: DeletableMaterial[]) {
  ensureMaterialDeletionTombstoneSchema(db);
  const statement = db.prepare(`
    INSERT INTO MaterialDeletionTombstone (vod_video_id, material_id, material_name, deleted_at)
    VALUES (?, ?, ?, datetime('now','localtime'))
    ON CONFLICT(vod_video_id) DO UPDATE SET
      material_id=excluded.material_id,
      material_name=excluded.material_name,
      deleted_at=excluded.deleted_at
  `);
  let recorded = 0;
  for (const material of materials) {
    const vodVideoId = cleanText(material?.vod_video_id);
    if (!vodVideoId) continue;
    const materialId = Number(material?.id);
    statement.run(vodVideoId, Number.isInteger(materialId) && materialId > 0 ? materialId : 0, cleanText(material?.name));
    recorded += 1;
  }
  return recorded;
}
