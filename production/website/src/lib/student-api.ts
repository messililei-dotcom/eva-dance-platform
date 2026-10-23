'use client';

import { clearStudentSession, preferredStudentName, saveStudentSession, STUDENT_AUTH_CHANGED_EVENT } from '@/lib/student-auth';
import { requestStudentJson, StudentConnectionError } from '@/lib/student-connection';
import { extractStudentLoginPayload } from '@/lib/student-login-payload';
import {
  parseMemberTokenExpiry,
  parseMemberTokenMemberId,
  STUDENT_SESSION_TTL_MS,
} from '@/lib/student-session-client';
import { smsSendErrorMessage } from '@/lib/sms-verification';

const STUDENT_TOKEN_KEY = 'student_token';
const STUDENT_MEMBER_KEY = 'student_member';
const STUDENT_AUTH_EXPIRES_KEY = 'student_auth_expires_at';
const STUDENT_AUTH_TTL_MS = STUDENT_SESSION_TTL_MS;

type QueryValue = string | number | boolean | null | undefined;

export interface StudentMember {
  id: string;
  name: string;
  phone?: string;
  avatar?: string;
  level?: string;
  wxNickname?: string;
  wxName?: string;
  wxAccount?: string;
  wxAvatarUrl?: string;
  wxOpenid?: string;
  wxUnionid?: string;
  wxProfileSyncedAt?: string;
  isWechatBound?: boolean;
  gender?: string;
  birthday?: string;
  country?: string;
  province?: string;
  city?: string;
  address?: string;
  remark?: string;
  registerDate?: string;
  authorizedCourses?: StudentCourse[];
  payments?: StudentPayment[];
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

export interface StudentMessage {
  recipientId: number;
  messageId: number;
  type: 'welcome' | 'growth' | 'level_up' | 'course' | 'offline' | 'consume' | 'certificate' | 'event' | 'system' | string;
  title: string;
  content: string;
  actionUrl: string;
  businessType: string;
  businessId: string;
  priority: 'normal' | 'important' | 'urgent' | string;
  payload: Record<string, unknown>;
  status: 'unread' | 'read';
  readAt: string;
  createdAt: string;
}

export interface StudentMessagePage {
  items: StudentMessage[];
  unreadCount: number;
  nextCursor: number;
  hasMore: boolean;
}

export interface StudentCompetitionJudgeScore {
  judgeId: string;
  judgeName: string;
  score: number | null;
}

export interface StudentCompetitionEntry {
  entrantName:string;registrationFee:number;paidAmount:number;paidAt:string;canPay:boolean;
  playerId: string;
  competitionId: string;
  competitionName: string;
  competitionCode: string;
  competitionStatus: string;
  startDate: string;
  endDate: string;
  location: string;
  coverUrl: string;
  groupId: string;
  groupName: string;
  playerNo: string;
  performanceTitle: string;
  organization: string;
  teacher: string;
  auditStatus: string;
  paidStatus: string;
  scoreStatus: string;
  registeredAt: string;
  resultPublished: boolean;
  totalScore: number | null;
  rankNo: number;
  awardName: string;
  publishedAt: string;
  judgeScores: StudentCompetitionJudgeScore[];
}

export interface StudentHomeData {
  member: StudentMember;
  progress: StudentProgressSummary;
  courses: StudentCourse[];
  sessions: StudentSession[];
  plans: StudentPlan[];
  recommend: StudentCourse[];
  payments: StudentPayment[];
  consumeRecords: StudentConsumeRecord[];
}

export interface StudentPayment {
  id: string;
  memberName?: string;
  memberPhone?: string;
  courseId: string;
  courseName: string;
  courseType: string;
  courseSubType: string;
  courseSessions: number;
  date: string;
  paymentMethod: string;
  sales: string;
  expireDate: string;
  remainingSessions: number;
  consumedSessions: number;
  courseEndDate: string;
  todayCheckinCount: number;
  amount: number;
  remark: string;
  status: 'active' | 'completed' | 'expired';
}

export interface StudentConsumeRecord {
  id: string;
  paymentId: string;
  courseName: string;
  count: number;
  consumeDate: string;
  remainingAfter: number;
  operator: string;
  remark: string;
}

export interface OfflineEntitlement {
  id: string;
  course_id: string;
  course_name: string;
  course_period: string;
  total_sessions: number;
  available_sessions: number;
  frozen_sessions: number;
  used_sessions: number;
  valid_until: string;
}

export interface OfflineSession {
  id: string;
  course_id: string;
  course_name: string;
  course_period: string;
  session_no: number;
  session_date: string;
  start_time: string;
  end_time: string;
  teacher_name: string;
  classroom: string;
  address: string;
  capacity: number;
  booked_count: number;
  actual_booked_count?: number;
  can_book: number | boolean;
  booking_reason?: string;
}

export interface OfflineBooking extends OfflineSession {
  member_id: string;
  session_id: string;
  entitlement_id: string;
  status: 'booked' | 'consumed' | 'cancelled';
  available_sessions: number;
  frozen_sessions: number;
  used_sessions: number;
}

export interface OfflineOverview {
  consumes?: any[];
  entitlements: OfflineEntitlement[];
  sessions: OfflineSession[];
  bookings: OfflineBooking[];
}

export interface StudentRegionOptions {
  countries: string[];
  provinces: string[];
  citiesByProvince: Record<string, string[]>;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, QueryValue>;
  body?: BodyInit | Record<string, unknown>;
}

const API_BASE = (process.env.NEXT_PUBLIC_STUDENT_API_URL || '/api/mini').replace(/\/$/, '');
const courseColors = ['#C8A96E', '#8B1A1A', '#A98746', '#D8C39A', '#B87560', '#E8DDCB'];
let sessionRefreshPromise: Promise<boolean> | null = null;

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

function ensureAuthExpiresAt(): number {
  const current = Number(localStorage.getItem(STUDENT_AUTH_EXPIRES_KEY) || 0);
  if (current) return current;
  const token = localStorage.getItem(STUDENT_TOKEN_KEY) || '';
  if (!token) return 0;
  const tokenExp = parseMemberTokenExpiry(token);
  const expiresAt = tokenExp ? Math.min(tokenExp, Date.now() + STUDENT_AUTH_TTL_MS) : Date.now() + STUDENT_AUTH_TTL_MS;
  localStorage.setItem(STUDENT_AUTH_EXPIRES_KEY, String(expiresAt));
  return expiresAt;
}

function authExpired(): boolean {
  const expiresAt = ensureAuthExpiresAt();
  if (!expiresAt) return false;
  return expiresAt <= Date.now();
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  if (authExpired()) {
    clearAuth();
    return null;
  }
  return localStorage.getItem(STUDENT_TOKEN_KEY);
}

function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STUDENT_TOKEN_KEY, token);
  localStorage.setItem(STUDENT_AUTH_EXPIRES_KEY, String(Date.now() + STUDENT_AUTH_TTL_MS));
}

