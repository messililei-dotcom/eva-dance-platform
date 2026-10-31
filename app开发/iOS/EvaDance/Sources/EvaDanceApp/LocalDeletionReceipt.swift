import Foundation
import Security
import EvaCore

struct LocalDeletionReceipt: Codable, Identifiable {
    var id: String { token }
    let token: String
    let memberID: Int
    let createdAt: Date
}

enum DeletionReceiptStore {
    private static var service: String {
        #if DEBUG
        if ProcessInfo.processInfo.environment["EVA_API_BASE"] != nil { return "cn.com.swod.app.deletion.fixture" }
        #endif
        return "cn.com.swod.app.deletion"
    }
    private static var base: [String: Any] { [kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service, kSecAttrAccount as String: "receipts"] }
    static func read() -> [LocalDeletionReceipt] {
        var query = base
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else { return [] }
        return (try? JSONDecoder().decode([LocalDeletionReceipt].self, from: data)) ?? []
    }
    static func save(_ receipts: [LocalDeletionReceipt]) throws {
        let data = try JSONEncoder().encode(receipts)
        let status = SecItemUpdate(base as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if status == errSecSuccess { return }
        guard status == errSecItemNotFound else { throw APIError.service("无法安全保存注销回执，请重试。") }
        var query = base
        query[kSecValueData as String] = data
        query[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        guard SecItemAdd(query as CFDictionary, nil) == errSecSuccess else { throw APIError.service("无法安全保存注销回执，请重试。") }
    }
    static func make(memberID: Int) throws -> LocalDeletionReceipt {
        var bytes = [UInt8](repeating: 0, count: 32)
        guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else { throw APIError.service("无法生成安全回执，请重试。") }
        let token = Data(bytes).base64EncodedString().replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
        return LocalDeletionReceipt(token: "eva_d_" + token, memberID: memberID, createdAt: Date())
    }
}
