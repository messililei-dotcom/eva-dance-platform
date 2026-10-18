import SwiftUI
import Security
import EvaCore

@MainActor final class Session: ObservableObject {
    @Published private(set) var credentials: Login?
    @Published var error: String?
    @Published var showLogin = false
    var token: String? { credentials?.token }
    var accountID: Int? { credentials?.memberId }
    let transport: APIClient
    let publicTransport: APIClient
    let isFixture: Bool
    lazy var api = SessionClient(session: self)
    private var refreshTask: Task<Login, Error>?
    private var generation = 0
    init() {
        #if DEBUG
        let override = ProcessInfo.processInfo.environment["EVA_API_BASE"].flatMap(URL.init(string:))
        transport = APIClient(baseURL: override ?? AppPolicy.apiBase)
        publicTransport = APIClient(baseURL: override ?? AppPolicy.publicAPIBase)
        isFixture = override != nil
        #else
        transport = APIClient()
        publicTransport = APIClient(baseURL: AppPolicy.publicAPIBase)
        isFixture = false
        #endif
        if let value = TokenStore.read(), let data = value.data(using: .utf8) { credentials = try? JSONDecoder().decode(Login.self, from: data) }
    }
    func login(phone: String, code: String) async throws {
        let body = try JSONSerialization.data(withJSONObject: ["phone": phone, "code": code, "deviceName": "伊娃东方舞 iPhone / iPad"])
        let result: Login = try await transport.request("/auth/login", method: "POST", body: body)
        try store(result); showLogin = false
    }
    func loginWithCarrier(token: String) async throws {
        let body = try JSONSerialization.data(withJSONObject: ["accessToken": token, "deviceName": "伊娃东方舞 iPhone / iPad"])
        let result: Login = try await transport.request("/auth/one-tap", method: "POST", body: body)
        try store(result); showLogin = false
    }
    private func store(_ value: Login) throws {
        let data = try JSONEncoder().encode(value)
        try TokenStore.save(String(decoding: data, as: UTF8.self)); credentials = value
    }
    func refresh() async throws -> String {
        if let refreshTask { return try await refreshTask.value.token }
        guard let current = credentials else { throw APIError.sessionExpired }
        let version = generation
        let task = Task<Login, Error> {
            try await transport.request("/auth/refresh", method: "POST", body: JSONSerialization.data(withJSONObject: ["refreshToken": current.refreshToken]))
        }
        refreshTask = task; defer { refreshTask = nil }
        let result = try await task.value
        guard version == generation else { throw APIError.sessionExpired }
        try store(result); return result.token
    }
    func logout() {
        let old = token
        clear()
        if let old { Task { let _: Empty? = try? await transport.request("/auth/logout", token: old, method: "POST", body: Data("{}".utf8)) } }
    }
    func clear() { generation += 1; refreshTask?.cancel(); refreshTask = nil; TokenStore.delete(); credentials = nil }
    func handle(_ error: Error) {
        if case APIError.sessionExpired = error { clear(); showLogin = true }
        self.error = error.localizedDescription
    }
}
@MainActor final class SessionClient {
    unowned let session: Session
    init(session: Session) { self.session = session }
    func request<T: Decodable>(_ path: String, token: String? = nil, method: String = "GET", body: Data? = nil, contentType: String = "application/json") async throws -> T {
        if AppPolicy.isSharedPublicRead(path, method: method, hasToken: token != nil) {
            return try await session.publicTransport.request(path, method: method)
        }
        // A supplied token denotes an authenticated call. Always use the latest rotated credential.
        let account = session.accountID
        let credential = token == nil ? nil : session.token
        do { return try await session.transport.request(path, token: credential, method: method, body: body, contentType: contentType) }
        catch APIError.sessionExpired {
            guard credential != nil, account == session.accountID else { throw APIError.sessionExpired }
            let renewed = try await session.refresh()
            return try await session.transport.request(path, token: renewed, method: method, body: body, contentType: contentType)
        }
    }
    func optionalProgress(lessonID: Int, token: String) async throws -> ProgressRecord? {
        do { return try await session.transport.optionalProgress(lessonID: lessonID, token: session.token ?? token) }
        catch APIError.sessionExpired {
            let renewed = try await session.refresh()
            return try await session.transport.optionalProgress(lessonID: lessonID, token: renewed)
        }
    }
}
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
