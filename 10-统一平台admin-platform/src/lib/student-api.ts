'use client';

const STUDENT_TOKEN_KEY = 'student_token';
const STUDENT_MEMBER_KEY = 'student_member';
const STUDENT_AUTH_EXPIRES_KEY = 'student_auth_expires_at';
const LEGACY_STUDENT_TOKEN_KEY = 'studentToken';
const LEGACY_STUDENT_ID_KEY = 'studentId';
const LEGACY_STUDENT_NAME_KEY = 'studentName';
const LEGACY_STUDENT_AUTH_EXPIRES_KEY = 'studentAuthExpiresAt';
const STUDENT_AUTH_TTL_MS = 3 * 86400 * 1000;

type QueryValue = string | number | boolean | null | undefined;

export interface StudentMember {
  id: string;
  name: string;
  phone?: string;
  avatar?: string;
  level?: string;
  gender?: string;
  birthday?: string;
  country?: string;
  province?: string;
  city?: string;
  address?: string;
  remark?: string;
  registerDate?: string;
}

export interface StudentCourse {
  id: string;
  title: string;
  tag: string;
  progress: number;
  lessons: number;
  color: string;
  cover?: string;
  learners?: number;
  duration?: string;
}

export interface StudentSession {
  id: string;
  date: string;
  day: string;
  title: string;
  time: string;
  action: string;
}

export interface StudentPlan {
  id: string;
  text: string;
  done: boolean;
}

export interface StudentProgressSummary {
  percent: number;
  learnedCourses: number;
  learningHours: number;
  streakDays: number;
  offlineCourses: number;
  consumedSessions: number;
  remainingSessions: number;
}

export interface StudentCertificate {
  id: string;
  certificateNo: string;
  courseName: string;
  memberName: string;
  issueDate: string;
  pdfUrl?: string;
  status?: string;
}

export interface StudentHomeData {
  member: StudentMember;
  progress: StudentProgressSummary;
  courseStats: {
    onlineCourses: number;
    offlineCourses: number;
  };
  courses: StudentCourse[];
  sessions: StudentSession[];
  plans: StudentPlan[];
  recommend: StudentCourse[];
  payments: StudentPayment[];
  consumeRecords: StudentConsumeRecord[];
}

export interface StudentPayment {
  id: string;
  courseId: string;
  courseName: string;
  courseType: string;
  courseSessions: number;
  date: string;
  expireDate: string;
  remainingSessions: number;
  courseEndDate: string;
  todayCheckinCount: number;
  amount: number;
  status: 'active' | 'completed' | 'expired';
}

export interface StudentConsumeRecord {
  id: string;
  courseName: string;
  count: number;
  consumeDate: string;
  remainingAfter: number;
  operator: string;
  remark: string;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, QueryValue>;
  body?: BodyInit | Record<string, unknown>;
}

const API_BASE = (process.env.NEXT_PUBLIC_STUDENT_API_URL || '/api/mini').replace(/\/$/, '');
const courseColors = ['#C8A96E', '#8B1A1A', '#A98746', '#D8C39A', '#B87560', '#E8DDCB'];

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readString(source: Record<string, any>, keys: string[], fallback = ''): string {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') return String(value);
  }
  return fallback;
}

function readNumber(source: Record<string, any>, keys: string[], fallback = 0): number {
  for (const key of keys) {
    const value = Number(source[key]);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function unwrapData<T = any>(payload: any): T {
  if (Array.isArray(payload)) return payload as T;
  if (!isRecord(payload)) return payload as T;
  if ('data' in payload) return unwrapData<T>(payload.data);
  if ('result' in payload) return unwrapData<T>(payload.result);
  if ('rows' in payload) return payload.rows as T;
  if ('list' in payload) return payload.list as T;
  if ('items' in payload) return payload.items as T;
  return payload as T;
}

function asArray(payload: any): any[] {
  const data = unwrapData(payload);
  return Array.isArray(data) ? data : [];
}

function buildUrl(path: string, params?: Record<string, QueryValue>): string {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  });
  return url.toString();
}

function authStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function parseTokenExpiry(token: string): number {
  try {
    const payload = token.split('.')[1];
    if (!payload) return 0;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = `${normalized}${'='.repeat((4 - normalized.length % 4) % 4)}`;
    const body = JSON.parse(window.atob(padded)) as { exp?: unknown };
    const exp = Number(body.exp);
    return Number.isFinite(exp) ? exp : 0;
  } catch {
    return 0;
  }
}

function ensureAuthExpiresAt(storage: Storage): number {
  const current = Number(storage.getItem(STUDENT_AUTH_EXPIRES_KEY) || storage.getItem(LEGACY_STUDENT_AUTH_EXPIRES_KEY) || 0);
  if (current) return current;
  const token = storage.getItem(STUDENT_TOKEN_KEY) || storage.getItem(LEGACY_STUDENT_TOKEN_KEY) || '';
  if (!token) return 0;
  const tokenExp = parseTokenExpiry(token);
  const expiresAt = tokenExp ? Math.min(tokenExp, Date.now() + STUDENT_AUTH_TTL_MS) : Date.now() + STUDENT_AUTH_TTL_MS;
  storage.setItem(STUDENT_AUTH_EXPIRES_KEY, String(expiresAt));
  storage.setItem(LEGACY_STUDENT_AUTH_EXPIRES_KEY, String(expiresAt));
  return expiresAt;
}

function authExpired(storage: Storage): boolean {
  const expiresAt = ensureAuthExpiresAt(storage);
  if (!expiresAt) return false;
  return expiresAt <= Date.now();
}

function getToken(): string | null {
  const storage = authStorage();
  if (!storage) return null;
  if (authExpired(storage)) {
    clearAuth();
    return null;
  }
  return storage.getItem(STUDENT_TOKEN_KEY) || storage.getItem(LEGACY_STUDENT_TOKEN_KEY) || null;
}

function setToken(token: string): void {
  const storage = authStorage();
  if (!storage) return;
  const expiresAt = String(Date.now() + STUDENT_AUTH_TTL_MS);
  storage.setItem(STUDENT_TOKEN_KEY, token);
  storage.setItem(LEGACY_STUDENT_TOKEN_KEY, token);
  storage.setItem(STUDENT_AUTH_EXPIRES_KEY, expiresAt);
  storage.setItem(LEGACY_STUDENT_AUTH_EXPIRES_KEY, expiresAt);
}

function getStoredMember(): StudentMember | null {
  const storage = authStorage();
  if (!storage) return null;
  if (authExpired(storage)) {
    clearAuth();
    return null;
  }
  try {
    const raw = storage.getItem(STUDENT_MEMBER_KEY);
    if (raw) return normalizeMember(JSON.parse(raw));
    const legacyId = storage.getItem(LEGACY_STUDENT_ID_KEY) || '';
    if (!legacyId) return null;
    return normalizeMember({
      id: legacyId,
      name: storage.getItem(LEGACY_STUDENT_NAME_KEY) || '同学',
    });
  } catch {
    return null;
  }
}

function setStoredMember(member: StudentMember): void {
  const storage = authStorage();
  if (!storage) return;
  storage.setItem(STUDENT_MEMBER_KEY, JSON.stringify(member));
  storage.setItem(LEGACY_STUDENT_ID_KEY, String(member.id || ''));
  storage.setItem(LEGACY_STUDENT_NAME_KEY, member.name || '');
}

function clearAuth(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(STUDENT_TOKEN_KEY);
  sessionStorage.removeItem(STUDENT_MEMBER_KEY);
  sessionStorage.removeItem(STUDENT_AUTH_EXPIRES_KEY);
  sessionStorage.removeItem(LEGACY_STUDENT_TOKEN_KEY);
  sessionStorage.removeItem(LEGACY_STUDENT_ID_KEY);
  sessionStorage.removeItem(LEGACY_STUDENT_NAME_KEY);
  sessionStorage.removeItem(LEGACY_STUDENT_AUTH_EXPIRES_KEY);
  localStorage.removeItem(STUDENT_TOKEN_KEY);
  localStorage.removeItem(STUDENT_MEMBER_KEY);
  localStorage.removeItem(STUDENT_AUTH_EXPIRES_KEY);
  localStorage.removeItem(LEGACY_STUDENT_TOKEN_KEY);
  localStorage.removeItem(LEGACY_STUDENT_ID_KEY);
  localStorage.removeItem(LEGACY_STUDENT_NAME_KEY);
  localStorage.removeItem(LEGACY_STUDENT_AUTH_EXPIRES_KEY);
}

