import api from '@/lib/api';
import { platformLinkMatrix, platformLinks } from '@/lib/platform-links';
import type {
  Course,
  DashboardData,
  EcommerceSummary,
  FinanceSummary,
  Member,
  PermissionUser,
  PlatformSettings,
  Product,
  UnifiedOrder,
} from '@/types/domain';

function pickData<T>(payload: any, fallback: T): T {
  if (payload && typeof payload === 'object' && 'data' in payload) return payload.data ?? fallback;
  return payload ?? fallback;
}

function asArray<T = any>(payload: any): T[] {
  const data = pickData<any>(payload, payload);
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.list)) return data.list;
  if (Array.isArray(data?.products)) return data.products;
  return [];
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
    level: textValue(raw?.level ?? raw?.memberLevel, '普通会员'),
    city: textValue(raw?.city ?? raw?.province ?? raw?.foreignRegion, '-'),
    country: textValue(raw?.country, '中国'),
    registerDate: textValue(raw?.register_date ?? raw?.registerDate ?? raw?.created_at ?? raw?.createdAt, '-').slice(0, 10),
    totalSpent: numberValue(raw?.totalSpent ?? raw?.totalAmount ?? raw?.amount),
    courseCount: numberValue(raw?.courseCount ?? raw?.courses),
    growth: numberValue(raw?.growth ?? raw?.growthValue),
    lastActiveAt: textValue(raw?.updated_at ?? raw?.updatedAt ?? raw?.lastLogin ?? raw?.register_date, '-').slice(0, 16),
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
    name: textValue(raw?.name ?? raw?.title, '未命名专栏'),
    type: 'online',
    category: textValue(raw?.category, '线上专栏'),
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
  permLogView: '查看日志',
};

export function adaptPermissionUser(raw: any, index = 0): PermissionUser {
  const permissions = Object.keys(permissionLabels)
    .filter(key => raw?.[key])
    .map(key => permissionLabels[key]);
  return {
    id: textValue(raw?.id ?? index),
    username: textValue(raw?.username, '-'),
    name: textValue(raw?.name ?? raw?.username, '-'),
    role: textValue(raw?.role, 'user'),
    status: textValue(raw?.status, 'active'),
    permissionCount: permissions.length,
    permissions,
    raw,
  };
}

export const platformAdapter = {
  async getMembers(): Promise<Member[]> {
    const res = await api.get('/members');
    return asArray(res.data).map(adaptMember);
  },

  async getOrders(params?: Record<string, unknown>): Promise<UnifiedOrder[]> {
    const res = await api.get('/orders/unified', { params: { limit: 1000, ...params } });
    return asArray(res.data).map(adaptOrder);
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

  getPlatformSettings(): PlatformSettings {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
    return {
      appName: process.env.NEXT_PUBLIC_APP_NAME || '伊娃东方舞数字化运营平台',
      shortName: '伊娃东方舞',
      apiBase,
      productionApiBase: platformLinks.api.gateway,
      adminDomain: platformLinks.admin.domain,
      websiteDomain: platformLinks.website.domain,
      learnDomain: platformLinks.learn.domain,
      miniapiDomain: platformLinks.api.miniapi.replace('https://', ''),
      authDomain: platformLinks.api.auth.replace('https://', ''),
      authMode: 'JWT + Bearer Token',
      dataSources: [
        { name: '线下培训系统', path: '03-学员管理系统/学员管理系统/server/dance.db', mode: 'adapter', status: '已接入核心数据' },
        { name: '网课系统', path: '04-网课系统开发计划', mode: 'adapter', status: '适配中' },
        { name: '电商系统', path: '07-电商系统', mode: 'adapter', status: '已接入库存总览' },
        { name: '财务系统', path: '09-财务系统', mode: 'adapter', status: '以统一订单账本替代直连' },
      ],
      endpoints: ['/login', '/validate-token', '/members', '/members/:id/profile360', '/orders/unified', '/shop/summary', '/courses', '/course/series', '/users'],
      linkMatrix: platformLinkMatrix,
    };
  },

  async getFinanceSummary(): Promise<FinanceSummary> {
    const orders = await this.getOrders();
    const nowMonth = new Date().toISOString().slice(0, 7);
    const income = orders.reduce((sum, order) => sum + order.amount, 0);
    const refunds = orders.filter(order => order.status === 'refunded').reduce((sum, order) => sum + order.amount, 0);
    const byTypeMap = new Map<string, { value: number; count: number }>();
    orders.forEach(order => {
      const current = byTypeMap.get(order.orderType) || { value: 0, count: 0 };
      current.value += order.amount;
      current.count += 1;
      byTypeMap.set(order.orderType, current);
    });
    return {
      income,
      expense: refunds,
      profit: income - refunds,
      orderCount: orders.length,
      averageOrderAmount: orders.length ? Math.round(income / orders.length) : 0,
      monthIncome: orders.filter(order => order.orderDate.startsWith(nowMonth)).reduce((sum, order) => sum + order.amount, 0),
      refunds,
      byType: Array.from(byTypeMap.entries()).map(([label, item]) => ({ label, ...item })),
      recentOrders: orders.slice(0, 8),
    };
  },

  async getDashboardData(): Promise<DashboardData> {
    const [members, orders, shop] = await Promise.all([
      this.getMembers().catch(() => []),
      this.getOrders().catch(() => []),
      this.getEcommerceSummary().catch(() => ({ productCount: 0, skuCount: 0, totalStock: 0, lowStockCount: 0, stockValue: 0, products: [] })),
    ]);
    const nowMonth = new Date().toISOString().slice(0, 7);
    const totalRevenue = orders.reduce((sum, order) => sum + order.amount, 0);
    const sourceMap = new Map<string, { value: number; count: number }>();
    orders.forEach(order => {
      const current = sourceMap.get(order.sourceType) || { value: 0, count: 0 };
      current.value += order.amount;
      current.count += 1;
      sourceMap.set(order.sourceType, current);
    });
    return {
      totalMembers: members.length,
      activeMembers: members.filter(member => member.totalSpent > 0).length,
      totalOrders: orders.length,
      totalRevenue,
      monthRevenue: orders.filter(order => order.orderDate.startsWith(nowMonth)).reduce((sum, order) => sum + order.amount, 0),
      productCount: shop.productCount,
      lowStockCount: shop.lowStockCount,
      recentMembers: members.slice(0, 8),
      recentOrders: orders.slice(0, 8),
      orderSources: Array.from(sourceMap.entries()).map(([label, item]) => ({ label, ...item })),
    };
  },
};
