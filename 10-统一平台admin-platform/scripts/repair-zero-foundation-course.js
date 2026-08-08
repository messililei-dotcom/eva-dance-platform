#!/usr/bin/env node

const path = require('path');
const Database = require('better-sqlite3');

if (process.env.CONFIRM_COURSE_12_REPAIR !== '1') {
  throw new Error('未授权执行课程内容修复；请设置 CONFIRM_COURSE_12_REPAIR=1');
}

const projectRoot = path.resolve(__dirname, '..');
const configuredDbPath = process.env.ADMIN_DB_PATH || process.env.UNIFIED_DB_PATH || 'admin.db';
const dbPath = path.isAbsolute(configuredDbPath)
  ? configuredDbPath
  : path.resolve(projectRoot, configuredDbPath);

const SERIES_ID = 12;
const lessons = [
  [340, '东方舞的前世今生'],
  [309, '怎样学好东方舞'],
  [1252, '东方舞基本站姿与形体舞姿'],
  [2568, '东方舞基本手型'],
  [2567, '东方舞基本脚位'],
  [1282, '东方舞 1-8 个基本对称手位'],
  [1238, '东方舞 1-8 个不对称手位与手臂训练'],
  [1271, '下核心基础：收腹'],
  [1281, '下核心基础：吐腹'],
  [1250, '上核心基础：提胸'],
  [1251, '上核心基础：落胸'],
  [1299, '节奏与节拍入门'],
  [1302, 'Maksum 节奏入门'],
  [1305, 'Saidi 节奏入门'],
  [704, '深入了解什么是呼吸'],
  [706, '胸呼吸基础训练'],
  [711, '腹呼吸基础训练'],
  [709, '呼吸与腹肌协同训练'],
  [718, '呼吸与腰腹核心训练'],
  [875, '认识中段核心肌肉'],
  [888, '腿部力量基础训练'],
  [894, '腰腹背核心基础训练'],
  [883, '手臂柔韧与开肩拉伸'],
  [873, '全身热身慢版带练'],
  [910, '腿部力量热身与拉伸'],
  [1158, '全身软度与拉伸'],
  [1261, '四步转与核心稳定入门'],
  [1258, '交叉转与腿部协调入门'],
];

const db = new Database(dbPath);