async function request<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(buildUrl(path, options.params), {
    ...options,
    headers,
    body: typeof options.body === 'string' || options.body === undefined ? options.body : JSON.stringify(options.body),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = isRecord(payload) ? payload.message || payload.error : '';
    throw new Error(message ? `${message} (${response.status})` : `请求失败 (${response.status})`);
  }

  return payload as T;
}

function normalizeMember(raw: any): StudentMember {
  const source = isRecord(raw?.member) ? raw.member : isRecord(raw?.user) ? raw.user : isRecord(raw) ? raw : {};
  const id = readString(source, ['id', 'memberId', 'member_id', 'studentId', 'student_id']);
  return {
    id,
    name: readString(source, ['name', 'realName', 'real_name', 'nickname', 'username'], '同学'),
    phone: readString(source, ['phone', 'mobile', 'telephone']),
    avatar: readString(source, ['avatar', 'avatarUrl', 'avatar_url', 'photo']),
    level: readString(source, ['level', 'memberLevel', 'member_level', 'membershipLevel'], '学员'),
    gender: readString(source, ['gender']),
    birthday: readString(source, ['birthday']),
    country: readString(source, ['country']),
    province: readString(source, ['province']),
    city: readString(source, ['city']),
    address: readString(source, ['address']),
    remark: readString(source, ['remark']),
    registerDate: readString(source, ['registerDate', 'register_date', 'created_at']).slice(0, 10),
  };
}

function extractLoginMember(payload: any): StudentMember {
  const data = unwrapData(payload);
  return normalizeMember(data);
}

function extractLoginToken(payload: any): string {
  const data = isRecord(payload?.data) ? payload.data : payload;
  return readString(isRecord(data) ? data : {}, ['token', 'accessToken', 'access_token', 'jwt']);
}

function normalizeCourse(raw: any, index: number): StudentCourse {
  const source = isRecord(raw?.course) ? raw.course : isRecord(raw?.series) ? raw.series : isRecord(raw) ? raw : {};
  const progress = clampPercent(readNumber(source, ['progress', 'progressPercent', 'progress_percent', 'completionRate']));
  return {
    id: readString(source, ['id', 'courseId', 'course_id', 'seriesId', 'series_id'], `course-${index}`),
    title: readString(source, ['title', 'name', 'courseName', 'course_name', 'seriesName', 'series_name'], '未命名课程'),
    tag: readString(source, ['tag', 'label', 'type', 'category'], index === 0 ? 'NEW' : '推荐'),
    progress,
    lessons: readNumber(source, ['lessons', 'lessonCount', 'lesson_count', 'videoCount', 'video_count', 'totalLessons', 'total_courses', 'course_count'], 0),
    color: readString(source, ['color', 'themeColor'], courseColors[index % courseColors.length]),
    cover: readString(source, ['cover', 'coverUrl', 'cover_url', 'cover_image', 'image', 'thumbnail']),
    learners: readNumber(source, ['learners', 'studentCount', 'student_count', 'total_students', 'sales'], 0),
    duration: readString(source, ['duration', 'totalDuration', 'total_duration', 'total_hours']),
  };
}

function normalizeCertificate(raw: any): StudentCertificate {
  const source = isRecord(raw) ? raw : {};
  return {
    id: readString(source, ['id', 'certificateId', 'certificate_id']),
    certificateNo: readString(source, ['certificateNo', 'certificate_no', 'certNo', 'cert_no']),
    courseName: readString(source, ['courseName', 'course_name', 'seriesName', 'series_name', 'name'], '结业证书'),
    memberName: readString(source, ['memberName', 'member_name']),
    issueDate: readString(source, ['issueDate', 'issue_date']).slice(0, 10),
    pdfUrl: readString(source, ['pdfUrl', 'pdf_url']),
    status: readString(source, ['status'], 'active'),
  };
}

