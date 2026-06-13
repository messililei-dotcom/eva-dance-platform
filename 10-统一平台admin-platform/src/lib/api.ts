import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, type AxiosRequestConfig } from 'axios';
import { devWarn } from '@/lib/logger';
import type { UnknownRecord } from '@/lib/data-shape';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';
const LEGACY_STUDENT_API_BASE = process.env.NEXT_PUBLIC_LEGACY_STUDENT_API_URL || '/legacy-student-api';
const CLOUD_COURSE_API_BASE = process.env.NEXT_PUBLIC_CLOUD_COURSE_API_URL || API_BASE;
const MEDIA_AUTH_COOKIE = 'admin_media_token';

// Token management
// TODO: 后续优化 - 添加Refresh Token自动续期机制
// 当前的Token在登录时生成，有效期24小时，过期后需要重新登录
// 建议实现：在authApi中检测401后，使用refreshToken()自动获取新Token
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token') || localStorage.getItem('token');
}

export function ensureMediaAuthCookie(): string | null {
  if (typeof window === 'undefined') return null;
  const token = getToken();
  if (!token) return null;
  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${MEDIA_AUTH_COOKIE}=${encodeURIComponent(token)}; Path=/; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}${secure}`;
  return token;
}

function clearMediaAuthCookie(): void {
  if (typeof window === 'undefined') return;
  document.cookie = `${MEDIA_AUTH_COOKIE}=; Path=/; SameSite=Lax; Max-Age=0`;
  document.cookie = `token=; Path=/; SameSite=Lax; Max-Age=0`;
}

function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('admin_token', token);
  localStorage.setItem('token', token);
  ensureMediaAuthCookie();
}

function getLegacyStudentToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('legacy_student_token') || getToken();
}

function setLegacyStudentToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('legacy_student_token', token);
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_refresh_token');
}

type AuthUser = (UnknownRecord & {
  name?: string;
  username?: string;
  role?: string;
}) | null;
type QueryParams = Record<string, string | number | boolean | null | undefined>;

function getUser(): AuthUser {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('admin_user') || localStorage.getItem('userData');
    return raw ? JSON.parse(raw) as NonNullable<AuthUser> : null;
  } catch {
    return null;
  }
}

function setUser(user: unknown): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('admin_user', JSON.stringify(user));
  localStorage.setItem('userData', JSON.stringify(user));
}

function setRefreshToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('admin_refresh_token', token);
}

function clearAuth(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_refresh_token');
  localStorage.removeItem('admin_user');
  localStorage.removeItem('token');
  localStorage.removeItem('userData');
  localStorage.removeItem('legacy_student_token');
  clearMediaAuthCookie();
}

// Axios instance
export const api: AxiosInstance = axios.create({ baseURL: API_BASE, timeout: 15000 });
const legacyStudentApi: AxiosInstance = axios.create({ baseURL: LEGACY_STUDENT_API_BASE, timeout: 20000 });
const cloudCourseApi: AxiosInstance = axios.create({ baseURL: CLOUD_COURSE_API_BASE, timeout: 20000 });

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

legacyStudentApi.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getLegacyStudentToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

cloudCourseApi.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken();
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    if (error.response?.status === 401) {
      clearAuth();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

legacyStudentApi.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('legacy_student_token');
      }
    }
    return Promise.reject(error);
  }
);

// Auth API — 对接学员管理系统真实API
// 学员系统路由: POST /api/login, POST /api/validate-token, POST /api/logout
export const authApi = {
  login: async (username: string, password: string): Promise<AuthUser> => {
    const res = await api.post('/login', { username, password });
    const { token, user } = res.data;
    setToken(token);
    setUser(user);
    legacyStudentApi.post('/login', { username, password })
      .then((legacyRes) => {
        if (legacyRes.data?.token) setLegacyStudentToken(legacyRes.data.token);
      })
      .catch((err) => {
        devWarn('原学员系统登录失败，线下课程真实数据可能不可用', err);
      });
    return user;
  },
  logout: async (): Promise<void> => {
    try { await api.post('/logout'); } catch {}
    clearAuth();
  },
  validateToken: async (): Promise<UnknownRecord> => {
    ensureMediaAuthCookie();
    const res = await api.post('/validate-token');
    return res.data;
  },
  getUser,
  getToken,
  ensureMediaAuthCookie,
  clearAuth,
};

// ========== 教育业务 API ==========
export const eduApi = {
  // 学员详情
  getMemberDetails: async (id: number): Promise<any> => {
    const res = await api.get(`/members/${id}/details`);
    return res.data;
  },
  // 学员进度列表（姓名/电话/缴费/剩余课次/视频完成数）
  getStudentProgress: async (): Promise<any[]> => {
    const res = await api.get('/students/progress');
    return res.data;
  },
  // 统计摘要
  getDashboardStats: async (): Promise<any> => {
    const res = await api.get('/dashboard/stats');
    return res.data;
  },
  // 财务摘要
  getFinanceSummary: async (): Promise<any> => {
    const res = await axios.get('/local-api/finance/summary', { headers: { Authorization: `Bearer ${getToken() || ''}` } });
    return res.data;
  },
  getFinanceExpenses: async (): Promise<any[]> => {
    const res = await axios.get('/local-api/finance/expenses', { headers: { Authorization: `Bearer ${getToken() || ''}` } });
    return res.data;
  },
  createFinanceExpense: async (data: unknown): Promise<any> => {
    const res = await axios.post('/local-api/finance/expenses', data, { headers: { Authorization: `Bearer ${getToken() || ''}` } });
    return res.data;
  },
};

// ========== 证书 API ==========
export const certApi = {
  list: async (): Promise<any[]> => {
    const res = await api.get('/certificates');
    return res.data;
  },
  stats: async (): Promise<any> => {
    const res = await api.get('/certificates/stats');
    return res.data;
  },
  issue: async (memberId: number, seriesId: number): Promise<any> => {
    const res = await api.post('/certificates', { member_id: memberId, series_id: seriesId });
    return res.data;
  },
  revoke: async (id: number): Promise<any> => {
    const res = await api.delete(`/certificates?id=${id}`);
    return res.data;
  },
  autoIssue: async (): Promise<any> => {
    const res = await api.post('/certificates/auto-issue');
    return res.data;
  },
  getTemplate: async (seriesId: number): Promise<any> => {
    const res = await api.get(`/certificates/templates/${seriesId}`);
    return res.data;
  },
  saveTemplate: async (seriesId: number, data: unknown): Promise<any> => {
    const res = await api.put(`/certificates/templates/${seriesId}`, data);
    return res.data;
  },
  generateTemplate: async (seriesId: number): Promise<any> => {
    const res = await api.post(`/certificates/templates/${seriesId}`);
    return res.data;
  },
};

// ========== 赛事运营 API ==========
export const eventApi = {
  listCompetitions: async (params?: QueryParams): Promise<any[]> => {
    const res = await api.get('/event/competitions', { params });
    return res.data?.data || [];
  },
  getCompetition: async (id: number | string): Promise<any> => {
    const res = await api.get(`/event/competitions/${id}`);
    return res.data?.data;
  },
  createCompetition: async (payload: any): Promise<any> => {
    const res = await api.post('/event/competitions', payload);
    return res.data?.data;
  },
  updateCompetition: async (id: number | string, payload: any): Promise<any> => {
    const res = await api.put(`/event/competitions/${id}`, payload);
    return res.data;
  },
  patchCompetition: async (id: number | string, payload: any): Promise<any> => {
    const res = await api.patch(`/event/competitions/${id}`, payload);
    return res.data;
  },
  listGroups: async (params: QueryParams): Promise<any[]> => {
    const res = await api.get('/event/groups', { params });
    return res.data?.data || [];
  },
  createGroup: async (payload: any): Promise<any> => {
    const res = await api.post('/event/groups', payload);
    return res.data?.data;
  },
  importGroups: async (payload: any): Promise<any> => {
    const res = await api.post('/event/groups/import', payload);
    return res.data?.data;
  },
  updateGroup: async (id: number | string, payload: any): Promise<any> => {
    const res = await api.put(`/event/groups/${id}`, payload);
    return res.data;
  },
  patchGroup: async (id: number | string, payload: any): Promise<any> => {
    const res = await api.patch(`/event/groups/${id}`, payload);
    return res.data;
  },
  listPlayers: async (params?: QueryParams): Promise<any[]> => {
    const res = await api.get('/event/players', { params });
    return res.data?.data || [];
  },
  getPlayer: async (id: number | string): Promise<any> => {
    const res = await api.get(`/event/players/${id}`);
    return res.data?.data;
  },
  createPlayer: async (payload: any): Promise<any> => {
    const res = await api.post('/event/players', payload);
    return res.data?.data;
  },
  updatePlayer: async (id: number | string, payload: any): Promise<any> => {
    const res = await api.put(`/event/players/${id}`, payload);
    return res.data;
  },
  auditPlayer: async (id: number | string, auditStatus: string): Promise<any> => {
    const res = await api.patch(`/event/players/${id}`, { auditStatus });
    return res.data;
  },
  listJudges: async (params?: QueryParams): Promise<any[]> => {
    const res = await api.get('/event/judges', { params });
    return res.data?.data || [];
  },
  getJudge: async (id: number | string): Promise<any> => {
    const res = await api.get(`/event/judges/${id}`);
    return res.data?.data;
  },
  createJudge: async (payload: any): Promise<any> => {
    const res = await api.post('/event/judges', payload);
    return res.data?.data;
  },
  updateJudge: async (id: number | string, payload: any): Promise<any> => {
    const res = await api.put(`/event/judges/${id}`, payload);
    return res.data;
  },
  patchJudge: async (id: number | string, payload: any): Promise<any> => {
    const res = await api.patch(`/event/judges/${id}`, payload);
    return res.data;
  },
  assignJudge: async (payload: any): Promise<any> => {
    const res = await api.post('/event/group-judges', payload);
    return res.data;
  },
  listScoreRules: async (params?: QueryParams): Promise<any[]> => {
    const res = await api.get('/event/score-rules', { params });
    return res.data?.data || [];
  },
  createScoreRule: async (payload: any): Promise<any> => {
    const res = await api.post('/event/score-rules', payload);
    return res.data?.data;
  },
  listScores: async (params?: QueryParams): Promise<any[]> => {
    const res = await api.get('/event/scores', { params });
    return res.data?.data || [];
  },
  submitScore: async (payload: any): Promise<any> => {
    const res = await api.post('/event/scores', payload);
    return res.data?.data;
  },
  getResults: async (params?: QueryParams): Promise<any> => {
    const res = await api.get('/event/results', { params });
    return res.data?.data || { rankings: [], logs: [] };
  },
  recalculateResults: async (groupId: number | string): Promise<any> => {
    const res = await api.post('/event/results', { groupId });
    return res.data?.data;
  },
  publishResults: async (groupId: number | string): Promise<any> => {
    const res = await api.patch('/event/results', { groupId, action: 'publish' });
    return res.data;
  },
  unpublishResults: async (groupId: number | string): Promise<any> => {
    const res = await api.patch('/event/results', { groupId, action: 'unpublish' });
    return res.data;
  },
  verifyData: async (): Promise<any> => {
    const res = await api.get('/event/verify');
    return res.data?.data;
  },
};

// ========== 综合数据 API（完整学员数据聚合） ==========
export const dataApi = {
  // 学员360°视图
  getMemberProfile: async (id: number): Promise<any> => {
    const res = await api.get(`/members/${id}/profile360`);
    return res.data;
  },
  // 订单列表
  getOrders: async (params?: QueryParams): Promise<any[]> => {
    const res = await api.get('/orders', { params });
    return res.data;
  },
  // 统一订单
  getUnifiedOrders: async (params?: QueryParams): Promise<any[]> => {
    const res = await api.get('/orders/unified', { params });
    return res.data;
  },
  // 库存汇总
  getShopSummary: async (): Promise<any> => {
    const res = await api.get('/shop/summary');
    return res.data;
  },
};

// ========== 线下培训 API ==========
export const trainingApi = {
  getCourses: async (): Promise<any[]> => {
    const res = await api.get('/courses');
    return res.data;
  },
  createCourse: async (data: unknown): Promise<any> => {
    const res = await api.post('/courses', data);
    return res.data;
  },
  updateCourse: async (id: number | string, data: unknown): Promise<any> => {
    const res = await api.put(`/courses/${id}`, data);
    return res.data;
  },
  deleteCourse: async (id: number | string): Promise<any> => {
    const res = await api.delete(`/courses/${id}`);
    return res.data;
  },
  uploadAttendanceSheet: async (id: number | string, sheet: unknown): Promise<any> => {
    const res = await api.post(`/courses/${id}/attendance-sheet`, { sheet });
    return res.data;
  },
  uploadCourseCover: async (data: FormData): Promise<any> => {
    const res = await api.post('/courses/cover', data, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data;
  },
  getCourseCertificates: async (id: number | string): Promise<any> => {
    const res = await api.get(`/courses/${id}/certificates`);
    return res.data;
  },
  issueCourseCertificates: async (id: number | string, data: unknown): Promise<any> => {
    const res = await api.post(`/courses/${id}/certificates`, data);
    return res.data;
  },
  getPayments: async (): Promise<any[]> => {
    const res = await api.get('/payments');
    return res.data;
  },
  createPayment: async (data: unknown): Promise<any> => {
    const res = await api.post('/payments', data);
    return res.data;
  },
  updatePayment: async (id: number | string, data: unknown): Promise<any> => {
    const res = await api.put(`/payments/${id}`, data);
    return res.data;
  },
  uploadPaymentVoucher: async (formData: FormData): Promise<any> => {
    const res = await api.post('/payments/voucher', formData);
    return res.data;
  },
  deletePayment: async (id: number | string): Promise<any> => {
    const res = await api.delete(`/payments/${id}`);
    return res.data;
  },
  getConsumeRecords: async (): Promise<any[]> => {
    const res = await api.get('/consume-records');
    return res.data;
  },
  createConsumeRecord: async (data: unknown): Promise<any> => {
    const res = await api.post('/consume-records', data);
    return res.data;
  },
  updateConsumeRecord: async (id: number | string, data: unknown): Promise<any> => {
    const res = await api.put(`/consume-records/${id}`, data);
    return res.data;
  },
  deleteConsumeRecord: async (id: number | string): Promise<any> => {
    const res = await api.delete(`/consume-records/${id}`);
    return res.data;
  },
};

// ========== 网课系统 API ==========
export const onlineCourseApi = {
  getDashboard: async (): Promise<any> => {
    const res = await api.get('/course/admin/dashboard');
    return res.data;
  },
  getMiniProgramConfig: async (): Promise<any> => {
    const res = await api.get('/mini/admin/miniprogram-config');
    return res.data;
  },
  getAnalyticsOverview: async (): Promise<any> => {
    const res = await api.get('/course/admin/analytics/overview');
    return res.data;
  },
  getSeries: async (params?: QueryParams): Promise<any> => {
    const res = await api.get('/course/series', { params });
    return res.data;
  },
  getSeriesDetail: async (id: number | string): Promise<any> => {
    const res = await api.get(`/course/series/${id}`);
    return res.data;
  },
  createSeries: async (data: unknown): Promise<any> => {
    const res = await api.post('/course/series', data);
    return res.data;
  },
  updateSeries: async (id: number | string, data: unknown): Promise<any> => {
    const res = await api.put(`/course/series/${id}`, data);
    return res.data;
  },
  uploadSeriesCover: async (data: FormData): Promise<any> => {
    const res = await api.post('/course/series/cover', data, { headers: { 'Content-Type': 'multipart/form-data' } });
    return res.data;
  },
  deleteSeries: async (id: number | string): Promise<any> => {
    const res = await api.delete(`/course/series/${id}`);
    return res.data;
  },
  getSeriesCourses: async (id: number | string): Promise<any> => {
    const res = await api.get(`/course/series/${id}/courses`);
    return res.data;
  },
  reorderSeriesCourses: async (id: number | string, data: unknown): Promise<any> => {
    const res = await api.post(`/course/series/${id}/courses/reorder`, data);
    return res.data;
  },
  createCourse: async (data: unknown): Promise<any> => {
    const res = await api.post('/course/courses', data);
    return res.data;
  },
  updateCourse: async (id: number | string, data: unknown): Promise<any> => {
    const res = await api.put(`/course/courses/${id}`, data);
    return res.data;
  },
  deleteCourse: async (id: number | string): Promise<any> => {
    const res = await api.delete(`/course/courses/${id}`);
    return res.data;
  },
  batchCreateCourses: async (data: unknown): Promise<any> => {
    const res = await api.post('/course/courses/batch-create', data);
    return res.data;
  },
  batchUpdateCourseStatus: async (data: unknown): Promise<any> => {
    const res = await api.post('/course/courses/batch-status', data);
    return res.data;
  },
  batchDeleteCourses: async (data: unknown): Promise<any> => {
    const res = await api.post('/course/courses/batch-delete', data);
    return res.data;
  },
  getCourseMaterials: async (courseId: number | string): Promise<any> => {
    const res = await api.get(`/course/courses/${courseId}/materials`);
    return res.data;
  },
  addCourseMaterial: async (courseId: number | string, data: unknown): Promise<any> => {
    const res = await api.post(`/course/courses/${courseId}/materials`, data);
    return res.data;
  },
  removeCourseMaterial: async (courseId: number | string, assocId: number | string): Promise<any> => {
    const res = await api.delete(`/course/courses/${courseId}/materials/${assocId}`);
    return res.data;
  },
  getOrders: async (params?: QueryParams): Promise<any> => {
    const res = await api.get('/course/orders', { params });
    return res.data;
  },
  createOrder: async (data: unknown): Promise<any> => {
    const res = await api.post('/course/orders/create', data);
    return res.data;
  },
  payOrder: async (id: number | string, data?: unknown): Promise<any> => {
    const res = await api.post(`/course/orders/${id}/pay`, data || {});
    return res.data;
  },
  getSeriesStudents: async (id: number | string, params?: QueryParams): Promise<any> => {
    const res = await api.get(`/course/series/${id}/students`, { params });
    return res.data;
  },
  authorizeMember: async (seriesId: number | string, data: unknown): Promise<any> => {
    const res = await api.post(`/course/series/${seriesId}/authorize`, data);
    return res.data;
  },
  authorizePhone: async (seriesId: number | string, data: unknown): Promise<any> => {
    const res = await api.post(`/course/series/${seriesId}/authorize-phone`, data);
    return res.data;
  },
  deauthorizeMember: async (seriesId: number | string, data: unknown): Promise<any> => {
    const res = await api.post(`/course/series/${seriesId}/deauthorize`, data);
    return res.data;
  },
  batchAuthorizeMembers: async (seriesId: number | string, data: unknown): Promise<any> => {
    const res = await api.post(`/course/series/${seriesId}/batch-authorize`, data);
    return res.data;
  },
  batchDeauthorizeMembers: async (seriesId: number | string, data: unknown): Promise<any> => {
    const res = await api.post(`/course/series/${seriesId}/batch-deauthorize`, data);
    return res.data;
  },
  getMaterialFolders: async (): Promise<any> => {
    const res = await api.get('/course/material-folders');
    return res.data;
  },
  createMaterialFolder: async (data: unknown): Promise<any> => {
    const res = await api.post('/course/material-folders', data);
    return res.data;
  },
  updateMaterialFolder: async (id: number | string, data: unknown): Promise<any> => {
    const res = await api.put(`/course/material-folders/${id}`, data);
    return res.data;
  },
  deleteMaterialFolder: async (id: number | string): Promise<any> => {
    const res = await api.delete(`/course/material-folders/${id}`);
    return res.data;
  },
  getMaterials: async (params?: QueryParams): Promise<any> => {
    const res = await api.get('/course/materials', { params });
    return res.data;
  },
  getMaterialStorage: async (): Promise<any> => {
    const res = await api.get('/course/materials/storage');
    return res.data;
  },
  createMaterial: async (data: unknown): Promise<any> => {
    const res = await api.post('/course/materials/upload', data);
    return res.data;
  },
  uploadLocalMaterials: async (data: FormData, config?: AxiosRequestConfig): Promise<any> => {
    const res = await axios.post('/api/course/materials/upload-local', data, {
      ...config,
      headers: { ...config?.headers, Authorization: `Bearer ${getToken() || ''}` },
    });
    if (res.data && typeof res.data === 'object' && res.data.success === false) {
      throw new Error(res.data.message || '上传失败');
    }
    return res.data;
  },
  updateMaterial: async (id: number | string, data: unknown): Promise<any> => {
    const res = await api.put(`/course/materials/${id}`, data);
    return res.data;
  },
  deleteMaterial: async (id: number | string): Promise<any> => {
    const res = await api.delete(`/course/materials/${id}`);
    return res.data;
  },
  batchMoveMaterials: async (data: unknown): Promise<any> => {
    const res = await api.post('/course/materials/batch-move', data);
    return res.data;
  },
  batchDeleteMaterials: async (data: unknown): Promise<any> => {
    const res = await api.post('/course/materials/batch-delete', data);
    return res.data;
  },
  getMaterialReferences: async (id: number | string): Promise<any> => {
    const res = await api.get(`/course/materials/${id}/references`);
    return res.data;
  },
  removeMaterialReference: async (materialId: number | string, referenceId: number | string): Promise<any> => {
    const res = await api.delete(`/course/materials/${materialId}/references/${referenceId}`);
    return res.data;
  },
  generateMaterialThumbnail: async (id: number | string, data: unknown): Promise<any> => {
    const res = await api.post(`/course/materials/${id}/thumbnail`, data);
    return res.data;
  },
  getCommissions: async (params?: QueryParams): Promise<any> => {
    const res = await api.get('/course/distribution/commissions', { params });
    return res.data;
  },
  withdrawCommission: async (data: unknown): Promise<any> => {
    const res = await api.post('/course/distribution/withdraw', data);
    return res.data;
  },
};

// ========== 电商管理 API（已整合到学员系统 /api/ecommerce/*） ==========
export const ecommerceApi = {
  // 商品列表
  getProducts: async (): Promise<any[]> => {
    const res = await axios.get('/local-api/ecommerce/products', { headers: { Authorization: `Bearer ${getToken() || ''}` } });
    return res.data;
  },
  // 创建商品
  createProduct: async (data: unknown): Promise<any> => {
    const res = await axios.post('/local-api/ecommerce/products', data, { headers: { Authorization: `Bearer ${getToken() || ''}` } });
    return res.data;
  },
  // 更新商品
  updateProduct: async (id: number | string, data: unknown): Promise<any> => {
    const res = await axios.put(`/local-api/ecommerce/products/${id}`, data, { headers: { Authorization: `Bearer ${getToken() || ''}` } });
    return res.data;
  },
  // 删除商品
  deleteProduct: async (id: number | string): Promise<any> => {
    const res = await axios.delete(`/local-api/ecommerce/products/${id}`, { headers: { Authorization: `Bearer ${getToken() || ''}` } });
    return res.data;
  },
  // 入库
  stockIn: async (data: unknown): Promise<any> => {
    const res = await axios.post('/local-api/ecommerce/stock-in', data, { headers: { Authorization: `Bearer ${getToken() || ''}` } });
    return res.data;
  },
  // 销售记录
  getSales: async (): Promise<any[]> => {
    const res = await axios.get('/local-api/ecommerce/sales', { headers: { Authorization: `Bearer ${getToken() || ''}` } });
    return res.data;
  },
  // 创建销售
  createSale: async (data: unknown): Promise<any> => {
    const res = await axios.post('/local-api/ecommerce/sales', data, { headers: { Authorization: `Bearer ${getToken() || ''}` } });
    return res.data;
  },
  updateSale: async (id: number | string, data: unknown): Promise<any> => {
    const res = await axios.put(`/local-api/ecommerce/sales/${id}`, data, { headers: { Authorization: `Bearer ${getToken() || ''}` } });
    return res.data;
  },
  deleteSale: async (id: number | string): Promise<any> => {
    const res = await axios.delete(`/local-api/ecommerce/sales/${id}`, { headers: { Authorization: `Bearer ${getToken() || ''}` } });
    return res.data;
  },
  // 库存日志
  getStockLogs: async (): Promise<any[]> => {
    const res = await axios.get('/local-api/ecommerce/stock-logs', { headers: { Authorization: `Bearer ${getToken() || ''}` } });
    return res.data;
  },
  updateStockLog: async (id: number | string, data: unknown): Promise<any> => {
    const res = await axios.put(`/local-api/ecommerce/stock-logs/${id}`, data, { headers: { Authorization: `Bearer ${getToken() || ''}` } });
    return res.data;
  },
  deleteStockLog: async (id: number | string): Promise<any> => {
    const res = await axios.delete(`/local-api/ecommerce/stock-logs/${id}`, { headers: { Authorization: `Bearer ${getToken() || ''}` } });
    return res.data;
  },
  // 电商摘要
  getSummary: async (): Promise<any> => {
    const res = await api.get('/ecommerce/summary');
    return res.data;
  },
};

export default api;
