import Foundation
import Security
import Darwin
enum APIError: Error { case service(String) }
enum TokenStore {
    private static var service: String {
        #if DEBUG
        if ProcessInfo.processInfo.environment["EVA_API_BASE"] != nil { return "cn.com.swod.app.session.fixture" }
        #endif
        return "cn.com.swod.app.session"
    }
    private static let base: [String: Any] = [kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: service, kSecAttrAccount as String: "student"]
    static func read() -> String? {
        var query = base; query[kSecReturnData as String] = true; query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }
    static func save(_ value: String) throws {
        let data = Data(value.utf8)
        let update = SecItemUpdate(base as CFDictionary, [kSecValueData as String: data] as CFDictionary)
        if update == errSecSuccess { return }
        guard update == errSecItemNotFound else { throw APIError.service("无法安全保存登录，请重试。") }
        var query = base
        query[kSecValueData as String] = data
        query[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        guard SecItemAdd(query as CFDictionary, nil) == errSecSuccess else { throw APIError.service("无法安全保存登录，请重试。") }
    }
    static func delete() { SecItemDelete(base as CFDictionary) }
}

do {
 try TokenStore.save("simulator-keychain-regression")
 guard TokenStore.read() == "simulator-keychain-regression" else { print("FAIL: keychain read-back"); exit(1) }
 TokenStore.delete()
 print("PASS: actual TokenStore save, read and delete")
} catch { print("FAIL: TokenStore save rejected"); exit(1) }