function normalizeSession(raw: any, index: number): StudentSession {
  const source = isRecord(raw) ? raw : {};
  const startRaw = readString(source, ['startTime', 'start_time', 'date', 'sessionDate', 'session_date']);
  const start = startRaw ? new Date(startRaw) : null;
  const validDate = start && !Number.isNaN(start.getTime());
  const endRaw = readString(source, ['endTime', 'end_time']);
  const end = endRaw ? new Date(endRaw) : null;
  const time = validDate
    ? `${start.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}${end && !Number.isNaN(end.getTime()) ? ` - ${end.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}` : ''}`
    : readString(source, ['time', 'timeRange', 'time_range'], '待定');

  return {
    id: readString(source, ['id', 'sessionId', 'session_id'], `session-${index}`),
    date: validDate ? start.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }).replace('/', '.') : readString(source, ['dateLabel'], '近期'),
    day: validDate ? start.toLocaleDateString('zh-CN', { weekday: 'short' }) : readString(source, ['day'], ''),
    title: readString(source, ['title', 'name', 'courseName', 'course_name'], '课程安排'),
    time,
    action: readString(source, ['action'], '查看详情'),
  };
}

function normalizePayment(raw: any): StudentPayment {
  const source = isRecord(raw) ? raw : {};
  const remainingSessions = readNumber(source, ['remainingSessions', 'remaining_sessions'], 0);
  const today = new Date().toISOString().slice(0, 10);
  const expireDate = readString(source, ['expireDate', 'expire_date', 'courseEndDate', 'course_end_date']).slice(0, 10);
  const status = remainingSessions <= 0 ? 'completed' : expireDate && expireDate < today ? 'expired' : 'active';
  return {
    id: readString(source, ['id', 'paymentId', 'payment_id']),
    courseId: readString(source, ['courseId', 'course_id']),
    courseName: readString(source, ['courseName', 'course_name'], '未知课程'),
    courseType: readString(source, ['courseType', 'course_type']),
    courseSessions: readNumber(source, ['courseSessions', 'course_sessions'], 0),
    date: readString(source, ['date']).slice(0, 10),
    expireDate,
    remainingSessions,
    courseEndDate: readString(source, ['courseEndDate', 'course_end_date']).slice(0, 10),
    todayCheckinCount: readNumber(source, ['todayCheckinCount', 'today_checkin_count'], 0),
    amount: readNumber(source, ['amount'], 0),
    status,
  };
}

function normalizeConsumeRecord(raw: any): StudentConsumeRecord {
  const source = isRecord(raw) ? raw : {};
  return {
    id: readString(source, ['id', 'consumeId', 'consume_id']),
    courseName: readString(source, ['courseName', 'course_name'], '未知课程'),
    count: readNumber(source, ['count'], 1),
    consumeDate: readString(source, ['consumeDate', 'consume_date', 'date']).slice(0, 10),
    remainingAfter: readNumber(source, ['remainingAfter', 'remaining_after'], 0),
    operator: readString(source, ['operator'], '-'),
    remark: readString(source, ['remark']),
  };
}

function normalizePlan(raw: any, index: number): StudentPlan {
  const source = isRecord(raw) ? raw : {};
  return {
    id: readString(source, ['id', 'checkinId', 'checkin_id'], `plan-${index}`),
    text: readString(source, ['title', 'content', 'text', 'task'], '练习打卡 20 分钟'),
    done: Boolean(source.done ?? source.completed ?? source.checked ?? source.isCompleted ?? source.status === 'completed'),
  };
}

