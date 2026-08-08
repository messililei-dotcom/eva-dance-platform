export type OrderStatus = 'pending' | 'paid' | 'completed' | 'closed' | 'refunded' | 'unknown';

export interface Member {
  id: string;
  name: string;
  phone: string;
  level: string;
  status: string;
  city: string;
  country: string;
  registerDate: string;
  totalSpent: number;
  courseCount: number;
  growth: number;
  lastActiveAt: string;
  avatar?: string;
  wxAvatarUrl?: string;
  wxName?: string;
  wxNickname?: string;
  wxAccount?: string;
  wxOpenid?: string;
  wxUnionid?: string;
  raw?: Record<string, unknown>;
}

export interface MemberProfile360 {
  member: Record<string, any>;
  summary: {
    offlineIncome: number;
    onlineIncome: number;
    totalIncome: number;
    consumeCount: number;
    authorizationCount: number;
    completedVideoCount: number;
    financeIncome: number;
    financeOrderAmount: number;
  };
  offlinePayments: Array<Record<string, any>>;
  consumeRecords: Array<Record<string, any>>;
  courseOrders: Array<Record<string, any>>;
  authorizations: Array<Record<string, any>>;
  progress: Array<Record<string, any>>;
  financeIncomes: Array<Record<string, any>>;
  financeOrders: Array<Record<string, any>>;
  operationLogs: Array<Record<string, any>>;
}

export interface UnifiedOrder {
  id: string;
  orderNo: string;
  orderDate: string;
  memberName: string;
  memberPhone: string;
  orderType: string;
  title: string;
  amount: number;
  status: OrderStatus | string;
  sourceType: string;
  payMethod: string;
  raw?: Record<string, unknown>;
}

export interface Product {
  id: string;
  sourceId: string;
  sourceType: string;
  name: string;
  category: string;
  status: string;
  skuCount: number;
  stock: number;
  minSalePrice: number;
  maxSalePrice: number;
  lowStockSkuCount: number;
  updatedAt: string;
  raw?: Record<string, unknown>;
}

export interface EcommerceSummary {
  productCount: number;
  skuCount: number;
  totalStock: number;
  lowStockCount: number;
  stockValue: number;
  products: Product[];
}

export interface FinanceSummary {
  income: number;
  expense: number;
  profit: number;
  orderCount: number;
  averageOrderAmount: number;
  monthIncome: number;
  refunds: number;
  byType: Array<{ label: string; value: number; count: number }>;
  recentOrders: UnifiedOrder[];
  synced?: boolean;
  expenseByType?: Array<{ label: string; value: number; count: number }>;
  cashflow?: Array<Record<string, unknown>>;
  trend?: Array<Record<string, unknown>>;
  stockAsset?: number;
}

export interface Course {
  id: string;
  name: string;
  type: 'offline' | 'online';
  category: string;
  teacher: string;
  price: number;
  sessions: number;
  students: number;
  capacity: number;
  status: string;
  startDate: string;
  level: string;
  raw?: Record<string, unknown>;
}

export interface PermissionUser {
  id: string | number;
  username: string;
  name: string;
  role: string;
  status: string;
  permissionCount: number;
  permissions: string[];
  // 权限字段
  permCourseView?: number | boolean;
  permCourseCreate?: number | boolean;
  permCourseEdit?: number | boolean;
  permCourseDelete?: number | boolean;
  permMemberView?: number | boolean;
  permMemberCreate?: number | boolean;
  permMemberEdit?: number | boolean;
  permMemberDelete?: number | boolean;
  permTeacherView?: number | boolean;
  permTeacherCreate?: number | boolean;
  permTeacherEdit?: number | boolean;
  permTeacherDelete?: number | boolean;
  permPaymentView?: number | boolean;
  permPaymentCreate?: number | boolean;
  permPaymentEdit?: number | boolean;
  permPaymentDelete?: number | boolean;
  permConsumeView?: number | boolean;
  permConsumeCreate?: number | boolean;
  permConsumeEdit?: number | boolean;
  permConsumeDelete?: number | boolean;
  permOnlineAuthView?: number | boolean;
  permOnlineAuthCreate?: number | boolean;
  permOnlineAuthCancel?: number | boolean;
  permOnlineAuthPhone?: number | boolean;
  permLogView?: number | boolean;
  bonusTraining?: number | boolean;
  bonusCard?: number | boolean;
  bonusYearly?: number | boolean;
  bonusDisciple?: number | boolean;
  password?: string;
  raw?: Record<string, unknown>;
}

export interface PlatformSettings {
  appName: string;
  shortName: string;
  apiBase: string;
  productionApiBase: string;
  adminDomain: string;
  websiteDomain: string;
  miniapiDomain: string;
  authDomain: string;
  authMode: string;
  dataSources: Array<{ name: string; path: string; mode: string; status: string }>;
  endpoints: string[];
  linkMatrix: Array<{ key: string; label: string; url: string; description: string; target: string }>;
}

export interface DashboardData {
  totalMembers: number;
  activeMembers: number;
  totalOrders: number;
  totalRevenue: number;
  monthRevenue: number;
  productCount: number;
  lowStockCount: number;
  recentMembers: Member[];
  recentOrders: UnifiedOrder[];
  orderSources: Array<{ label: string; value: number; count: number }>;
}

export interface DataAnalytics {
  sales: {
    monthIncome: number;
    previousMonthIncome: number;
    growthRate: number;
    orderCount: number;
    averageOrderAmount: number;
    monthly: Array<{ month: string; revenue: number }>;
  };
  members: {
    total: number;
    newThisMonth: number;
    active: number;
    churnRate: number;
    byLevel: Array<{ key: string; level: string; count: number; percent: number }>;
    byCity: Array<{ key: string; city: string; count: number; percent: number }>;
  };
  courses: {
    onlineCount: number;
    offlineCount: number;
    totalEnrollments: number;
    completionRate: number;
    hotCourses: Array<{
      key: string;
      rank: number;
      name: string;
      type: '线上' | '线下';
      enrollments: number;
      completion: number;
      rating: number;
    }>;
  };
  finance: {
    income: number;
    expense: number;
    profit: number;
    profitRate: number;
    byType: Array<{ key: string; category: string; amount: number; percent: number; color: string }>;
  };
}

export interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
}
