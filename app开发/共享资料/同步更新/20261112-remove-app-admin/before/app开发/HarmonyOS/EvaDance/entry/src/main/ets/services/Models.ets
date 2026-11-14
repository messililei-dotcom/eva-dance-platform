export interface Credentials { token: string; refreshToken: string; expiresAt: number; memberId: number; sessionId: string; }
export interface StaffUser { id: number; name: string; role: string; }
export interface StaffCredentials { token: string; user: StaffUser; }
export interface Envelope<T> { success: boolean; data?: T; error?: string; message?: string; }
export interface CourseOffer { id?: number; name?: string; period?: string; priceFen?: number; sessions?: number; }
export interface PaymentFlags { alipay?: boolean; wechat?: boolean; }
export interface MediaQuality { value: string; label: string; url: string; }
export interface Row {
  learning_percent?: number; timestamp_seconds?: number;
  birthday?: string; stats?: Row; authorized_count?: number; offline_course_count?: number;
  avatar_url?: string; wx_avatar_url?: string; wx_nickname?: string; wx_name?: string; level?: string;
  unreadCount?: number;
  city?: string; coverUrl?: string; cover_url?: string;
  registrationStart?: string; registrationEnd?: string;
  judgeCount?: number | null; approvedPlayerCount?: number | null; rankingCount?: number | null; scoreCount?: number | null;
  quality_options?: MediaQuality[];
  oneTapLogin?: boolean;
  mediaKind?: string;
  shipping?: Row; quantity?: number; productId?: string; alipay?: boolean; wechat?: boolean;
  recipient?: string; address?: string; deliveryMethod?: string; totalFen?: number; trackingNo?: string; carrier?: string; spec?: string; size?: string; color?: string; image?: string; detailText?: string;
  group_key?: string; promo_price?: number; is_free?: number | boolean; outline?: string[]; period_status?: string; capacity?: number; remaining?: number; total_students?: number; group_total_students?: number; student_display_base?: number;
  ordinal?: number; percent?: number; completed?: number; priceFen?: number; order?: Row; offer?: CourseOffer; payment?: PaymentFlags; provider?: string; url?: string; period?: string;
  id?: number | string; name?: string; title?: string; subtitle?: string; teacher?: string; category?: string;
  rich_description?: string; description?: string; cover_image?: string; total_courses?: number; source_id?: number; location?: string;
  start_date?: string; end_date?: string; startDate?: string; endDate?: string; venue?: string;
  series_id?: number; series_name?: string; video_id?: number; course_name?: string; courseName?: string;
  videos?: Row[]; duration?: number; progress?: number; revision?: number; play_url?: string; authorized?: boolean; last_play_at?: string;
  entries?: Row[]; players?: Row[]; contestants?: Row[]; items?: Row[]; products?: Row[]; orders?: Row[];
  revenue?: Row; platformFen?: number;
  competition?: Row; groups?: Row[]; sessions?: Row[]; rankings?: Row[]; entitlements?: Row[]; bookings?: Row[];
  groupId?: number; groupName?: string; competitionName?: string; performanceTitle?: string; phone?: string;
  organization?: string; contestantNumber?: string; programNumber?: string; sequenceNo?: number; playerNo?: string;
  registrationFee?: number; paidAmount?: number; paidStatus?: string; totalRegistrationFee?: number;
  musicName?: string; musicFileId?: number; musicDuration?: number; playerCount?: number | null; groupCount?: number;
  countryCode?: string; canEdit?: boolean; fileName?: string;
  growth?: Row; ledger?: Row[]; level_display?: string; experience_total?: number;
  next_level_name?: string; points_to_next_level?: number; points_delta?: number; occurred_at?: string;
  playerId?: string; competitionId?: string; entrantName?: string; resultPublished?: boolean; awardName?: string;
  auditStatus?: string; totalScore?: number; rankNo?: number; playerName?: string; publishedTotal?: number;
  startsAt?: string; registrationStatus?: string; status?: string; remark?: string; content?: string; label?: string;
  recipientId?: string; createdAt?: string; nextCursor?: number; hasMore?: boolean;
  certificateNo?: string; issueDate?: string; verifyUrl?: string; pdfUrl?: string; memberName?: string;
  device_name?: string; last_seen?: number; current?: boolean; name_cn?: string;
  price?: number; stock?: number; amount?: number; kind?: string; method?: string; paid_at?: string;
  course_period?: string; used_sessions?: number; consumes?: Row[]; consume_date?: string; count?: number;
  available_sessions?: number; session_date?: string; start_time?: string; can_book?: boolean; booking_reason?: string;
}
export interface ShopItem { id: string; quantity: number; }
export interface WriteBody {
  scores?: Record<string, number>;
  installationId?: string; pushSessionId?: string; deviceId?: string; enabled?: boolean;
  device_id?: string; material_version?: string;
  accessToken?: string;
  items?: ShopItem[]; recipient?: string; address?: string; deliveryMethod?: string;
  targetId?: number; provider?: string; expectedTotalFen?: number;
  phone?: string; code?: string; deviceName?: string; refreshToken?: string; username?: string; password?: string;
  name?: string; organization?: string; teacher?: string; performanceTitle?: string; remark?: string; countryCode?: string;
  groupId?: number; competitionId?: number; sessionId?: number; bookingId?: number; checkinCode?: string;
  reason?: string; action?: string; confirmation?: string; video_id?: number; timestamp_seconds?: number;
  content?: string; progress?: number; duration?: number; revision?: number;
  kind?: string; method?: string; amount?: number; paidAt?: string; requestKey?: string;
}
