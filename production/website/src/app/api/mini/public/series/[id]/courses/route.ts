import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { jsonError, toPositiveInt, withDb } from '../../../../_helpers';
import { courses as websiteCourses } from '@/config/courses';
import { noStoreJson } from '@/lib/http-cache';
import { getVodVideoDuration, isVodVideoMissingError } from '@/lib/server/aliyun-vod';

const ADMIN_UPLOAD_ROOT = '/www/wwwroot/dongfangwuquan/admin-platform/public';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function localUploadPath(value: string): string {
  if (!value) return '';
  let pathname = value;
  try {
    const url = new URL(value);
    if (!['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)) return '';
    pathname = url.pathname;
  } catch {}

  if (!pathname.startsWith('/uploads/')) return '';
  const decoded = decodeURIComponent(pathname);
  const normalized = path.posix.normalize(decoded);
  if (!normalized.startsWith('/uploads/') || normalized.includes('\0')) return '';
  return `${ADMIN_UPLOAD_ROOT}${normalized}`;
}

function isPlayableMaterial(row: { file_path?: string; file_url?: string; vod_video_id?: string; transcode_status?: string }) {
  const transcodeStatus = String(row.transcode_status || '').toLowerCase();
  const rawUrl = row.file_url || row.file_path || '';
  if (/^https?:\/\//.test(rawUrl)) {
    try {
      const url = new URL(rawUrl);
      if (!['localhost', '127.0.0.1', '0.0.0.0'].includes(url.hostname)) return true;
    } catch {
      return false;
    }
  }
  const filePath = localUploadPath(rawUrl);
  if (filePath && fs.existsSync(/* turbopackIgnore: true */ filePath)) return true;
  return !!row.vod_video_id && !['failed', 'error', 'deleted', 'missing'].includes(transcodeStatus);
}

function getLocalMediaDuration(row: { file_path?: string; file_url?: string }) {
  const filePath = [row.file_url, row.file_path]
    .map(value => localUploadPath(value || ''))
    .find(value => value && fs.existsSync(/* turbopackIgnore: true */ value)) || '';
  if (!filePath || !fs.existsSync(/* turbopackIgnore: true */ filePath)) return 0;

  try {
    const output = execFileSync('/usr/bin/ffprobe', [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      filePath,
    ], { encoding: 'utf8', timeout: 10000 }).trim();
    const duration = Number(output);
    return Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 0;
  } catch {
    return 0;
  }
}

function normalizeSeriesName(value?: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/成品舞/g, '')
    .replace(/[｜|·•・.\s"'“”‘’《》（）()【】\[\]：:，,。！!、\-—_]/g, '');
}

function resolveSeriesId(db: any, routeId: string) {
  const exactId = toPositiveInt(routeId);
  if (exactId) {
    const exact = db.prepare('SELECT id FROM CourseSeries WHERE id=? AND status=?').get(exactId, 'published');
    if (exact) return exactId;
  }

  const websiteCourse = websiteCourses.find(course => course.id === routeId);
  const targetName = normalizeSeriesName(websiteCourse?.title);
  if (targetName) {
    const seriesRows = db.prepare('SELECT id, name FROM CourseSeries WHERE status=?').all('published');
    const match = seriesRows.find((row: any) => {
      const name = normalizeSeriesName(row.name);
      return name && (name === targetName || name.includes(targetName) || targetName.includes(name));
    });
    if (match?.id) return Number(match.id);
  }
  return toPositiveInt(routeId);
}

async function hydrateVideoDurations(db: any, rows: any[]) {
  const updateCourseVideo = db.prepare('UPDATE CourseVideo SET duration=? WHERE id=?');
  const updateMaterial = db.prepare('UPDATE Material SET duration=? WHERE id=?');

  for (const row of rows) {
    const currentDuration = Number(row.duration || 0);
    const vodVideoId = String(row.vod_video_id || '').trim();
    if (currentDuration > 0) continue;

    try {
      const duration = vodVideoId ? await getVodVideoDuration(vodVideoId) : getLocalMediaDuration(row);
      const fallbackDuration = duration > 0 ? duration : getLocalMediaDuration(row);
      if (fallbackDuration <= 0) continue;
      row.duration = fallbackDuration;
      updateCourseVideo.run(fallbackDuration, row.id);
      if (row.material_id) updateMaterial.run(fallbackDuration, row.material_id);
    } catch (err) {
      const localDuration = getLocalMediaDuration(row);
      if (localDuration > 0) {
        row.duration = localDuration;
        updateCourseVideo.run(localDuration, row.id);
        if (row.material_id) updateMaterial.run(localDuration, row.material_id);
        continue;
      }
      if (isVodVideoMissingError(err) && row.material_id) {
        db.prepare("UPDATE Material SET transcode_status='failed' WHERE id=?").run(row.material_id);
        row.transcode_status = 'failed';
      }
    }
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const routeParams = await params;
    return await withDb(async (db) => {
      const seriesId = resolveSeriesId(db, routeParams.id);
      const courses = db.prepare(
        `SELECT oc.id, oc.name, oc.description, oc.course_type as type, oc.duration,
                (SELECT COUNT(*) FROM CourseVideo WHERE course_id=oc.id) as video_count,
                oc.is_free_trial, oc.sort_order
         FROM OnlineCourse oc
         WHERE oc.series_id=? AND oc.status='published'
         ORDER BY oc.sort_order, oc.id`
      ).all(seriesId);
      const courseIds = courses.map((course: any) => Number(course.id)).filter(Boolean);
      const videoRows = courseIds.length
        ? db.prepare(
          `SELECT cv.id, cv.material_id, cv.course_id, cv.name, COALESCE(cv.duration, m.duration, 0) as duration,
                  m.file_path, m.file_url, m.vod_video_id, m.transcode_status
           FROM CourseVideo cv
           LEFT JOIN Material m ON cv.material_id=m.id
           WHERE cv.course_id IN (${courseIds.map(() => '?').join(',')}) AND cv.status='published'
           ORDER BY cv.sort_order, cv.id`
        ).all(...courseIds).filter(isPlayableMaterial)
        : [];
      await hydrateVideoDurations(db, videoRows);
      const videosByCourse = new Map<number, any[]>();
      for (const { file_path, file_url, course_id, ...video } of videoRows as any[]) {
        const key = Number(course_id);
        const group = videosByCourse.get(key) || [];
        group.push(video);
        videosByCourse.set(key, group);
      }
      const data = courses.map((course: any) => ({
        ...course,
        videos: videosByCourse.get(Number(course.id)) || [],
      }));
      return noStoreJson({ success: true, data });
    });
  } catch (err: any) {
    return jsonError(err.message);
  }
}
