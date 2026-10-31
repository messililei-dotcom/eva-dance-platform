import Foundation

/// A server lease stored in device-protected storage, never a replacement for API authentication.
public struct VideoCacheLease: Codable, Equatable {
    public var member_id: Int
    public var session_id: String
    public var device_id: String
    public var lesson_id: Int
    public var series_id: Int
    public var vod_video_id: String
    public var material_version: String
    public var issued_at: Double
    public var expires_at: Double
    public var mode: String
}
public enum VideoCachePolicy {
    public static let maximumLeaseMS: Double = 86_400_000
    /// nowMS comes from server time plus an OS continuous-clock delta, not editable wall-clock time.
    public static func permits(_ lease: VideoCacheLease, member: Int, session: String, device: String, lesson: Int, nowMS: Double) -> Bool {
        lease.mode == "aliyun-secure" && member > 0 && lease.member_id == member && !session.isEmpty && lease.session_id == session
        && device.count == 64 && lease.device_id == device && lesson > 0 && lease.lesson_id == lesson && lease.series_id > 0
        && lease.vod_video_id.count == 32 && lease.material_version.count == 64
        && lease.issued_at.isFinite && lease.expires_at.isFinite && nowMS.isFinite
        && lease.expires_at > lease.issued_at && lease.expires_at - lease.issued_at <= maximumLeaseMS
        && nowMS >= lease.issued_at && nowMS < lease.expires_at
    }
    public static func shouldRenew(_ lease: VideoCacheLease, nowMS: Double, lastAttemptMS: Double, online: Bool) -> Bool {
        online && nowMS.isFinite && nowMS - lastAttemptMS >= 60_000
        && (nowMS >= lease.expires_at - 21_600_000 || nowMS - lastAttemptMS >= 300_000)
    }
}
