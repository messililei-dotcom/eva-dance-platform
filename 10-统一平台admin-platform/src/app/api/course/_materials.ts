import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { openAdminDb, type AdminDb } from '@/lib/server/admin-db';

export const MATERIAL_UPLOAD_ROOT = path.join(process.cwd(), 'public', 'uploads');
export const MATERIAL_CENTER_SEGMENTS = ['online-course', 'course-content', 'material-center'];
export const MATERIAL_CENTER_ROOT = path.join(MATERIAL_UPLOAD_ROOT, ...MATERIAL_CENTER_SEGMENTS);
export const DEFAULT_MATERIAL_FOLDER_NAME = '默认素材';
const LEGACY_MATERIAL_ROOT = path.join(process.cwd(), 'uploads', 'materials');
const WINDOWS_RESERVED_NAMES = new Set(['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9']);

export type SortBy = 'name' | 'type' | 'folder_id' | 'file_size' | 'duration' | 'is_referenced' | 'uploaded_by' | 'created_at';

export class MaterialRuleError extends Error {
  status = 400;
}

export function jsonError(message: string, status = 500) {
  return Response.json({ success: false, message }, { status });
}

export function withDb<T>(fn: (db: AdminDb) => T): T {
  const db = openAdminDb();
  try {
    const result = fn(db);
    if (result && typeof (result as any).then === 'function') {
      return (result as unknown as Promise<void>).finally(() => db.close()) as unknown as T;
    }
    db.close();
    return result;
  } catch (err) {
    db.close();
    throw err;
  }
}

export function ensureMaterialFingerprintSchema(db: any) {
  const columns = db.prepare('PRAGMA table_info(Material)').all();
  const hasFileHash = columns.some((column: any) => column.name === 'file_hash');
  if (!hasFileHash) {
    db.prepare("ALTER TABLE Material ADD COLUMN file_hash TEXT DEFAULT ''").run();
  }
  db.prepare("CREATE INDEX IF NOT EXISTS idx_material_file_hash ON Material(file_hash)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_material_type_size ON Material(type, file_size)").run();
}

export function cleanText(value: unknown, fallback = '') {
  const text = String(value ?? '').normalize('NFC').trim();
  return text || fallback;
}

export function toPositiveInt(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

export function safeName(value: string, fallback = `material-${Date.now()}`) {
  const cleaned = cleanText(value, fallback)
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '');
  if (!cleaned) return fallback;
  return WINDOWS_RESERVED_NAMES.has(cleaned.toUpperCase()) ? `${cleaned}_` : cleaned;
}

