import {
  ensureVodCategory,
  getVodConfigStatus,
  updateVodCategory,
} from '@/lib/server/aliyun-vod';
import { cleanText } from './_materials';

const ROOT_CATEGORY_NAME = '线上课';

function ensureColumn(db: any, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((row: any) => row.name);
  if (!columns.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

export function ensureMaterialFolderVodSchema(db: any) {
  ensureColumn(db, 'MaterialFolder', 'vod_cate_id', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'MaterialFolder', 'vod_parent_cate_id', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'MaterialFolder', 'vod_synced_at', "TEXT NOT NULL DEFAULT ''");
}

function vodRootCategoryName() {
  return cleanText(process.env.ALIYUN_VOD_ROOT_CATE_NAME, ROOT_CATEGORY_NAME);
}

async function vodRootCategoryId() {
  const configured = Number(process.env.ALIYUN_VOD_ROOT_CATE_ID || 0);
  if (Number.isInteger(configured) && configured > 0) return configured;
  return ensureVodCategory({ name: vodRootCategoryName(), parentId: -1 });
}

async function ensureFolderCategory(db: any, folderId: number, visited = new Set<number>()): Promise<number> {
  ensureMaterialFolderVodSchema(db);
  if (!Number.isInteger(folderId) || folderId <= 0) return vodRootCategoryId();
  if (visited.has(folderId)) throw new Error('文件夹层级存在循环，无法同步 VOD 分类');
  visited.add(folderId);

  const folder = db.prepare('SELECT * FROM MaterialFolder WHERE id=?').get(folderId);
  if (!folder) return vodRootCategoryId();

  const parentId = Number(folder.parent_id || 0);
  const parentCateId = parentId > 0 ? await ensureFolderCategory(db, parentId, visited) : await vodRootCategoryId();
  const name = cleanText(folder.name, `文件夹${folder.id}`);
  const storedCateId = Number(folder.vod_cate_id || 0);
  const storedParentCateId = Number(folder.vod_parent_cate_id || 0);
  let cateId = storedCateId;

  if (cateId > 0 && storedParentCateId === parentCateId) {
    try {
      await updateVodCategory({ cateId, name });
    } catch {
      cateId = 0;
    }
  }

  if (cateId <= 0 || storedParentCateId !== parentCateId) {
    cateId = await ensureVodCategory({ name, parentId: parentCateId });
  }

  db.prepare(`
    UPDATE MaterialFolder
    SET vod_cate_id=?,
        vod_parent_cate_id=?,
        vod_synced_at=datetime('now','localtime'),
        updated_at=datetime('now','localtime')
    WHERE id=?
  `).run(cateId, parentCateId, folderId);

  return cateId;
}

export async function syncMaterialFolderToVod(db: any, folderId: number) {
  const config = getVodConfigStatus();
  if (!config.ready) return { ready: false, cateId: 0 };
  const cateId = await ensureFolderCategory(db, folderId);
  return { ready: true, cateId };
}

export async function syncAllMaterialFoldersToVod(db: any) {
  const config = getVodConfigStatus();
  ensureMaterialFolderVodSchema(db);
  if (!config.ready) return { ready: false, synced: 0 };

  const folders = db.prepare('SELECT id FROM MaterialFolder ORDER BY parent_id, sort_order, id').all();
  let synced = 0;
  for (const folder of folders) {
    await ensureFolderCategory(db, Number(folder.id));
    synced += 1;
  }
  return { ready: true, synced };
}
