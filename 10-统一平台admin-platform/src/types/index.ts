export interface LoginRequest { username: string; password: string; remember?: boolean; }
export interface LoginResponse { success: boolean; token?: string; user?: UserInfo; message?: string; }
export interface UserInfo { id: number; username: string; name: string; role: string; permissions?: string[]; avatar?: string; }
export interface DashboardStats { totalMembers: number; membersChange: number; todayOrders: number; ordersChange: number; todayRevenue: number; revenueChange: number; totalCourses: number; coursesChange: number; liveSessions: number; liveChange: number; totalProducts: number; productsChange: number; trendData?: TrendDataPoint[]; }
export interface TrendDataPoint { date: string; orders: number; revenue: number; newMembers: number; }
export interface TodoItem { id: number; title: string; priority: 'high' | 'medium' | 'low'; status: 'pending' | 'in_progress' | 'completed'; dueDate?: string; }