function mergeAuthorizedSeries(authorizedRows: any[], publicRows: any[], progressRows: any[]): any[] {
  const publicById = new Map<string, any>();
  publicRows.filter(isRecord).forEach(row => {
    const id = String(row.id ?? row.series_id ?? row.seriesId ?? '');
    if (id) publicById.set(id, row);
  });
  const progressBySeries = new Map<string, { total: number; count: number; completed: number }>();

  progressRows.filter(isRecord).forEach(row => {
    const seriesId = readString(row, ['series_id', 'seriesId']);
    if (!seriesId) return;
    const current = progressBySeries.get(seriesId) || { total: 0, count: 0, completed: 0 };
    const percent = clampPercent(readNumber(row, ['progress', 'progressPercent', 'progress_percent']));
    current.total += percent;
    current.count += 1;
    if (Boolean(row.completed ?? row.isCompleted) || percent >= 95) current.completed += 1;
    progressBySeries.set(seriesId, current);
  });

  return authorizedRows.filter(isRecord).map((row, index) => {
    const seriesId = readString(row, ['series_id', 'seriesId', 'id'], `series-${index}`);
    const publicRow = publicById.get(seriesId) || {};
    const progress = progressBySeries.get(seriesId);
    return {
      ...publicRow,
      ...row,
      id: seriesId,
      series_id: seriesId,
      name: readString(row, ['series_name', 'seriesName', 'name'], readString(publicRow, ['name'], '未命名课程')),
      progress: progress?.count ? Math.round(progress.total / progress.count) : readNumber(row, ['progress'], 0),
      lesson_count: readNumber(publicRow, ['total_courses', 'lesson_count', 'course_count'], progress?.count || 0),
      completed_lessons: progress?.completed || 0,
    };
  });
}

function normalizeProgress(records: any[], courses: StudentCourse[], payments: StudentPayment[] = [], consumes: StudentConsumeRecord[] = []): StudentProgressSummary {
  const uniqueCompleted = new Set<string>();
  let totalSeconds = 0;
  let percentTotal = 0;
  let percentCount = 0;
  const activeDays = new Set<string>();

  records.forEach((item, index) => {
    const source = isRecord(item) ? item : {};
    const id = readString(source, ['courseId', 'course_id', 'videoId', 'video_id', 'id'], `progress-${index}`);
    const percent = clampPercent(readNumber(source, ['progress', 'percent', 'progressPercent', 'progress_percent']));
    const seconds = readNumber(source, ['duration', 'watchedSeconds', 'watched_seconds', 'learningSeconds', 'learning_seconds', 'seconds']);
    const minutes = readNumber(source, ['minutes', 'learningMinutes', 'learning_minutes']);
    const hours = readNumber(source, ['hours', 'learningHours', 'learning_hours']);
    const date = readString(source, ['updatedAt', 'updated_at', 'createdAt', 'created_at', 'date']);

    if (Boolean(source.completed ?? source.isCompleted) || percent >= 95) uniqueCompleted.add(id);
    totalSeconds += seconds + minutes * 60 + hours * 3600;
    if (percent > 0) {
      percentTotal += percent;
      percentCount += 1;
    }
    if (date) activeDays.add(date.slice(0, 10));
  });

  const coursePercent = courses.length
    ? Math.round(courses.reduce((sum, course) => sum + course.progress, 0) / courses.length)
    : 0;

  return {
    percent: percentCount ? Math.round(percentTotal / percentCount) : coursePercent,
    learnedCourses: uniqueCompleted.size || courses.filter(course => course.progress >= 95).length,
    learningHours: Math.round((totalSeconds / 3600) * 10) / 10,
    streakDays: calculateStreak(activeDays),
    offlineCourses: payments.length,
    consumedSessions: consumes.reduce((sum, item) => sum + item.count, 0),
    remainingSessions: payments.reduce((sum, item) => sum + item.remainingSessions, 0),
  };
}

function uniqueOfflineCourseCount(payments: StudentPayment[]) {
  const keys = new Set<string>();
  payments.forEach((payment, index) => {
    const key = [
      payment.courseId || payment.courseName || `payment-${payment.id || index}`,
      payment.date || '',
    ].join('|');
    keys.add(key);
  });
  return keys.size;
}