export function materialTypeFromFile(file: File, filename: string) {
  const mime = file.type || '';
  const ext = path.extname(filename).toLowerCase();
  if (mime.startsWith('video/') || ['.mp4', '.mov', '.m4v', '.avi', '.mkv', '.webm'].includes(ext)) return 'video';
  if (mime.startsWith('image/') || ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'].includes(ext)) return 'image';
  if (mime.startsWith('audio/') || ['.mp3', '.wav', '.aac', '.m4a', '.flac'].includes(ext)) return 'audio';
  if (mime === 'application/pdf' || ['.pdf', '.doc', '.docx', '.ppt', '.pptx'].includes(ext)) return 'pdf';
  return 'pdf';
}

export function uploadUrl(...segments: Array<string | number>) {
  return path.posix.join('/uploads', ...segments.map(segment => String(segment)));
}

export async function uniqueDiskName(dir: string, filename: string) {
  const parsed = path.parse(filename);
  let candidate = filename;
  let index = 1;
  while (true) {
    try {
      await fsp.access(path.join(dir, candidate));
      candidate = `${parsed.name} (${index})${parsed.ext}`;
      index += 1;
    } catch {
      return candidate;
    }
  }
}

export function contentTypeForMaterial(material: any) {
  const ext = path.extname(material.file_path || material.file_url || material.name || '').toLowerCase();
  if (material.type === 'image') {
    if (ext === '.png') return 'image/png';
    if (ext === '.gif') return 'image/gif';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.svg') return 'image/svg+xml';
    return 'image/jpeg';
  }
  if (material.type === 'video') {
    if (ext === '.m3u8') return 'application/vnd.apple.mpegurl';
    if (ext === '.webm') return 'video/webm';
    if (ext === '.mov') return 'video/quicktime';
    return 'video/mp4';
  }
  if (material.type === 'audio') {
    if (ext === '.wav') return 'audio/wav';
    if (ext === '.aac') return 'audio/aac';
    if (ext === '.m4a') return 'audio/mp4';
    if (ext === '.flac') return 'audio/flac';
    return 'audio/mpeg';
  }
  if (material.type === 'pdf') return 'application/pdf';
  return 'application/octet-stream';
}

export function materialFileExtension(material: any) {
  return path.extname(material.file_path || material.file_url || material.name || '').toLowerCase();
}

export function isVideoMaterial(material: any) {
  return material?.type === 'video' || ['.mp4', '.m4v', '.webm', '.mov', '.m3u8'].includes(materialFileExtension(material));
}

export function isDirectPlayableVideoMaterial(material: any) {
  return ['.mp4', '.m4v', '.webm', '.m3u8'].includes(materialFileExtension(material));
}

export function isAudioMaterial(material: any) {
  return material?.type === 'audio';
}

export function isDirectPlayableMediaMaterial(material: any) {
  if (isAudioMaterial(material)) return true;
  return isDirectPlayableVideoMaterial(material);
}

export function vodPlaybackUnavailableResponse(material: any) {
  const status = String(material?.transcode_status || '').toLowerCase();
  const waiting = ['pending', 'processing', 'transcoding'].includes(status);
  const failed = ['failed', 'error'].includes(status);
  return jsonError(
    waiting
      ? '视频正在转码，播放地址生成后可观看'
      : failed
        ? '视频转码失败，请重新上传素材'
        : '视频转码播放地址暂不可用，请稍后再试',
    waiting ? 425 : failed ? 422 : 503
  );
}

export function localMaterialPath(filePath: string) {
  const text = String(filePath || '');
  if (!text) return null;
  let absolutePath = '';
  if (text.startsWith('/uploads/materials/')) {
    const decoded = decodeURIComponent(text.replace(/^\/uploads\/materials\/+/, ''));
    absolutePath = path.resolve(LEGACY_MATERIAL_ROOT, decoded);
    if (!absolutePath.startsWith(path.resolve(LEGACY_MATERIAL_ROOT) + path.sep)) return null;
  } else if (text.startsWith('/uploads/')) {
    const decoded = decodeURIComponent(text.replace(/^\/uploads\/+/, ''));
    absolutePath = path.resolve(MATERIAL_UPLOAD_ROOT, decoded);
    if (!absolutePath.startsWith(path.resolve(MATERIAL_UPLOAD_ROOT) + path.sep)) return null;
  } else if (path.isAbsolute(text)) {
    absolutePath = path.resolve(text);
  } else {
    return null;
  }
  return absolutePath;
}

export function materialLocalFiles(material: any) {
  const values = [
    material?.file_path,
    material?.file_url,
    material?.thumbnail,
  ];
  return Array.from(new Set(values
    .map(value => localMaterialPath(String(value || '')))
    .filter((value): value is string => Boolean(value))));
}

export async function deleteLocalMaterialFiles(materials: any[]) {
  const files = Array.from(new Set(materials.flatMap(material => materialLocalFiles(material))));
  await Promise.all(files.map(file => fsp.unlink(file).catch((err: any) => {
    if (err?.code !== 'ENOENT') console.warn(`删除素材本地文件失败：${file}`, err?.message || err);
  })));
  return { deleted_files: files.length };
}

export function fileStreamResponse(request: Request, material: any, absolutePath: string) {
  const stat = fs.statSync(absolutePath);
  const total = stat.size;
  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Content-Type': contentTypeForMaterial(material),
    'Content-Disposition': 'inline',
    'Cache-Control': 'no-store, private',
    'X-Content-Type-Options': 'nosniff',
    'X-Download-Options': 'noopen',
  });
  const range = request.headers.get('range');
  if (range) {
    const match = range.match(/bytes=(\d*)-(\d*)/);
    let start = match?.[1] ? parseInt(match[1], 10) : 0;
    let end = match?.[2] ? parseInt(match[2], 10) : total - 1;
    if (!Number.isFinite(start) || start < 0 || start >= total) return new Response(null, { status: 416 });
    if (!Number.isFinite(end) || end < start) end = total - 1;
    end = Math.min(end, total - 1);
    headers.set('Content-Range', `bytes ${start}-${end}/${total}`);
    headers.set('Content-Length', String(end - start + 1));
    return new Response(Readable.toWeb(fs.createReadStream(absolutePath, { start, end })) as ReadableStream, { status: 206, headers });
  }
  headers.set('Content-Length', String(total));
  return new Response(Readable.toWeb(fs.createReadStream(absolutePath)) as ReadableStream, { headers });
}

export function saveThumbnailDataUrl(dataUrl: unknown, dir: string, baseName: string) {
  const text = String(dataUrl || '');
  const match = text.match(/^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const ext = match[1].toLowerCase().startsWith('jp') ? 'jpg' : match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > 5 * 1024 * 1024) return null;
  fs.mkdirSync(dir, { recursive: true });
  const filename = `${path.basename(baseName, path.extname(baseName))}-thumb-${Date.now()}.${ext}`;
  const absolutePath = path.join(dir, filename);
  fs.writeFileSync(absolutePath, buffer);
  return { absolutePath, filename };
}

export function diskCapacityFor(targetPath: string) {
  fs.mkdirSync(targetPath, { recursive: true });
  if (typeof fs.statfsSync !== 'function') return null;
  const stats = fs.statfsSync(targetPath);
  const blockSize = Number(stats.bsize || 0);
  const totalBytes = Number(stats.blocks || 0) * blockSize;
  if (!blockSize || !totalBytes) return null;
  const freeBytes = Number(stats.bfree || 0) * blockSize;
  const availableBytes = Number(stats.bavail || stats.bfree || 0) * blockSize;
  return {
    total_bytes: totalBytes,
    free_bytes: freeBytes,
    available_bytes: availableBytes,
    used_bytes: Math.max(0, totalBytes - freeBytes),
  };
}

