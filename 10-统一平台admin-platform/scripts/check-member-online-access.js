#!/usr/bin/env node

const path = require('path');
const Database = require('better-sqlite3');

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length === 13 && digits.startsWith('86') ? digits.slice(2) : digits;
}

function normalizedPhoneSql(column) {
  const digits = `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(COALESCE(${column}, ''), '+', ''), ' ', ''), '-', ''), '(', ''), ')', '')`;
  return `(CASE WHEN length(${digits}) = 13 AND substr(${digits}, 1, 2) = '86' THEN substr(${digits}, 3) ELSE ${digits} END)`;
}

const phone = normalizePhone(process.argv[2]);
if (!phone) {
  console.error('Usage: node scripts/check-member-online-access.js <phone>');
  process.exit(2);
}

const dbPath = process.env.ADMIN_DB_PATH || path.join(process.cwd(), 'admin.db');
const db = new Database(dbPath, { readonly: true });

try {
  const member = db.prepare(
    `SELECT id, name, phone, phone_national_number, wx_openid, status, source, created_at
     FROM Member
     WHERE ${normalizedPhoneSql('phone')}=? OR ${normalizedPhoneSql('phone_national_number')}=?
     ORDER BY CASE WHEN ${normalizedPhoneSql('phone')}=? THEN 0 ELSE 1 END, id DESC
     LIMIT 1`
  ).get(phone, phone, phone);

  console.log(`手机号: ${phone}`);
  if (!member) {
    console.log('结果: 未找到学员');
    process.exit(1);
  }

  console.log(`学员: #${member.id} ${member.name || ''} (${member.phone || member.phone_national_number || '无手机号'})`);
  console.log(`微信绑定: ${member.wx_openid ? '已绑定' : '未绑定'}`);

  const authorizations = db.prepare(
    `SELECT ca.id, ca.member_id, ca.phone, ca.series_id, ca.type, ca.status, ca.granted_at, ca.expire_at,
            cs.name AS series_name, cs.status AS series_status,
            COUNT(DISTINCT oc.id) AS published_courses,
            COUNT(DISTINCT cv.id) AS published_videos
     FROM CourseAuthorization ca
     JOIN CourseSeries cs ON cs.id=ca.series_id
     LEFT JOIN OnlineCourse oc ON oc.series_id=cs.id AND oc.status='published'
     LEFT JOIN CourseVideo cv ON cv.course_id=oc.id AND (cv.status IS NULL OR cv.status='' OR cv.status='published')
     WHERE ca.status='active'
       AND (ca.expire_at IS NULL OR ca.expire_at > datetime('now','localtime'))
       AND (ca.member_id=? OR ${normalizedPhoneSql('ca.phone')}=?)
     GROUP BY ca.id
     ORDER BY ca.granted_at DESC, ca.id DESC`
  ).all(member.id, phone);

  if (!authorizations.length) {
    console.log('结果: 没有有效线上课授权');
    process.exit(1);
  }

  console.log('有效授权:');
  authorizations.forEach((auth) => {
    const playable = auth.series_status === 'published' && Number(auth.published_videos || 0) > 0;
    console.log(`- #${auth.series_id} ${auth.series_name}: ${playable ? '可观看' : '不可观看'}; 课程状态=${auth.series_status}; 已发布视频=${auth.published_videos}`);
  });

  const hasPlayable = authorizations.some((auth) => auth.series_status === 'published' && Number(auth.published_videos || 0) > 0);
  console.log(`结论: ${hasPlayable ? '该手机号存在可观看课程' : '授权存在，但课程未发布或没有可播放视频'}`);
  process.exit(hasPlayable ? 0 : 1);
} finally {
  db.close();
}
