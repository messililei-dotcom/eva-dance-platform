export type OrderStatus = 'pending' | 'paid' | 'completed' | 'closed' | 'refunded' | 'unknown';

export interface Member {
  id: string;
  name: string;
  phone: string;
  level: string;
  city: string;
  country: string;
  registerDate: string;
  totalSpent: number;
  courseCount: number;
  growth: number;
  lastActiveAt: string;
  raw?: Record<string, unknown>;
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
  id: string;
  username: string;
  name: string;
  role: string;
  status: string;
  permissionCount: number;
  permissions: string[];
  raw?: Record<string, unknown>;
}

export interface PlatformSettings {
  appName: string;
  shortName: string;
  apiBase: string;
  productionApiBase: string;
  adminDomain: string;
  websiteDomain: string;
  learnDomain: string;
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

export interface ApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: string;
  message?: string;
}
