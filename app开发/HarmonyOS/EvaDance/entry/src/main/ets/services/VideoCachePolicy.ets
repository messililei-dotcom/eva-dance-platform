export const COURSE_CACHE_RELEASE_ENABLED: boolean = false;

export interface VideoCacheLease {
  member_id: number; session_id: string; device_id: string; lesson_id: number; series_id: number;
  vod_video_id: string; material_version: string; issued_at: number; expires_at: number; mode: string;
}
export function permitsCachedVideo(lease: VideoCacheLease, member: number, session: string, device: string, lesson: number, serverNow: number): boolean {
  return lease.mode === 'aliyun-secure' && member > 0 && lease.member_id === member && session.length > 0 && lease.session_id === session
    && /^[a-f0-9]{64}$/.test(device) && lease.device_id === device && lesson > 0 && lease.lesson_id === lesson && lease.series_id > 0
    && lease.vod_video_id.length === 32 && lease.material_version.length === 64
    && Number.isFinite(lease.issued_at) && Number.isFinite(lease.expires_at) && Number.isFinite(serverNow)
    && lease.expires_at > lease.issued_at && lease.expires_at - lease.issued_at <= 86400000 && serverNow >= lease.issued_at && serverNow < lease.expires_at;
}
export function shouldRenewVideoCache(expires: number, serverNow: number, lastAttempt: number, online: boolean): boolean {
  return online && serverNow - lastAttempt >= 60000 && (serverNow >= expires - 21600000 || serverNow - lastAttempt >= 300000);
}
export function invalidatesVideoCache(status: number): boolean { return [401,403,404,409,410].includes(status); }