function getStoredMember(expectedMemberId?: string): StudentMember | null {
  if (typeof window === 'undefined') return null;
  if (authExpired()) {
    clearAuth();
    return null;
  }
  try {
    const raw = localStorage.getItem(STUDENT_MEMBER_KEY);
    const member = raw ? normalizeMember(JSON.parse(raw)) : null;
    if (!member?.id) return null;
    const tokenId = parseMemberTokenMemberId(localStorage.getItem(STUDENT_TOKEN_KEY) || '');
    if (tokenId && member.id !== tokenId) return null;
    if (expectedMemberId && member.id !== String(expectedMemberId)) return null;
    return member;
  } catch {
    return null;
  }
}

function setStoredMember(member: StudentMember): void {
  if (typeof window === 'undefined') return;
  const tokenId = parseMemberTokenMemberId(localStorage.getItem(STUDENT_TOKEN_KEY) || '');
  if (tokenId && member.id !== tokenId) return;
  localStorage.setItem(STUDENT_MEMBER_KEY, JSON.stringify(member));
  window.dispatchEvent(new Event(STUDENT_AUTH_CHANGED_EVENT));
}

function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STUDENT_TOKEN_KEY);
  localStorage.removeItem(STUDENT_MEMBER_KEY);
  localStorage.removeItem(STUDENT_AUTH_EXPIRES_KEY);
  clearStudentSession();
}

function saveSession(token: string, rawMember: any): StudentMember {
  const member = normalizeMember(rawMember);
  if (!token) throw new Error('登录成功但未返回令牌');
  if (!member.id) throw new Error('登录成功但未返回学员信息');
  const tokenId = parseMemberTokenMemberId(token);
  if (tokenId && tokenId !== member.id) throw new Error('登录身份校验失败，请重新登录');
  setToken(token);
  setStoredMember(member);
  saveStudentSession({ token, id: member.id, name: preferredStudentName(member) });
  return member;
}

