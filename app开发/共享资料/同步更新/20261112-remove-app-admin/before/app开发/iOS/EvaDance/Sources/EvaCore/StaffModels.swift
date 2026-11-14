import Foundation

public struct StaffUser: Decodable {
    public let id: Int
    public let name: String
    public let role: String
}
public struct StaffLogin: Decodable {
    public let token: String
    public let user: StaffUser
}
public enum StaffPolicy {
    public static let apiBase = URL(string: "https://admin.swod.com.cn/api")!
    public static func allows(_ role: String) -> Bool { ["admin", "event_admin"].contains(role) }
    public static func musicURL(_ id: Int) -> URL? {
        guard id > 0 else { return nil }
        return URL(string: apiBase.absoluteString + "/event/music/\(id)")
    }
    public static func csvCell(_ text: String) -> String {
        let unsafe = text.first.map { "=+-@\t\r\n".contains($0) } ?? false
        let numeric = !text.isEmpty && text.allSatisfy(\.isNumber)
        let value = unsafe || numeric ? "'" + text : text
        return "\"" + value.replacingOccurrences(of: "\"", with: "\"\"") + "\""
    }
}
