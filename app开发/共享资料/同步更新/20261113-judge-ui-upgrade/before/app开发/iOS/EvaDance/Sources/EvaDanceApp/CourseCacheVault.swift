import Foundation
import Security
import Darwin
import EvaCore

enum CourseCacheVault {
    private static var service: String { "cn.com.swod.app.offline." + (Bundle.main.bundleIdentifier ?? "unknown") }
    static func read(_ account: String) -> Data? {
        var result: CFTypeRef?
        let query: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
            kSecAttrAccount as String: account, kSecReturnData as String: true, kSecMatchLimit as String: kSecMatchLimitOne]
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else { return nil }
        return result as? Data
    }
    static func write(_ data: Data, account: String) throws {
        let key: [String: Any] = [kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service, kSecAttrAccount as String: account]
        let fields: [String: Any] = [kSecValueData as String: data, kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        let status = SecItemUpdate(key as CFDictionary, fields as CFDictionary)
        if status == errSecItemNotFound {
            guard SecItemAdd(key.merging(fields) { _, new in new } as CFDictionary, nil) == errSecSuccess else { throw failure }
        } else if status != errSecSuccess { throw failure }
    }
    static var failure: Error { NSError(domain: "SWODCache", code: 1, userInfo: [NSLocalizedDescriptionKey: "无法安全保存离线内容，请重试"]) }
    static func bytes(_ directory: URL) -> Int64 {
        guard let walk = FileManager.default.enumerator(at: directory, includingPropertiesForKeys: [.fileSizeKey, .isRegularFileKey]) else { return 0 }
        var total: Int64 = 0
        for case let file as URL in walk {
            guard let values = try? file.resourceValues(forKeys: [.fileSizeKey,.isRegularFileKey]) else { return .max }
            if values.isRegularFile == true { total += Int64(values.fileSize ?? 0) }
        }
        return total
    }
    static func elapsed() -> Double {
        var info = mach_timebase_info_data_t(); mach_timebase_info(&info)
        return Double(mach_continuous_time()) * Double(info.numer) / Double(info.denom) / 1_000_000
    }
    static func boot() -> String {
        var value = timeval(); var size = MemoryLayout<timeval>.size
        guard sysctlbyname("kern.boottime", &value, &size, nil, 0) == 0 else { return "" }
        return "\(value.tv_sec):\(value.tv_usec)"
    }
    static func device() throws -> String {
        if let data = read("installation"), let value = String(data: data, encoding: .utf8), value.range(of: "^[a-f0-9]{64}$", options: .regularExpression) != nil { return value }
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else { throw failure }
        let value = bytes.map { String(format: "%02x", $0) }.joined()
        try write(Data(value.utf8), account: "installation"); return value
    }
}