async function refreshStudentSession(expiredToken: string): Promise<boolean> {
  if (sessionRefreshPromise) return sessionRefreshPromise;

  sessionRefreshPromise = (async () => {
    try {
      const response = await fetch('/api/mini/session/refresh', {
        method: 'POST',
        headers: { Authorization: `Bearer ${expiredToken}` },
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const payload = await response.json().catch(() => null);
      const token = String(payload?.data?.token || '');
      const member = payload?.data?.member;
      if (!response.ok || !payload?.success || !token || !member?.id) return false;
      saveSession(token, member);
      if (payload.data.expiresAt) {
        localStorage.setItem(STUDENT_AUTH_EXPIRES_KEY, String(payload.data.expiresAt));
      }
      return true;
    } catch {
      return false;
    } finally {
      sessionRefreshPromise = null;
    }
  })();

  return sessionRefreshPromise;
}

async function request<T = any>(path: string, options: RequestOptions = {}, authRetried = false): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  try {
    return await requestStudentJson<T>(buildUrl(path, options.params), {
      ...options,
      headers,
      body: typeof options.body === 'string' || options.body === undefined ? options.body : JSON.stringify(options.body),
    });
  } catch (error) {
    const authFailed = error instanceof StudentConnectionError && error.failure.type === 'auth';
    if (!authRetried && token && authFailed && await refreshStudentSession(token)) {
      return request<T>(path, options, true);
    }
    if (authFailed && token) clearAuth();
    throw error;
  }
}

async function uploadAvatar(memberId: string, file: Blob): Promise<StudentMember> {
  const token = getToken();
  const form = new FormData();
  form.append('avatar', file, 'avatar.jpg');

  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(buildUrl('/member/wechat-avatar', { member_id: memberId }), {
    method: 'POST',
    headers,
    body: form,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    const message = isRecord(payload) ? payload.message || payload.error : '';
    throw new Error(message ? `${message} (${response.status})` : `头像上传失败 (${response.status})`);
  }

  const current = getStoredMember();
  const avatar = readString(unwrapData(payload), ['avatar', 'avatarUrl', 'avatar_url', 'wx_avatar_url']);
  const updated = normalizeMember({ ...(current || {}), id: memberId, avatar: avatar || current?.avatar || '', wxAvatarUrl: avatar || current?.wxAvatarUrl || '', avatar_url: avatar || current?.avatar || '' });
  setStoredMember(updated);
  return updated;
}

function normalizeMember(raw: any): StudentMember {
  const source = isRecord(raw?.member) ? raw.member : isRecord(raw?.user) ? raw.user : isRecord(raw) ? raw : {};
  const id = readString(source, ['id', 'memberId', 'member_id', 'studentId', 'student_id']);
  const wxName = readString(source, ['wxName', 'wx_name', 'wxNickname', 'wx_nickname', 'nickname']);
  return {
    id,
    name: readString(source, ['name', 'realName', 'real_name', 'nickname', 'username'], '同学'),
    phone: readString(source, ['phone', 'mobile', 'telephone']),
    avatar: readString(source, ['wx_avatar_url', 'wxAvatarUrl', 'avatar', 'avatarUrl', 'avatar_url', 'photo']),
    level: readString(source, ['level', 'memberLevel', 'member_level', 'membershipLevel'], '学员'),
    wxNickname: wxName,
    wxName,
    wxAccount: readString(source, ['wxAccount', 'wx_account']),
    wxAvatarUrl: readString(source, ['wxAvatarUrl', 'wx_avatar_url']),
    wxOpenid: readString(source, ['wxOpenid', 'wx_openid']),
    wxUnionid: readString(source, ['wxUnionid', 'wx_unionid']),
    wxProfileSyncedAt: readString(source, ['wxProfileSyncedAt', 'wx_profile_synced_at']),
    isWechatBound: Boolean(source.isWechatBound ?? source.is_wechat_bound ?? source.wx_openid ?? source.wx_unionid ?? source.wx_nickname ?? source.wx_name ?? source.wx_avatar_url),
    gender: readString(source, ['gender']),
    birthday: readString(source, ['birthday']),
    country: readString(source, ['country']),
    province: readString(source, ['province']),
    city: readString(source, ['city']),
    address: readString(source, ['address']),
    remark: readString(source, ['remark']),
    registerDate: readString(source, ['registerDate', 'register_date', 'created_at']).slice(0, 10),
    authorizedCourses: Array.isArray(source.authorizedCourses) ? source.authorizedCourses : [],
    payments: Array.isArray(source.payments) ? source.payments : [],
  };
}

function extractLoginMember(payload: any): StudentMember {
  return normalizeMember(extractStudentLoginPayload(payload).member);
}

function extractLoginToken(payload: any): string {
  return extractStudentLoginPayload(payload).token;
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

function normalizeCompetitionEntry(raw: any): StudentCompetitionEntry {
  const source = isRecord(raw) ? raw : {};
  const judgeScores = asArray(source.judgeScores ?? source.judge_scores).map((item) => {
    const score = isRecord(item) ? item : {};
    return {
      judgeId: readString(score, ['judgeId', 'judge_id', 'id']),
      judgeName: readString(score, ['judgeName', 'judge_name', 'name'], '评委'),
      score: score.score === null ? null : readNumber(score, ['score', 'publishedScore', 'published_score', 'calculatedScore', 'calculated_score'], 0),
    };
  });
  const totalValue = source.totalScore ?? source.total_score ?? source.publishedTotal ?? source.published_total;
  const totalScore = totalValue === null || totalValue === undefined || totalValue === '' ? null : Number(totalValue);
  return {
    entrantName:readString(source,['entrantName']),registrationFee:readNumber(source,['registrationFee'],0),paidAmount:readNumber(source,['paidAmount'],0),paidAt:readString(source,['paidAt']),canPay:Boolean(source.canPay),
    playerId: readString(source, ['playerId', 'player_id', 'id']),
    competitionId: readString(source, ['competitionId', 'competition_id']),
    competitionName: readString(source, ['competitionName', 'competition_name'], '赛事'),
    competitionCode: readString(source, ['competitionCode', 'competition_code']),
    competitionStatus: readString(source, ['competitionStatus', 'competition_status', 'status']),
    startDate: readString(source, ['startDate', 'start_date']).slice(0, 10),
    endDate: readString(source, ['endDate', 'end_date']).slice(0, 10),
    location: readString(source, ['location']),
    coverUrl: readString(source, ['coverUrl', 'cover_url']),
    groupId: readString(source, ['groupId', 'group_id']),
    groupName: readString(source, ['groupName', 'group_name'], '未分组'),
    playerNo: readString(source, ['playerNo', 'player_no']),
    performanceTitle: readString(source, ['performanceTitle', 'performance_title']),
    organization: readString(source, ['organization']),
    teacher: readString(source, ['teacher']),
    auditStatus: readString(source, ['auditStatus', 'audit_status'], 'pending'),
    paidStatus: readString(source, ['paidStatus', 'paid_status'], 'unpaid'),
    scoreStatus: readString(source, ['scoreStatus', 'score_status'], 'not_started'),
    registeredAt: readString(source, ['registeredAt', 'registered_at', 'created_at']),
    resultPublished: Boolean(source.resultPublished ?? source.result_published),
    totalScore: Number.isFinite(totalScore) ? totalScore : null,
    rankNo: readNumber(source, ['rankNo', 'rank_no'], 0),
    awardName: readString(source, ['awardName', 'award_name']),
    publishedAt: readString(source, ['publishedAt', 'published_at']),
    judgeScores,
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
    memberName: readString(source, ['memberName', 'member_name']),
    memberPhone: readString(source, ['memberPhone', 'member_phone']),
    courseId: readString(source, ['courseId', 'course_id']),
    courseName: readString(source, ['courseName', 'course_name'], '未知课程'),
    courseType: readString(source, ['courseType', 'course_type']),
    courseSubType: readString(source, ['courseSubType', 'course_sub_type']),
    courseSessions: readNumber(source, ['courseSessions', 'course_sessions'], 0),
    date: readString(source, ['date']).slice(0, 10),
    paymentMethod: readString(source, ['paymentMethod', 'payment_method', 'payment']),
    sales: readString(source, ['sales', 'courseAdvisor', 'course_advisor']),
    expireDate,
    remainingSessions,
    consumedSessions: readNumber(source, ['consumedSessions', 'consumed_sessions'], 0),
    courseEndDate: readString(source, ['courseEndDate', 'course_end_date']).slice(0, 10),
    todayCheckinCount: readNumber(source, ['todayCheckinCount', 'today_checkin_count'], 0),
    amount: readNumber(source, ['amount'], 0),
    remark: readString(source, ['remark']),
    status,
  };
}

function normalizeConsumeRecord(raw: any): StudentConsumeRecord {
  const source = isRecord(raw) ? raw : {};
  return {
    id: readString(source, ['id', 'consumeId', 'consume_id']),
    paymentId: readString(source, ['paymentId', 'payment_id']),
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

function groupRecentCoursesBySeries(recentRows: any[], publicRows: any[]): any[] {
  const publicById = new Map<string, any>();
  publicRows.filter(isRecord).forEach(row => {
    const id = String(row.id ?? row.series_id ?? row.seriesId ?? '');
    if (id) publicById.set(id, row);
  });

  const grouped = new Map<string, {
    row: Record<string, any>;
    totalProgress: number;
    count: number;
    completed: number;
  }>();

  recentRows.filter(isRecord).forEach((row, index) => {
    const seriesId = readString(row, ['series_id', 'seriesId'], readString(row, ['course_id', 'courseId'], `recent-${index}`));
    const publicRow = publicById.get(seriesId) || {};
    const current = grouped.get(seriesId) || {
      row: {
        ...publicRow,
        id: seriesId,
        series_id: seriesId,
        name: readString(row, ['series_name', 'seriesName'], readString(publicRow, ['name'], readString(row, ['course_name', 'courseName'], '未命名课程'))),
        cover_image: readString(publicRow, ['cover_image', 'coverUrl', 'cover_url', 'image', 'thumbnail'], readString(row, ['cover_image', 'coverUrl', 'cover_url', 'image', 'thumbnail'])),
      },
      totalProgress: 0,
      count: 0,
      completed: 0,
    };
    const percent = clampPercent(readNumber(row, ['progress', 'progressPercent', 'progress_percent']));
    current.totalProgress += percent;
    current.count += 1;
    if (Boolean(row.completed ?? row.isCompleted) || percent >= 95) current.completed += 1;
    grouped.set(seriesId, current);
  });

  return Array.from(grouped.values()).map(item => ({
    ...item.row,
    progress: item.count ? Math.round(item.totalProgress / item.count) : 0,
    lesson_count: readNumber(item.row, ['total_courses', 'lesson_count', 'course_count'], item.count),
    completed_lessons: item.completed,
  }));
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
  storeMemberSnapshot: (member: StudentMember) => setStoredMember(normalizeMember(member)),
  clearAuth,
  saveSession,
  uploadAvatar,
  sendCode: (phone: string, countryCode = '+86') => request('/send-code', { method: 'POST', body: { phone, countryCode } }),
  login: async (phone: string, code: string, countryCode = '+86'): Promise<StudentMember> => {
    const payload = await request('/student-login', { method: 'POST', body: { phone, code, countryCode } });
    const token = extractLoginToken(payload);
    const member = extractLoginMember(payload);
    const saved = saveSession(token, member);
    try {
      const memberParams = { member_id: saved.id };
      const [profilePayload, authorizedRows, paymentRows, publicSeriesRows, recentRows] = await Promise.all([
        request('/member/profile', { params: memberParams }),
        firstSuccessfulList(['/member/authorized-series'], memberParams),
        firstSuccessfulList(['/member/payments'], memberParams),
        firstSuccessfulList(['/public/series']),
        firstSuccessfulList(['/member/recent-courses'], memberParams),
      ]);
      const fullMember = normalizeMember({
        ...unwrapData(profilePayload),
        authorizedCourses: mergeAuthorizedSeries(authorizedRows, publicSeriesRows, recentRows).map(normalizeCourse),
        payments: paymentRows.map(normalizePayment),
      });
      setStoredMember(fullMember);
      saveStudentSession({ token, id: fullMember.id, name: preferredStudentName(fullMember) });
      return fullMember;
    } catch {
      return saved;
    }
  },
  bindPhone: async (phone: string, code: string, countryCode = '+86'): Promise<StudentMember> => {
    try {
      const payload = await request('/member/bind-phone', {
        method: 'POST',
        body: { phone, code, countryCode },
      });
      const login = extractStudentLoginPayload(payload);
      return saveSession(login.token, login.member);
    } catch (error) {
      throw new Error(smsSendErrorMessage(error));
    }
  },
  syncWechatProfile: async (payload: {
    memberId?: string;
    nickname?: string;
    wxName?: string;
    wxAccount?: string;
    avatarUrl?: string;
  }): Promise<StudentMember> => {
    const payloadData = await request('/member/wechat-profile', {
      method: 'POST',
      params: { member_id: payload.memberId },
      body: {
        nickname: payload.nickname,
        wx_name: payload.wxName,
        wx_nickname: payload.wxName || payload.nickname,
        wx_account: payload.wxAccount,
        avatar_url: payload.avatarUrl,
      },
    });
    const updated = normalizeMember(unwrapData(payloadData));
    setStoredMember(updated);
    return updated;
  },
  getMember: async (memberId?: string): Promise<StudentMember> => normalizeMember(unwrapData(await request('/member/profile', { params: { member_id: memberId } }))),
  getRegionOptions: async (memberId?: string): Promise<StudentRegionOptions> => {
    const data = unwrapData(await request('/member/region-options', { params: { member_id: memberId } }));
    return {
      countries: asArray(data?.countries).map(String).filter(Boolean),
      provinces: asArray(data?.provinces).map(String).filter(Boolean),
      citiesByProvince: isRecord(data?.citiesByProvince) ? (data.citiesByProvince as Record<string, string[]>) : {},
    };
  },
  updateMember: async (memberId: string, payload: Partial<StudentMember>): Promise<StudentMember> => {
    const updated = normalizeMember(unwrapData(await request('/member/profile', { method: 'PUT', params: { member_id: memberId }, body: payload })));
    setStoredMember(updated);
    return updated;
  },
  getCertificates: async (memberId: string): Promise<StudentCertificate[]> => {
    const rows = await request('/certificates', { params: { member_id: memberId } });
    return asArray(rows).map(normalizeCertificate);
  },
  getMessages: async (options: {
    type?: string;
    status?: string;
    cursor?: number;
    limit?: number;
  } = {}): Promise<StudentMessagePage> => {
    const payload = await request('/member/messages', { params: options });
    // Preserve the inbox page object. The generic unwrapData helper treats an
    // `items` field as a list envelope, which would discard pagination and
    // unread-count metadata from this endpoint.
    const data = isRecord(payload) && 'data' in payload ? payload.data : payload;
    return {
      items: asArray(data?.items) as StudentMessage[],
      unreadCount: readNumber(data || {}, ['unreadCount', 'unread_count'], 0),
      nextCursor: readNumber(data || {}, ['nextCursor', 'next_cursor'], 0),
      hasMore: Boolean(data?.hasMore ?? data?.has_more),
    };
  },
  getUnreadMessageCount: async (): Promise<number> => {
    const data = unwrapData<any>(await request('/member/messages/unread-count'));
    return readNumber(data || {}, ['unreadCount', 'unread_count', 'count'], 0);
  },
  markMessageRead: async (recipientId: number) => unwrapData(await request(
    `/member/messages/${encodeURIComponent(String(recipientId))}/read`,
    { method: 'POST' },
  )),
  markAllMessagesRead: async () => unwrapData(await request('/member/messages/read-all', { method: 'POST' })),
  getCompetitions: async (memberId: string): Promise<StudentCompetitionEntry[]> => {
    const payload = await request('/member/events', { params: { member_id: memberId } });
    const data = unwrapData(payload);
    const rows = Array.isArray(data) ? data : asArray(data?.entries ?? data?.items ?? data);
    return rows.map(normalizeCompetitionEntry);
  },
  getPayments: async (memberId: string): Promise<StudentPayment[]> => {
    const rows = await request('/member/payments', { params: { member_id: memberId } });
    return asArray(rows).map(normalizePayment);
  },
  getConsumeRecords: async (memberId: string): Promise<StudentConsumeRecord[]> => {
    const rows = await request('/member/consume-records', { params: { member_id: memberId } });
    return asArray(rows).map(normalizeConsumeRecord);
  },
  getOfflineOverview: async (courseIds: number[] = []): Promise<OfflineOverview> => {
    const data = unwrapData(await request('/offline/overview' + (courseIds.length ? '?course_ids=' + courseIds.filter(id => Number.isSafeInteger(id) && id > 0).join(',') : '')));
    return {
      entitlements: asArray(data?.entitlements) as OfflineEntitlement[],
      sessions: asArray(data?.sessions) as OfflineSession[],
      bookings: asArray(data?.bookings) as OfflineBooking[],
      consumes: asArray(data?.consumes),
    };
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
    const recentSeries = groupRecentCoursesBySeries(recentRows, publicSeriesRows);
    // 个人中心必须展示学员的全部有效授权；精选数量限制只能用于推荐列表。
    const courses = (mergedAuthorized.length ? mergedAuthorized : recentSeries).map(normalizeCourse);
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