function calculateStreak(days: Set<string>): number {
  if (!days.size) return 0;
  let streak = 0;
  const cursor = new Date();
  for (let i = 0; i < 365; i += 1) {
    const key = cursor.toISOString().slice(0, 10);
    if (!days.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak || days.size;
}

async function firstSuccessfulList(paths: string[], params?: Record<string, QueryValue>): Promise<any[]> {
  for (const path of paths) {
    try {
      return asArray(await request(path, { params }));
    } catch {}
  }
  return [];
}

export const studentApi = {
  getToken,
  getStoredMember,
  clearAuth,
  sendCode: (phone: string) => request('/send-code', { method: 'POST', body: { phone } }),
  login: async (phone: string, code: string): Promise<StudentMember> => {
    const payload = await request('/student-login', { method: 'POST', body: { phone, code } });
    const token = extractLoginToken(payload);
    const member = extractLoginMember(payload);
    if (!token) throw new Error('登录成功但未返回令牌');
    if (!member.id) throw new Error('登录成功但未返回学员信息');
    setToken(token);
    setStoredMember(member);
    return member;
  },
  getMember: async (memberId?: string): Promise<StudentMember> => normalizeMember(await request('/member/profile', { params: { member_id: memberId } })),
  updateMember: async (memberId: string, payload: Partial<StudentMember>): Promise<StudentMember> => {
    const updated = normalizeMember(await request('/member/profile', { method: 'PUT', params: { member_id: memberId }, body: payload }));
    setStoredMember(updated);
    return updated;
  },
  getCertificates: async (memberId: string): Promise<StudentCertificate[]> => {
    const rows = await request('/certificates', { params: { member_id: memberId } });
    return asArray(rows).map(normalizeCertificate);
  },
  getPayments: async (memberId: string): Promise<StudentPayment[]> => {
    const rows = await request('/member/payments', { params: { member_id: memberId } });
    return asArray(rows).map(normalizePayment);
  },
  getConsumeRecords: async (memberId: string): Promise<StudentConsumeRecord[]> => {
    const rows = await request('/member/consume-records', { params: { member_id: memberId } });
    return asArray(rows).map(normalizeConsumeRecord);
  },
  checkInPayment: async (memberId: string, paymentId: string) => request('/member/checkin', { method: 'POST', params: { member_id: memberId }, body: { paymentId } }),
  getHomeData: async (memberId: string): Promise<StudentHomeData> => {
    const memberParams = { member_id: memberId };
    const [profile, authorizedRows, recentRows, checkinRows, publicSeriesRows, paymentRows, consumeRows] = await Promise.all([
      request('/member/profile', { params: memberParams }),
      firstSuccessfulList(['/member/authorized-series'], memberParams),
      firstSuccessfulList(['/member/recent-courses'], memberParams),
      firstSuccessfulList(['/member/checkins', '/checkins/my'], memberParams),
      firstSuccessfulList(['/public/series']),
      firstSuccessfulList(['/member/payments'], memberParams),
      firstSuccessfulList(['/member/consume-records'], memberParams),
    ]);

    const member = normalizeMember(unwrapData(profile));
    const payments = paymentRows.map(normalizePayment);
    const consumeRecords = consumeRows.map(normalizeConsumeRecord);
    const mergedAuthorized = mergeAuthorizedSeries(authorizedRows, publicSeriesRows, recentRows);
    const courseRows = mergedAuthorized.length ? mergedAuthorized : recentRows;
    const courses = courseRows.map(normalizeCourse);
    const recommend = publicSeriesRows
      .filter(row => !mergedAuthorized.some(course => String(course.series_id || course.id) === String(row.series_id || row.id)))
      .map(normalizeCourse)
      .slice(0, 4);
    const plans = checkinRows.slice(0, 5).map((row, index) => normalizePlan({
      ...row,
      title: readString(isRecord(row) ? row : {}, ['remark', 'content', 'title'], '练习打卡'),
      done: true,
    }, index));

    return {
      member,
      progress: normalizeProgress(recentRows, courses, payments, consumeRecords),
      courseStats: {
        onlineCourses: courseRows.length,
        offlineCourses: uniqueOfflineCourseCount(payments),
      },
      courses,
      sessions: payments.filter(payment => payment.status === 'active').slice(0, 3).map((payment, index) => normalizeSession({
        id: `payment-${payment.id}`,
        date: payment.courseEndDate || payment.expireDate || payment.date,
        title: payment.courseName,
        time: payment.courseType || '线下课程',
        action: payment.remainingSessions > 0 ? '可签到' : '查看',
      }, index)),
      plans,
      recommend,
      payments,
      consumeRecords,
    };
  },
};