try {
  db.pragma('foreign_keys = ON');

  const repair = db.transaction(() => {
    const series = db.prepare('SELECT id, name FROM CourseSeries WHERE id=?').get(SERIES_ID);
    if (!series) throw new Error(`课程系列 #${SERIES_ID} 不存在`);

    const sourceQuery = db.prepare(`
      SELECT oc.*, cv.name AS video_name, cv.material_id, cv.duration AS video_duration,
             cv.status AS video_status, m.vod_video_id, m.file_url, m.file_path, m.transcode_status
      FROM OnlineCourse oc
      JOIN CourseVideo cv ON cv.course_id=oc.id
      JOIN Material m ON m.id=cv.material_id
      WHERE oc.id=? AND oc.status='published'
        AND (cv.status IS NULL OR cv.status='' OR cv.status='published')
      ORDER BY cv.sort_order, cv.id
      LIMIT 1
    `);
    const findTarget = db.prepare(
      'SELECT id FROM OnlineCourse WHERE series_id=? AND rich_description=? LIMIT 1'
    );
    const insertCourse = db.prepare(`
      INSERT INTO OnlineCourse (
        series_id, name, share_text, description, rich_description, cover_image,
        course_type, is_free_trial, is_purchasable, single_price, video_count,
        duration, group_id, group_name, sort_order, status, created_at, updated_at
      ) VALUES (
        ?, ?, '', ?, ?, ?, ?, 0, 0, 0, 1, ?, ?, ?, ?, 'published',
        datetime('now','localtime'), datetime('now','localtime')
      )
    `);
    const updateCourse = db.prepare(`
      UPDATE OnlineCourse
      SET name=?, description=?, cover_image=?, course_type=?, video_count=1,
          duration=?, group_id=?, group_name=?, sort_order=?, status='published',
          updated_at=datetime('now','localtime')
      WHERE id=?
    `);
    const findTargetVideo = db.prepare(
      'SELECT id FROM CourseVideo WHERE course_id=? ORDER BY id LIMIT 1'
    );
    const insertVideo = db.prepare(`
      INSERT INTO CourseVideo (
        course_id, name, material_id, duration, is_free, sort_order, status, created_at
      ) VALUES (?, ?, ?, ?, 0, 1, 'published', datetime('now','localtime'))
    `);
    const updateVideo = db.prepare(`
      UPDATE CourseVideo
      SET name=?, material_id=?, duration=?, is_free=0, sort_order=1, status='published'
      WHERE id=?
    `);

    lessons.forEach(([sourceCourseId, title], index) => {
      const source = sourceQuery.get(sourceCourseId);
      if (!source) throw new Error(`来源课节 #${sourceCourseId} 没有可复用的已发布视频`);
      if (!source.vod_video_id && !source.file_url && !source.file_path) {
        throw new Error(`来源课节 #${sourceCourseId} 的素材没有播放源`);
      }

      const lessonNumber = index + 1;
      const marker = `system-curated:course-12:source-course-${sourceCourseId}`;
      const displayName = `第${lessonNumber}课｜${title}`;
      const description = `东方舞零基础入门课程第 ${lessonNumber} 节`;
      const groupId = lessonNumber <= 7 ? 1
        : lessonNumber <= 11 ? 2
          : lessonNumber <= 14 ? 3
            : lessonNumber <= 19 ? 4
              : lessonNumber <= 23 ? 5
                : lessonNumber <= 26 ? 6
                  : 7;
      const groupNames = [
        '',
        '基础认知与动作',
        '核心基础',
        '节奏与音乐',
        '呼吸训练',
        '身体能力',
        '热身与拉伸',
        '步伐与组合',
      ];

      let target = findTarget.get(SERIES_ID, marker);
      if (target) {
        updateCourse.run(
          displayName,
          description,
          source.cover_image || '',
          source.course_type || 'recorded',
          Number(source.video_duration || source.duration || 0),
          groupId,
          groupNames[groupId],
          lessonNumber,
          target.id,
        );
      } else {
        const result = insertCourse.run(
          SERIES_ID,
          displayName,
          description,
          marker,
          source.cover_image || '',
          source.course_type || 'recorded',
          Number(source.video_duration || source.duration || 0),
          groupId,
          groupNames[groupId],
          lessonNumber,
        );
        target = { id: Number(result.lastInsertRowid) };
      }

      const targetVideo = findTargetVideo.get(target.id);
      if (targetVideo) {
        updateVideo.run(
          source.video_name || displayName,
          source.material_id,
          Number(source.video_duration || 0),
          targetVideo.id,
        );
      } else {
        insertVideo.run(
          target.id,
          source.video_name || displayName,
          source.material_id,
          Number(source.video_duration || 0),
        );
      }
    });

    // Retire the old empty placeholder without deleting it, so the repair is
    // reversible from the production backup and preserves its audit history.
    db.prepare(`
      UPDATE OnlineCourse
      SET status='draft', sort_order=999, updated_at=datetime('now','localtime')
      WHERE series_id=? AND id NOT IN (
        SELECT course_id FROM CourseVideo
        WHERE status IS NULL OR status='' OR status='published'
      )
    `).run(SERIES_ID);

    db.prepare(`
      UPDATE CourseSeries
      SET total_courses=?, updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(lessons.length, SERIES_ID);

    const result = db.prepare(`
      SELECT COUNT(DISTINCT oc.id) AS published_courses,
             COUNT(DISTINCT cv.id) AS published_videos
      FROM OnlineCourse oc
      LEFT JOIN CourseVideo cv ON cv.course_id=oc.id
        AND (cv.status IS NULL OR cv.status='' OR cv.status='published')
      WHERE oc.series_id=? AND oc.status='published'
    `).get(SERIES_ID);
    if (
      Number(result.published_courses) !== lessons.length
      || Number(result.published_videos) !== lessons.length
    ) {
      throw new Error(`修复校验失败：${JSON.stringify(result)}`);
    }
    return result;
  });

  const result = repair();
  console.log(JSON.stringify({
    success: true,
    dbPath,
    seriesId: SERIES_ID,
    ...result,
  }, null, 2));
} finally {
  db.close();
}
