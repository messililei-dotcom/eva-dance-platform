import Foundation

public struct APIEnvelope<T: Decodable>: Decodable {
    public let success: Bool
    public let data: T?
    public let message: String?
    public let error: String?
}
public struct Login: Codable {
    public let token: String
    public let refreshToken: String
    public let expiresAt: Double
    public let memberId: Int
    public let sessionId: String
}
public struct Empty: Decodable {}
public struct Series: Decodable, Identifiable {
    public let series_id: Int
    public let series_name: String
    public var id: Int { series_id }
}
public struct Lesson: Decodable, Identifiable, Hashable {
    public let id: Int
    public let name: String
    public let duration: Double?
}
public struct CourseUnit: Decodable, Identifiable {
    public let id: Int
    public let name: String
    public let videos: [Lesson]
}
public struct RecentLesson: Decodable, Identifiable {
    public let video_id: Int
    public let course_name: String
    public let series_name: String?
    public let progress: Double?
    public var id: Int { video_id }
}
public struct Quality: Decodable, Identifiable {
    public let label: String
    public let value: String
    public let url: String
    public var id: String { value }
}
public struct Playback: Decodable {
    public let play_url: String
    public let authorized: Bool
    public let quality_options: [Quality]?
}
public struct ProgressRecord: Decodable {
    public let progress: Double
    public let duration: Double
    public let revision: Int?
}
public struct InboxPage: Decodable {
    public let items: [InboxMessage]
    public let unreadCount: Int
    public let nextCursor: Int
    public let hasMore: Bool
}
public struct InboxMessage: Decodable, Identifiable {
    public let id: String
    public let title: String
    public let content: String
    public let status: String
    public let createdAt: String
    public let recipientId: String
}
public struct Certificate: Decodable, Identifiable {
    public let id: Int
    public let certificateNo: String
    public let courseName: String
    public let issueDate: String
    public let status: String
    public let verifyUrl: String
}
public enum AppPolicy {
    public static let apiBase = URL(string: "https://admin.swod.com.cn/api/app/v1")!
    public static let publicAPIBase = URL(string: "https://admin.swod.com.cn/api/mini")!
    public static func isSharedPublicRead(_ path: String, method: String, hasToken: Bool) -> Bool {
        guard method == "GET", !hasToken else { return false }
        let route = String(path.split(separator: "?", maxSplits: 1).first ?? "")
        return route.range(of: "^/(public/(series(/[1-9][0-9]*(/(courses|detail))?)?|offline-courses|calendar|home-stats)|events(/[1-9][0-9]*)?)$", options: .regularExpression) != nil
    }
    // No external course purchases, downloads or SDK claims in the initial learning client.
    public static let supportsDigitalPurchase = false
    public static let supportsOfflineDownload = false
    public static func secureMediaURL(_ raw: String) -> URL? {
        guard !raw.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty,
              let url = URL(string: raw, relativeTo: apiBase)?.absoluteURL,
              url.scheme == "https", let host = url.host, !host.isEmpty,
              url.user == nil, url.password == nil else { return nil }
        return url
    }
    public static func paymentURL(_ raw: String) -> URL? {
        guard let url = secureMediaURL(raw),
              ["openapi.alipay.com", "mapi.alipay.com", "wx.tenpay.com"].contains(url.host ?? ""),
              url.port == nil || url.port == 443 else { return nil }
        return url
    }
    public static func certificateURL(_ raw: String) -> URL? {
        guard let url = secureMediaURL(raw),
              ["www.swod.com.cn", "admin.swod.com.cn", "swod.com.cn"].contains(url.host ?? ""),
              (url.path == "/certification" || url.path.hasPrefix("/api/public/certificates/")) else { return nil }
        return url
    }
    public static func safeProgress(position: Double, duration: Double) -> [String: Double]? {
        guard position.isFinite, duration.isFinite, duration > 0, position >= 0 else { return nil }
        return ["progress": min(position, duration), "duration": duration]
    }
}
