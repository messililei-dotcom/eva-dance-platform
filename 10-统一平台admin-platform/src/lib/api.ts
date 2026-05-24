import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

// Token management
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

function setToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('admin_token', token);
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_refresh_token');
}

function getUser(): any {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('admin_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setUser(user: any): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('admin_user', JSON.stringify(user));
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
}

// Axios instance
const api: AxiosInstance = axios.create({ baseURL: API_BASE, timeout: 15000 });

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
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

// Auth API — 对接学员管理系统真实API
// 学员系统路由: POST /api/login, POST /api/validate-token, POST /api/logout
export const authApi = {
  login: async (username: string, password: string): Promise<any> => {
    const res = await api.post('/login', { username, password });
    const { token, user } = res.data;
    setToken(token);
    setUser(user);
    return user;
  },
  logout: async (): Promise<void> => {
    try { await api.post('/logout'); } catch {}
    clearAuth();
  },
  validateToken: async (): Promise<any> => {
    const res = await api.post('/validate-token');
    return res.data;
  },
  getUser,
  getToken,
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
    const res = await api.get('/finance/summary');
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
};

// ========== 综合数据 API（完整学员数据聚合） ==========
export const dataApi = {
  // 学员360°视图
  getMemberProfile: async (id: number): Promise<any> => {
    const res = await api.get(`/members/${id}/profile360`);
    return res.data;
  },
  // 订单列表
  getOrders: async (params?: any): Promise<any[]> => {
    const res = await api.get('/orders', { params });
    return res.data;
  },
  // 统一订单
  getUnifiedOrders: async (params?: any): Promise<any[]> => {
    const res = await api.get('/orders/unified', { params });
    return res.data;
  },
  // 库存汇总
  getShopSummary: async (): Promise<any> => {
    const res = await api.get('/shop/summary');
    return res.data;
  },
};

// ========== 电商管理 API（已整合到学员系统 /api/ecommerce/*） ==========
export const ecommerceApi = {
  // 商品列表
  getProducts: async (): Promise<any[]> => {
    const res = await api.get('/ecommerce/products');
    return res.data;
  },
  // 创建商品
  createProduct: async (data: any): Promise<any> => {
    const res = await api.post('/ecommerce/products', data);
    return res.data;
  },
  // 更新商品
  updateProduct: async (id: number, data: any): Promise<any> => {
    const res = await api.put(`/ecommerce/products/${id}`, data);
    return res.data;
  },
  // 删除商品
  deleteProduct: async (id: number): Promise<any> => {
    const res = await api.delete(`/ecommerce/products/${id}`);
    return res.data;
  },
  // 入库
  stockIn: async (data: any): Promise<any> => {
    const res = await api.post('/ecommerce/stock-in', data);
    return res.data;
  },
  // 销售记录
  getSales: async (): Promise<any[]> => {
    const res = await api.get('/ecommerce/sales');
    return res.data;
  },
  // 创建销售
  createSale: async (data: any): Promise<any> => {
    const res = await api.post('/ecommerce/sales', data);
    return res.data;
  },
  // 库存日志
  getStockLogs: async (): Promise<any[]> => {
    const res = await api.get('/ecommerce/stock-logs');
    return res.data;
  },
  // 电商摘要
  getSummary: async (): Promise<any> => {
    const res = await api.get('/ecommerce/summary');
    return res.data;
  },
};

export default api;
