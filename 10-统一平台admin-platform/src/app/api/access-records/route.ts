import { openAdminDb, type AdminDb } from '@/lib/server/admin-db';
import { requirePermission } from '../training-db';
import { ensureCourseSeriesVisitTable } from '../course/series/[id]/_authorization';

export const dynamic = 'force-dynamic';

type AccessRecord = {
  id: string;
  category: 'student' | 'admin';
  visitedAt: string;
  platform: string;
  module: string;
  action: string;
  targetTitle: string;
  visitorName: string;
  visitorPhone: string;
  visitorKey: string;
  visitorType: string;
  source: string;
  remark: string;
};

function cleanText(value: unknown, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Math.floor(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function tableExists(db: AdminDb, table: string) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table));
}

function tableColumns(db: AdminDb, table: string) {
  if (!tableExists(db, table)) return [];
  return db.prepare(`PRAGMA table_info('${table.replace(/'/g, "''")}')`).all<{ name: string }>().map(row => row.name);
}

function hasColumn(db: AdminDb, table: string, column: string) {
  return tableColumns(db, table).includes(column);
}

function dateText(value: unknown) {
  const text = cleanText(value).replace('T', ' ').replace(/\//g, '-');
  const match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/);
  if (!match) return text.slice(0, 19);
  const [, year, month, day, hour = '0', minute = '0', second = '0'] = match;
  const pad = (part: string) => part.padStart(2, '0');
  return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

function shanghaiDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function visitActionLabel(source: string) {
  const map: Record<string, string> = {
    series: '点击课程介绍',
    detail: '查看课程详情',
    catalog: '查看课节目录',
    video: '点击课程视频学习',
    video_progress: '保存视频学习进度',
    learn: '访问课程',
    auth_request: '发起授权申请',
  };
  return map[source] || source || '访问课程';
}

function platformLabel(value: unknown, fallback = '') {
  const text = cleanText(value);
  const lower = text.toLowerCase();
  if (['website', 'web', 'official_site'].includes(lower) || text === '官网') return '官网';
  if (['mini', 'miniprogram', 'wechat_mini'].includes(lower) || text === '小程序') return '小程序';
  if (text.includes('后台')) return '后台系统';
  return text || fallback;
}

function normalizePlatform(source: string, platform?: unknown) {
  const explicit = platformLabel(platform);
  if (explicit) return explicit;
  if (source === 'admin') return '后台系统';
  if (source === 'video_progress') return '小程序/官网';
  return '小程序/官网';
}

function memberLabel(row: Record<string, unknown>) {
  const name = cleanText(row.member_name);
  if (name) return name;
  const visitor = cleanText(row.visitor_label);
  if (visitor) return visitor;
  const key = cleanText(row.visitor_key);
  if (key) return `游客 ${key.slice(0, 6)}`;
  return '未知访客';
}

function courseVisitRows(db: AdminDb): AccessRecord[] {
  if (!tableExists(db, 'CourseSeriesVisitLog')) return [];
  ensureCourseSeriesVisitTable(db);
  const platformSelect = hasColumn(db, 'CourseSeriesVisitLog', 'platform') ? 'l.platform' : "'' AS platform";

  const rows = db.prepare(`
    SELECT
      l.id, l.member_id, l.series_id, l.source, ${platformSelect}, l.visitor_key, l.visitor_label,
      l.visited_at, cs.name AS series_name, m.name AS member_name, m.phone AS member_phone
    FROM CourseSeriesVisitLog l
    LEFT JOIN CourseSeries cs ON cs.id = l.series_id
    LEFT JOIN Member m ON m.id = l.member_id AND l.member_id > 0
    ORDER BY datetime(l.visited_at) DESC, l.id DESC
    LIMIT 5000
  `).all<Record<string, unknown>>();

  return rows.map(row => {
    const source = cleanText(row.source, 'learn');
    return {
      id: `series-${row.id}`,
      category: 'student',
      visitedAt: dateText(row.visited_at),
      platform: normalizePlatform(source, row.platform),
      module: '线上课程',
      action: visitActionLabel(source),
      targetTitle: cleanText(row.series_name, `课程 #${row.series_id}`),
      visitorName: memberLabel(row),
      visitorPhone: cleanText(row.member_phone),
      visitorKey: cleanText(row.visitor_key),
      visitorType: Number(row.member_id || 0) > 0 ? '学员' : '游客',
      source,
      remark: cleanText(row.member_id).startsWith('-') ? '游客访问' : '',
    };
  });
}

function videoProgressRows(db: AdminDb): AccessRecord[] {
  if (!tableExists(db, 'VideoProgress')) return [];
  const platformSelect = hasColumn(db, 'VideoProgress', 'platform') ? 'vp.platform' : "'' AS platform";

  const rows = db.prepare(`
    SELECT
      vp.id, vp.member_id, vp.video_id, vp.progress, vp.duration, vp.completed,
      ${platformSelect},
      COALESCE(vp.last_play_at, vp.created_at) AS visited_at,
      cv.name AS video_name, cs.name AS series_name,
      m.name AS member_name, m.phone AS member_phone
    FROM VideoProgress vp
    LEFT JOIN CourseVideo cv ON cv.id = vp.video_id
    LEFT JOIN OnlineCourse oc ON oc.id = cv.course_id
    LEFT JOIN CourseSeries cs ON cs.id = oc.series_id
    LEFT JOIN Member m ON m.id = vp.member_id
    ORDER BY datetime(COALESCE(vp.last_play_at, vp.created_at)) DESC, vp.id DESC
    LIMIT 5000
  `).all<Record<string, unknown>>();

  return rows.map(row => {
    const completed = Number(row.completed || 0) > 0;
    const progress = Math.max(0, Number(row.progress || 0));
    const duration = Math.max(0, Number(row.duration || 0));
    const percent = duration > 0 ? Math.min(100, Math.round((progress / duration) * 100)) : 0;
    return {
      id: `video-${row.id}`,
      category: 'student',
      visitedAt: dateText(row.visited_at),
      platform: normalizePlatform('video_progress', row.platform),
      module: '线上课程',
      action: completed ? '完成视频学习' : '视频学习进度',
      targetTitle: [cleanText(row.series_name), cleanText(row.video_name, `课节 #${row.video_id}`)].filter(Boolean).join(' / '),
      visitorName: cleanText(row.member_name, '未知学员'),
      visitorPhone: cleanText(row.member_phone),
      visitorKey: '',
      visitorType: '学员',
      source: 'video_progress',
      remark: percent ? `进度 ${percent}%` : '',
    };
  });
}

function adminNameMap(db: AdminDb) {
  const map = new Map<string, string>();
  if (tableExists(db, 'User')) {
    const rows = db.prepare('SELECT username, name FROM User').all<Record<string, unknown>>();
    rows.forEach(row => {
      const username = cleanText(row.username);
      const name = cleanText(row.name);
      if (username && name) map.set(username, name);
      if (name) map.set(name, name);
    });
  }
  if (tableExists(db, 'AdminUser')) {
    const rows = db.prepare('SELECT phone, name FROM AdminUser').all<Record<string, unknown>>();
    rows.forEach(row => {
      const phone = cleanText(row.phone);
      const name = cleanText(row.name);
      if (phone && name) map.set(phone, name);
      if (name) map.set(name, name);
    });
  }
  return map;
}

function splitStudentOperation(detail: string, fallbackName: string) {
  const ip = detail.match(/IP\s*:\s*([^\s]+)\s*$/i)?.[1] || '';
  const withoutIp = detail.replace(/\s*-\s*IP\s*:\s*[^\s]+?\s*$/i, '').trim();
  const parts = withoutIp.split(/\s*-\s*/).map(part => part.trim()).filter(Boolean);
  const visitorPart = parts[0] || fallbackName;
  const visitorName = visitorPart.replace(/[（(].*?[）)]/g, '').trim() || fallbackName || '未知学员';
  const phone = visitorPart.match(/1\d{10}/)?.[0] || '';
  return {
    action: parts[1] || '访问学员端',
    targetTitle: withoutIp || detail || '-',
    visitorName,
    phone,
    ip,
  };
}

function operationRows(db: AdminDb): AccessRecord[] {
  if (!tableExists(db, 'OperationLog')) return [];

  const names = adminNameMap(db);
  const rows = db.prepare(`
    SELECT id, time, operator, type, module, detail
    FROM OperationLog
    ORDER BY datetime(time) DESC, id DESC
    LIMIT 3000
  `).all<Record<string, unknown>>();

  return rows.map(row => {
    const module = cleanText(row.module, '系统');
    const type = cleanText(row.type, '后台操作');
    const detail = cleanText(row.detail, '-');
    const operator = cleanText(row.operator, '管理员');
    const visitedAt = dateText(row.time);

    if (module === '学员端') {
      const student = splitStudentOperation(detail, operator);
      return {
        id: `operation-student-${row.id}`,
        category: 'student',
        visitedAt,
        platform: '官网/学员端',
        module,
        action: student.action,
        targetTitle: student.targetTitle,
        visitorName: student.visitorName,
        visitorPhone: student.phone,
        visitorKey: '',
        visitorType: '学员',
        source: 'student_portal',
        remark: student.ip ? `IP:${student.ip}` : '',
      } satisfies AccessRecord;
    }

    return {
      id: `admin-${row.id}`,
      category: 'admin',
      visitedAt,
      platform: '后台系统',
      module,
      action: type,
      targetTitle: detail,
      visitorName: names.get(operator) || operator,
      visitorPhone: '',
      visitorKey: '',
      visitorType: '管理员',
      source: 'admin',
      remark: '',
    } satisfies AccessRecord;
  });
}

function filterRows(rows: AccessRecord[], request: Request) {
  const url = new URL(request.url);
  const q = cleanText(url.searchParams.get('q')).toLowerCase();
  const platform = cleanText(url.searchParams.get('platform'), 'all');
  const action = cleanText(url.searchParams.get('action'), 'all');
  const start = cleanText(url.searchParams.get('start'));
  const end = cleanText(url.searchParams.get('end'));

  return rows.filter(row => {
    if (platform !== 'all' && row.platform !== platform) return false;
    if (action !== 'all' && row.action !== action) return false;
    if (start && row.visitedAt.slice(0, 10) < start) return false;
    if (end && row.visitedAt.slice(0, 10) > end) return false;
    if (!q) return true;
    return [
      row.visitedAt,
      row.platform,
      row.module,
      row.action,
      row.targetTitle,
      row.visitorName,
      row.visitorPhone,
      row.visitorKey,
      row.visitorType,
      row.source,
      row.remark,
    ].join(' ').toLowerCase().includes(q);
  });
}

function countBy<T extends string>(rows: AccessRecord[], keyOf: (row: AccessRecord) => T) {
  return Array.from(rows.reduce((map, row) => {
    const key = keyOf(row);
    map.set(key, (map.get(key) || 0) + 1);
    return map;
  }, new Map<T, number>()).entries()).map(([key, count]) => ({ key, count }));
}

export async function GET(request: Request) {
  const permissionError = requirePermission(request, 'permLogView', '无权限查看访问记录');
  if (permissionError) return permissionError;

  const db = openAdminDb();
  try {
    const rows = [
      ...courseVisitRows(db),
      ...videoProgressRows(db),
      ...operationRows(db),
    ]
      .filter(row => row.visitedAt)
      .sort((a, b) => b.visitedAt.localeCompare(a.visitedAt));

    const url = new URL(request.url);
    const category = cleanText(url.searchParams.get('category'), 'student') === 'admin' ? 'admin' : 'student';
    const page = clampNumber(url.searchParams.get('page'), 1, 1, 100000);
    const pageSize = clampNumber(url.searchParams.get('pageSize'), 20, 20, 100);
    const categoryRows = rows.filter(row => row.category === category);
    const filtered = filterRows(categoryRows, request);
    const offset = (page - 1) * pageSize;
    const today = shanghaiDateKey();
    const month = today.slice(0, 7);
    const visitorKeys = new Set(filtered.map(row => row.visitorPhone || row.visitorKey || row.visitorName).filter(Boolean));
    const byPlatform = countBy(filtered, row => row.platform).map(item => ({ platform: item.key, count: item.count }));
    const byAction = countBy(filtered, row => row.action).map(item => ({ action: item.key, count: item.count }));
    const categoryCounts = {
      student: rows.filter(row => row.category === 'student').length,
      admin: rows.filter(row => row.category === 'admin').length,
    };

    return Response.json({
      success: true,
      data: {
        records: filtered.slice(offset, offset + pageSize),
        summary: {
          total: filtered.length,
          today: filtered.filter(row => row.visitedAt.startsWith(today)).length,
          month: filtered.filter(row => row.visitedAt.startsWith(month)).length,
          visitors: visitorKeys.size,
          student: categoryCounts.student,
          admin: categoryCounts.admin,
        },
        pagination: {
          page,
          pageSize,
          total: filtered.length,
        },
        byPlatform,
        byAction,
      },
    });
  } catch (error) {
    console.error('Access records failed:', error);
    return Response.json({ success: false, error: '访问记录统计失败' }, { status: 500 });
  } finally {
    db.close();
  }
}
