export interface Credentials { token: string; refreshToken: string; expiresAt: number; memberId: number; sessionId: string; }
export interface StaffUser { id: number; name: string; role: string; }
export interface StaffCredentials { token: string; user: StaffUser; }
export interface Envelope<T> { success: boolean; data?: T; error?: string; message?: string; }
export interface CourseOffer { id?: number; name?: string; period?: string; priceFen?: number; sessions?: number; }
export interface PaymentFlags { alipay?: boolean; wechat?: boolean; }
export interface Row {
  group_key?: string; promo_price?: number; is_free?: number | boolean; outline?: string[]; period_status?: string; capacity?: number; remaining?: number; total_students?: number; group_total_students?: number;
  ordinal?: number; percent?: number; completed?: number; priceFen?: number; order?: Row; offer?: CourseOffer; payment?: PaymentFlags; provider?: string; url?: string; period?: string;
  id?: number | string; name?: string; title?: string; subtitle?: string; teacher?: string; category?: string;
  description?: string; cover_image?: string; total_courses?: number; source_id?: number; location?: string;
  start_date?: string; end_date?: string; startDate?: string; endDate?: string; venue?: string;
  series_id?: number; series_name?: string; video_id?: number; course_name?: string; courseName?: string;
  videos?: Row[]; duration?: number; progress?: number; revision?: number; play_url?: string; authorized?: boolean;
  entries?: Row[]; players?: Row[]; contestants?: Row[]; items?: Row[]; products?: Row[]; orders?: Row[];
  competition?: Row; groups?: Row[]; sessions?: Row[]; rankings?: Row[]; entitlements?: Row[]; bookings?: Row[];
  groupId?: number; groupName?: string; competitionName?: string; performanceTitle?: string; phone?: string;
  organization?: string; contestantNumber?: string; programNumber?: string; sequenceNo?: number; playerNo?: string;
  registrationFee?: number; paidAmount?: number; paidStatus?: string; totalRegistrationFee?: number;
  musicName?: string; musicFileId?: number; musicDuration?: number; playerCount?: number; groupCount?: number;
  playerId?: string; competitionId?: string; entrantName?: string; resultPublished?: boolean; awardName?: string;
  auditStatus?: string; totalScore?: number; rankNo?: number; playerName?: string; publishedTotal?: number;
  startsAt?: string; registrationStatus?: string; status?: string; remark?: string; content?: string; label?: string;
  recipientId?: string; createdAt?: string; nextCursor?: number; hasMore?: boolean;
  certificateNo?: string; issueDate?: string; verifyUrl?: string; pdfUrl?: string; memberName?: string;
  device_name?: string; last_seen?: number; current?: boolean; name_cn?: string;
  price?: number; stock?: number; amount?: number; kind?: string; method?: string; paid_at?: string;
  available_sessions?: number; session_date?: string; start_time?: string; can_book?: boolean; booking_reason?: string;
}
export interface WriteBody {
  targetId?: number; provider?: string; expectedTotalFen?: number;
  phone?: string; code?: string; deviceName?: string; refreshToken?: string; username?: string; password?: string;
  name?: string; organization?: string; teacher?: string; performanceTitle?: string; remark?: string;
  groupId?: number; competitionId?: number; sessionId?: number; bookingId?: number; checkinCode?: string;
  reason?: string; action?: string; confirmation?: string; video_id?: number; timestamp_seconds?: number;
  content?: string; progress?: number; duration?: number; revision?: number;
  kind?: string; method?: string; amount?: number; paidAt?: string; requestKey?: string;
}
