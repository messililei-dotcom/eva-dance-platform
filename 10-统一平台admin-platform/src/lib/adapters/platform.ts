import api from '@/lib/api';
import { isRecord, pickArray, pickData } from '@/lib/data-shape';
import { platformLinkMatrix, platformLinks } from '@/lib/platform-links';
import type {
  Course,
  DataAnalytics,
  DashboardData,
  EcommerceSummary,
  FinanceSummary,
  Member,
  MemberProfile360,
  PermissionUser,
  PlatformSettings,
  Product,
  UnifiedOrder,
} from '@/types/domain';

function asArray<T = unknown>(payload: unknown): T[] {
  return pickArray<T>(pickData(payload, payload));
}

function numberValue(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function textValue(value: unknown, fallback = '-'): string {
  if (value === null || value === undefined || value === '') return fallback;
  return String(value);
}

function normalizeStatus(status: unknown): string {
  const value = textValue(status, 'unknown');
  const map: Record<string, string> = {
    已支付: 'paid',
    已完成: 'completed',
    待付款: 'pending',
    待支付: 'pending',
    已关闭: 'closed',
    已退款: 'refunded',
  };
  return map[value] || value;
}

export function adaptMember(raw: any, index = 0): Member {
  return {
    id: textValue(raw?.id ?? raw?.memberId ?? index),
    name: textValue(raw?.name ?? raw?.memberName, '未知学员'),
    phone: textValue(raw?.phone ?? raw?.memberPhone, ''),
    level: textValue(raw?.level ?? raw?.memberLevel, '普通学员'),
    status: textValue(raw?.status, 'active'),
    city: textValue(raw?.city ?? raw?.province ?? raw?.foreignRegion, '-'),
    country: textValue(raw?.country, '中国'),
    registerDate: textValue(raw?.register_date ?? raw?.registerDate ?? raw?.created_at ?? raw?.createdAt, '-').slice(0, 10),
    totalSpent: numberValue(raw?.totalSpent ?? raw?.totalAmount ?? raw?.amount),
    courseCount: numberValue(raw?.courseCount ?? raw?.courses),
    growth: numberValue(raw?.growth ?? raw?.growthValue),
    lastActiveAt: textValue(raw?.updated_at ?? raw?.updatedAt ?? raw?.lastLogin ?? raw?.register_date, '-').slice(0, 16),
    avatar: textValue(raw?.avatar ?? raw?.avatarUrl ?? raw?.avatar_url, ''),
    wxAvatarUrl: textValue(raw?.wx_avatar_url ?? raw?.wxAvatarUrl, ''),
    wxName: textValue(raw?.wx_name ?? raw?.wxName, ''),
    wxNickname: textValue(raw?.wx_nickname ?? raw?.wxNickname, ''),
    wxAccount: textValue(raw?.wx_account ?? raw?.wxAccount, ''),
    wxOpenid: textValue(raw?.wx_openid ?? raw?.wxOpenid, ''),
    wxUnionid: textValue(raw?.wx_unionid ?? raw?.wxUnionid, ''),
    raw,
  };
}

export function adaptOrder(raw: any, index = 0): UnifiedOrder {
  return {
    id: textValue(raw?.id ?? raw?.orderId ?? index),
    orderNo: textValue(raw?.orderNo ?? raw?.order_no ?? raw?.paymentNo ?? raw?.id, `ORDER-${index + 1}`),
    orderDate: textValue(raw?.orderDate ?? raw?.date ?? raw?.created_at ?? raw?.createdAt, '-').slice(0, 10),
    memberName: textValue(raw?.memberName ?? raw?.buyerName ?? raw?.name, '-'),
    memberPhone: textValue(raw?.memberPhone ?? raw?.buyerPhone ?? raw?.phone, ''),
    orderType: textValue(raw?.orderType ?? raw?.type ?? 'training'),
    title: textValue(raw?.title ?? raw?.courseName ?? raw?.productName ?? raw?.remark, '-'),
    amount: numberValue(raw?.amount ?? raw?.totalAmount ?? raw?.paidAmount),
    status: normalizeStatus(raw?.status ?? raw?.payStatus),
    sourceType: textValue(raw?.sourceType ?? raw?.source_type ?? 'legacy'),
    payMethod: textValue(raw?.payMethod ?? raw?.payment ?? raw?.paymentMethod, '-'),
    raw,
  };
}

export function adaptProduct(raw: any, index = 0): Product {
  return {
    id: textValue(raw?.id ?? index),
    sourceId: textValue(raw?.sourceId ?? raw?.source_id ?? raw?.id, ''),
    sourceType: textValue(raw?.sourceType ?? raw?.source_type ?? 'main-db'),
    name: textValue(raw?.name ?? raw?.title, '未命名商品'),
    category: textValue(raw?.category, '-'),
    status: textValue(raw?.status, 'active'),
    skuCount: numberValue(raw?.skuCount ?? raw?.sku_count),
    stock: numberValue(raw?.stock ?? raw?.quantity),
    minSalePrice: numberValue(raw?.minSalePrice ?? raw?.price ?? raw?.sale_price),
    maxSalePrice: numberValue(raw?.maxSalePrice ?? raw?.price ?? raw?.sale_price),
    lowStockSkuCount: numberValue(raw?.lowStockSkuCount ?? raw?.low_stock_sku_count),
    updatedAt: textValue(raw?.updatedAt ?? raw?.updated_at, '-').slice(0, 16),
    raw,
  };
}

export function adaptOfflineCourse(raw: any, index = 0): Course {
  const capacity = numberValue(raw?.capacity);
  const remaining = raw?.remaining === null || raw?.remaining === undefined ? 0 : numberValue(raw.remaining);
  return {
    id: textValue(raw?.id ?? index),
    name: textValue(raw?.name, '未命名课程'),
    type: 'offline',
    category: textValue(raw?.type ?? raw?.category, '线下课程'),
    teacher: textValue(raw?.teacher ?? raw?.teacherName, '-'),
    price: numberValue(raw?.price),
    sessions: numberValue(raw?.sessions ?? raw?.lessonCount),
    students: numberValue(raw?.students ?? raw?.studentCount ?? (capacity ? Math.max(capacity - remaining, 0) : 0)),
    capacity,
    status: textValue(raw?.status, 'active'),
    startDate: textValue(raw?.startDate ?? raw?.start_date, '-').slice(0, 10),
    level: textValue(raw?.level ?? raw?.subType, '全级别'),
    raw,
  };
}

export function adaptOnlineCourse(raw: any, index = 0): Course {
  return {
    id: textValue(raw?.id ?? index),
    name: textValue(raw?.name ?? raw?.title, '未命名课程'),
    type: 'online',
    category: textValue(raw?.category, '线上课程'),
    teacher: textValue(raw?.teacher, '-'),
    price: numberValue(raw?.price ?? raw?.promo_price),
    sessions: numberValue(raw?.total_courses ?? raw?.courseCount ?? raw?.lessonCount),
    students: numberValue(raw?.total_students ?? raw?.studentCount),
    capacity: 0,
    status: textValue(raw?.status, 'draft'),
    startDate: textValue(raw?.created_at ?? raw?.createdAt, '-').slice(0, 10),
    level: textValue(raw?.level, '全级别'),
    raw,
  };
}

const permissionLabels: Record<string, string> = {
  permCourseView: '查看课程',
  permCourseCreate: '创建课程',
  permCourseEdit: '编辑课程',
  permCourseDelete: '删除课程',
  permMemberView: '查看学员',
  permMemberCreate: '新增学员',
  permMemberEdit: '编辑学员',
  permMemberDelete: '删除学员',
  permTeacherView: '查看老师',
  permTeacherCreate: '新增老师',
  permTeacherEdit: '编辑老师',
  permTeacherDelete: '删除老师',
  permPaymentView: '查看缴费',
  permPaymentCreate: '新增缴费',
  permPaymentEdit: '编辑缴费',
  permPaymentDelete: '删除缴费',
  permConsumeView: '查看核销',
  permConsumeCreate: '新增核销',
  permConsumeEdit: '编辑核销',
  permConsumeDelete: '删除核销',
  permOnlineAuthView: '查看线上课授权',
  permOnlineAuthCreate: '新增线上课授权',
  permOnlineAuthCancel: '取消线上课授权',
  permOnlineAuthPhone: '手机号预授权',
  permLogView: '查看日志',
};

const PERM_FIELDS = [
  'permCourseView', 'permCourseCreate', 'permCourseEdit', 'permCourseDelete',
  'permMemberView', 'permMemberCreate', 'permMemberEdit', 'permMemberDelete',
  'permTeacherView', 'permTeacherCreate', 'permTeacherEdit', 'permTeacherDelete',
  'permPaymentView', 'permPaymentCreate', 'permPaymentEdit', 'permPaymentDelete',
  'permConsumeView', 'permConsumeCreate', 'permConsumeEdit', 'permConsumeDelete',
  'permOnlineAuthView', 'permOnlineAuthCreate', 'permOnlineAuthCancel', 'permOnlineAuthPhone',
  'permLogView',
  'bonusTraining', 'bonusCard', 'bonusYearly', 'bonusDisciple',
];

export function adaptPermissionUser(raw: any, index = 0): PermissionUser {
  const permissionNames = Object.keys(permissionLabels)
    .filter(key => raw?.[key])
    .map(key => permissionLabels[key]);

  // 提取所有权限字段
  const permValues: Record<string, any> = {};
  for (const field of PERM_FIELDS) {
    if (raw?.[field] !== undefined) {
      permValues[field] = raw[field];
    }
  }

  return {
    id: textValue(raw?.id ?? index),
    username: textValue(raw?.username, '-'),
    name: textValue(raw?.name ?? raw?.username, '-'),
    role: textValue(raw?.role, 'user'),
    status: textValue(raw?.status, 'active'),
    permissionCount: permissionNames.length,
    permissions: permissionNames,
    ...permValues,
    raw,
  };
}

export const platformAdapter = {
  async getMembers(): Promise<Member[]> {
    const res = await api.get('/members');
    return asArray(res.data).map(adaptMember);
  },

  async getMemberDirectory(): Promise<{ members: Member[]; orderRevenue: number }> {
    const res = await api.get('/members/directory');
    const data = pickData<any>(res.data, res.data || {});
    return {
      members: asArray(data?.members).map(adaptMember),
      orderRevenue: numberValue(data?.summary?.orderRevenue),
    };
  },

  async getMemberProfile(id: number | string): Promise<MemberProfile360> {
    const res = await api.get(`/members/${id}/profile360`);
    return pickData<MemberProfile360>(res.data, {
      member: {},
      summary: {
        offlineIncome: 0,
        onlineIncome: 0,
        totalIncome: 0,
        consumeCount: 0,
        authorizationCount: 0,
        completedVideoCount: 0,
        financeIncome: 0,
        financeOrderAmount: 0,
      },
      offlinePayments: [],
      consumeRecords: [],
      courseOrders: [],
      authorizations: [],
      progress: [],
      financeIncomes: [],
      financeOrders: [],
      operationLogs: [],
    });
  },

  async getMemberRecord(id: number | string): Promise<Member> {
    const res = await api.get(`/members/${id}`);
    return adaptMember(pickData<any>(res.data, {}));
  },

  async getRegions(): Promise<Array<{ province: string; cities: string[] }>> {
    const res = await api.get('/provinces');
    return asArray(res.data).map((item: any) => ({
      province: textValue(item?.province, ''),
      cities: Array.isArray(item?.cities) ? item.cities.map((city: unknown) => textValue(city, '')).filter(Boolean) : [],
    })).filter(item => item.province);
  },

  async createMember(data: {
    name: string;
    phone: string;
    gender?: string;
    birthday?: string;
    level?: string;
    register_date?: string;
    country?: string;
    province?: string;
    city?: string;
    foreignRegion?: string;
    address?: string;
    remark?: string;
    avatar?: string;
  }): Promise<{ id?: string | number; success?: boolean }> {
    const res = await api.post('/members', data);
    const id = res.data?.id;
    if (id && (data.country || data.province || data.city || data.foreignRegion || data.address)) {
      await api.put(`/members/${id}`, data);
    }
    return res.data;
  },

  async updateMember(id: number | string, data: {
    name: string;
    phone: string;
    gender?: string;
    birthday?: string;
    level?: string;
    register_date?: string;
    country?: string;
    province?: string;
    city?: string;
    foreignRegion?: string;
    address?: string;
    remark?: string;
    avatar?: string;
    previousAvatar?: string;
  }): Promise<{ success?: boolean }> {
    const res = await api.put(`/members/${id}`, data);
    return res.data;
  },

  async uploadMemberAvatar(formData: FormData): Promise<{ success?: boolean; data?: { avatar?: string; filename?: string } }> {
    const res = await api.post('/members/avatar', formData);
    return res.data;
  },

  async deleteMember(id: number | string): Promise<{ success?: boolean }> {
    const res = await api.delete(`/members/${id}`);
    return res.data;
  },

  async getOrders(params?: Record<string, unknown>): Promise<UnifiedOrder[]> {
    const res = await api.get('/orders/unified', { params: { pageSize: 200, ...params } });
    const data = pickData<any>(res.data, res.data || {});
    return asArray(data?.items || data).map(adaptOrder);
  },

  async getOrdersPage(params?: Record<string, unknown>): Promise<{
    items: UnifiedOrder[];
    total: number;
    page: number;
    pageSize: number;
    allCount: number;
    totalAmount: number;
    statusCounts: Record<string, number>;
    types: string[];
  }> {
    const res = await api.get('/orders/unified', { params });
    const data = pickData<any>(res.data, res.data || {});
    return {
      items: asArray(data?.items).map(adaptOrder),
      total: numberValue(data?.total),
      page: numberValue(data?.page) || 1,
      pageSize: numberValue(data?.pageSize) || 20,
      allCount: numberValue(data?.summary?.allCount),
      totalAmount: numberValue(data?.summary?.totalAmount),
      statusCounts: isRecord(data?.summary?.statusCounts) ? data.summary.statusCounts as Record<string, number> : {},
      types: asArray<string>(data?.types),
    };
  },

  async getEcommerceSummary(): Promise<EcommerceSummary> {
    const res = await api.get('/shop/summary');
    const data = pickData<any>(res.data, {});
    const summary = data.summary || {};
    const products = asArray(data.products || data).map(adaptProduct);
    return {
      productCount: numberValue(summary.productCount ?? products.length),
      skuCount: numberValue(summary.skuCount ?? products.reduce((sum, item) => sum + item.skuCount, 0)),
      totalStock: numberValue(summary.totalStock ?? products.reduce((sum, item) => sum + item.stock, 0)),
      lowStockCount: numberValue(summary.lowStockCount ?? products.reduce((sum, item) => sum + item.lowStockSkuCount, 0)),
      stockValue: numberValue(summary.stockValue),
      products,
    };
  },

  async getCourses(): Promise<{ offline: Course[]; online: Course[] }> {
    const [offlineRes, onlineRes] = await Promise.allSettled([
      api.get('/courses'),
      api.get('/course/series'),
    ]);
    const offline = offlineRes.status === 'fulfilled' ? asArray(offlineRes.value.data).map(adaptOfflineCourse) : [];
    const online = onlineRes.status === 'fulfilled' ? asArray(onlineRes.value.data).map(adaptOnlineCourse) : [];
    return { offline, online };
  },

  async getPermissionUsers(): Promise<PermissionUser[]> {
    const res = await api.get('/users');
    return asArray(res.data).map(adaptPermissionUser);
  },

  async createUser(data: {
    username: string;
    password: string;
    name: string;
    role: string;
    status?: string;
  }): Promise<{ success: boolean; data?: PermissionUser; error?: string }> {
    const res = await api.post('/users', data);
    return res.data;
  },

  async updateUser(id: number | string, data: Record<string, any>): Promise<{ success: boolean; data?: PermissionUser; error?: string }> {
    const res = await api.put(`/users/${id}`, data);
    return res.data;
  },

  async deleteUser(id: number | string): Promise<{ success: boolean; error?: string; message?: string }> {
    const res = await api.delete(`/users/${id}`);
    return res.data;
  },

  async toggleUserStatus(id: number | string): Promise<{ success: boolean; data?: { id: string; status: string }; error?: string; message?: string }> {
    const res = await api.put(`/users/${id}/status`);
    return res.data;
  },

  getPlatformSettings(): PlatformSettings {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || '/api';
    return {
      appName: process.env.NEXT_PUBLIC_APP_NAME || '伊娃东方舞数字化运营平台',
      shortName: '伊娃东方舞',
      apiBase,
      productionApiBase: platformLinks.api.gateway,
      adminDomain: platformLinks.admin.domain,
      websiteDomain: platformLinks.website.domain,
      miniapiDomain: platformLinks.api.miniapi.replace('https://', ''),
      authDomain: platformLinks.api.auth.replace('https://', ''),
      authMode: 'JWT + Bearer Token',
      dataSources: [
        { name: '统一业务数据库', path: '10-统一平台admin-platform/admin.db', mode: 'shared-db', status: '官网/后台/网课小程序共用' },
      ],
      endpoints: ['/login', '/validate-token', '/members', '/members/:id/profile360', '/orders/unified', '/shop/summary', '/courses', '/course/series', '/users'],
      linkMatrix: platformLinkMatrix,
    };
  },

  async getFinanceSummary(): Promise<FinanceSummary> {
    const res = await api.get('/orders/unified', { params: { financeSummary: 1 } });
    const data = res.data || {};
    return {
      income: numberValue(data.income),
      expense: numberValue(data.expense),
      profit: numberValue(data.profit),
      orderCount: numberValue(data.orderCount),
      averageOrderAmount: numberValue(data.averageOrderAmount),
      monthIncome: numberValue(data.monthIncome),
      refunds: numberValue(data.refunds),
      byType: asArray<any>(data.byType).map(item => ({
        label: textValue(item.label, ''),
        value: numberValue(item.value),
        count: numberValue(item.count),
      })),
      recentOrders: asArray<any>(data.recentOrders).map(adaptOrder),
    };
  },

  async getDashboardData(): Promise<DashboardData> {
    const res = await api.get('/dashboard/overview');
    return pickData<DashboardData>(res.data, {
      totalMembers: 0,
      activeMembers: 0,
      totalOrders: 0,
      totalRevenue: 0,
      monthRevenue: 0,
      productCount: 0,
      lowStockCount: 0,
      recentMembers: [],
      recentOrders: [],
      orderSources: [],
    });
  },

  async getAnalyticsData(): Promise<DataAnalytics> {
    const res = await api.get('/analytics/overview');
    return pickData<DataAnalytics>(res.data, {
      sales: {
        monthIncome: 0,
        previousMonthIncome: 0,
        growthRate: 0,
        orderCount: 0,
        averageOrderAmount: 0,
        monthly: [],
      },
      members: {
        total: 0,
        newThisMonth: 0,
        active: 0,
        churnRate: 0,
        byLevel: [],
        byCity: [],
      },
      courses: {
        onlineCount: 0,
        offlineCount: 0,
        totalEnrollments: 0,
        completionRate: 0,
        hotCourses: [],
      },
      finance: {
        income: 0,
        expense: 0,
        profit: 0,
        profitRate: 0,
        byType: [],
      },
    });
  },
};
