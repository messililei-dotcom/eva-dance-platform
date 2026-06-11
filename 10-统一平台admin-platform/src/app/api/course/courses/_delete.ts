import type { AdminDb } from '@/lib/server/admin-db';

function tableExists(db: AdminDb, name: string) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name));
}

function placeholders(items: unknown[]) {
  return items.map(() => '?').join(',');
}

export function deleteCoursesByIds(db: AdminDb, ids: number[]) {
  const courseIds = Array.from(new Set(ids.filter(id => Number.isInteger(id) && id > 0)));
  if (!courseIds.length) return { deleted: 0 };

  return db.transaction(() => {
    const coursePlaceholders = placeholders(courseIds);
    const videoRows = db.prepare(`SELECT id FROM CourseVideo WHERE course_id IN (${coursePlaceholders})`).all(...courseIds);
    const videoIds = videoRows.map((row: any) => Number(row.id)).filter(Boolean);

    if (videoIds.length) {
      const videoPlaceholders = placeholders(videoIds);
      if (tableExists(db, 'StudyNote')) {
        db.prepare(`DELETE FROM StudyNote WHERE video_id IN (${videoPlaceholders})`).run(...videoIds);
      }
      if (tableExists(db, 'VideoBookmark')) {
        db.prepare(`DELETE FROM VideoBookmark WHERE video_id IN (${videoPlaceholders})`).run(...videoIds);
      }
    }

    if (tableExists(db, 'Answer') && tableExists(db, 'Question')) {
      const questionRows = db.prepare(`SELECT id FROM Question WHERE course_id IN (${coursePlaceholders})`).all(...courseIds);
      const questionIds = questionRows.map((row: any) => Number(row.id)).filter(Boolean);
      if (questionIds.length) {
        db.prepare(`DELETE FROM Answer WHERE question_id IN (${placeholders(questionIds)})`).run(...questionIds);
      }
    }

    if (tableExists(db, 'Question')) {
      db.prepare(`DELETE FROM Question WHERE course_id IN (${coursePlaceholders})`).run(...courseIds);
    }

    db.prepare(`DELETE FROM CourseVideo WHERE course_id IN (${coursePlaceholders})`).run(...courseIds);
    const result = db.prepare(`DELETE FROM OnlineCourse WHERE id IN (${coursePlaceholders})`).run(...courseIds);
    return { deleted: Number(result.changes || 0) };
  })();
}