export function allowedSort(value: string | null): SortBy {
  const allowed = new Set(['name', 'type', 'folder_id', 'file_size', 'duration', 'is_referenced', 'uploaded_by', 'created_at']);
  return allowed.has(value || '') ? value as SortBy : 'created_at';
}

export function ensureDefaultMaterialFolder(db: any) {
  const root = db.prepare('SELECT id, name, parent_id, sort_order FROM MaterialFolder WHERE parent_id=0 AND name=? LIMIT 1').get(DEFAULT_MATERIAL_FOLDER_NAME);
  if (root) return root;
  const result = db.prepare('INSERT INTO MaterialFolder (name, parent_id, sort_order) VALUES (?, 0, 0)').run(DEFAULT_MATERIAL_FOLDER_NAME);
  return { id: Number(result.lastInsertRowid), name: DEFAULT_MATERIAL_FOLDER_NAME, parent_id: 0, sort_order: 0 };
}

export function materialFolderById(db: any, folderId: number) {
  if (!Number.isInteger(folderId) || folderId <= 0) return null;
  return db.prepare('SELECT id, name, parent_id, sort_order FROM MaterialFolder WHERE id=?').get(folderId) || null;
}

export function ensureMaterialFolder(db: any, folderId: number) {
  const folder = materialFolderById(db, folderId);
  if (folder) return folder;
  return ensureDefaultMaterialFolder(db);
}

export function assertValidFolderParent(db: any, parentId: number, movingFolderId = 0) {
  if (parentId <= 0) return;
  const parent = materialFolderById(db, parentId);
  if (!parent) throw new MaterialRuleError('上级文件夹不存在');
  if (movingFolderId > 0 && parentId === movingFolderId) throw new MaterialRuleError('不能移动到自身文件夹下');

  const visited = new Set<number>();
  let cursor = Number(parent.parent_id || 0);
  while (cursor > 0) {
    if (cursor === movingFolderId) throw new MaterialRuleError('不能移动到自己的子文件夹下');
    if (visited.has(cursor)) throw new MaterialRuleError('文件夹层级存在循环，请先修复目录结构');
    visited.add(cursor);
    const next = materialFolderById(db, cursor);
    if (!next) break;
    cursor = Number(next.parent_id || 0);
  }
}

export function folderPathSegments(db: any, folderId: number) {
  const segments: Array<{ id: number; name: string }> = [];
  const visited = new Set<number>();
  let cursor = folderId;
  while (cursor > 0) {
    if (visited.has(cursor)) throw new MaterialRuleError('文件夹层级存在循环，请先修复目录结构');
    visited.add(cursor);
    const folder = materialFolderById(db, cursor);
    if (!folder) break;
    segments.unshift({ id: Number(folder.id), name: String(folder.name || '') });
    cursor = Number(folder.parent_id || 0);
  }
  return segments;
}

export function materialCloudPrefix(db: any, folderId: number, type: string) {
  const folder = ensureMaterialFolder(db, folderId);
  const safeType = ['video', 'image', 'audio', 'pdf'].includes(type) ? type : 'file';
  const pathText = folderPathSegments(db, Number(folder.id))
    .map(segment => `${segment.id}-${safeName(segment.name, 'folder')}`)
    .join('/');
  return ['material-center', `folder-${folder.id}`, pathText, safeType].filter(Boolean).join('/');
}

export function folderRowsWithCounts(db: any) {
  ensureDefaultMaterialFolder(db);
  const folders = db.prepare('SELECT * FROM MaterialFolder ORDER BY parent_id, sort_order, id').all();
  const materialCounts = db.prepare('SELECT folder_id, COUNT(*) as cnt FROM Material GROUP BY folder_id').all();
  const countMap = new Map<number, number>(materialCounts.map((row: any) => [Number(row.folder_id), Number(row.cnt || 0)]));
  function buildTree(parentId: number): any[] {
    return folders
      .filter((folder: any) => Number(folder.parent_id || 0) === parentId)
      .map((folder: any) => {
        const children = buildTree(Number(folder.id));
        const material_count = countMap.get(Number(folder.id)) || 0;
        const total_material_count = material_count + children.reduce((sum, child) => sum + Number(child.total_material_count || 0), 0);
        return { ...folder, material_count, total_material_count, children };
      });
  }
  const tree = buildTree(0);
  const countById = new Map<number, any>();
  function collect(items: any[]) {
    items.forEach(item => {
      countById.set(Number(item.id), { material_count: item.material_count, total_material_count: item.total_material_count });
      collect(item.children || []);
    });
  }
  collect(tree);
  const flat = folders.map((folder: any) => ({ ...folder, ...(countById.get(Number(folder.id)) || { material_count: 0, total_material_count: 0 }) }));
  return { tree, flat, total: materialCounts.reduce((sum: number, row: any) => sum + Number(row.cnt || 0), 0) };
}
