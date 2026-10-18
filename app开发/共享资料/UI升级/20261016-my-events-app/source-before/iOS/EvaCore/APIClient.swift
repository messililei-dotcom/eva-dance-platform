import Foundation

public enum APIError: LocalizedError {
    case sessionExpired, denied, invalidResponse, service(String)
    public var errorDescription: String? {
        switch self {
        case .sessionExpired: return "登录已过期，请重新登录。"
        case .denied: return "当前账号没有此内容的有效权限。"
        case .invalidResponse: return "服务返回异常，请稍后重试。"
        case .service(let text): return text
        }
    }
}
// Never follows HTTP redirects with an authenticated API request.
private final class NoRedirect: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask,
                    willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
                    completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
public final class APIClient {
    private let session: URLSession
    private let baseURL: URL
    public init(session: URLSession? = nil, baseURL: URL = AppPolicy.apiBase) {
        self.baseURL = baseURL
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 20
        config.urlCache = nil
        self.session = session ?? URLSession(configuration: config, delegate: NoRedirect(), delegateQueue: nil)
    }
    public func request<T: Decodable>(_ path: String, token: String? = nil, method: String = "GET", body: Data? = nil, contentType: String = "application/json") async throws -> T {
        let envelope: APIEnvelope<T> = try await fetch(path, token: token, method: method, body: body, contentType: contentType)
        if let result = envelope.data { return result }
        if T.self == Empty.self { return Empty() as! T }
        if T.self == JSONValue.self { return JSONValue.null as! T }
        throw APIError.invalidResponse
    }
    public func optionalProgress(lessonID: Int, token: String) async throws -> ProgressRecord? {
        let envelope: APIEnvelope<ProgressRecord> = try await fetch("/video/\(lessonID)/progress", token: token)
        return envelope.data
    }
    private func fetch<T: Decodable>(_ path: String, token: String? = nil, method: String = "GET", body: Data? = nil, contentType: String = "application/json") async throws -> APIEnvelope<T> {
        guard path.hasPrefix("/"), !path.contains(".."), !path.contains("://"),
              let url = URL(string: baseURL.absoluteString + path),
              url.host == baseURL.host else { throw APIError.invalidResponse }
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        request.setValue("ios", forHTTPHeaderField: "x-client-platform")
        if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        if http.statusCode == 401 { throw APIError.sessionExpired }
        if http.statusCode == 403 { throw APIError.denied }
        if http.statusCode == 429 { throw APIError.service("请求较多，请稍后重试。") }
        guard (200..<300).contains(http.statusCode) else {
            let failure = try? JSONDecoder().decode(APIEnvelope<Empty>.self, from: data)
            throw APIError.service(failure?.message ?? failure?.error ?? "请求失败（\(http.statusCode)），请稍后重试。")
        }
        let envelope = try JSONDecoder().decode(APIEnvelope<T>.self, from: data)
        guard envelope.success else { throw APIError.service(envelope.message ?? envelope.error ?? "请求未完成。") }
        return envelope
    }
    /// Management login is separate from member sessions and does not save the password.
    public func staffLogin(username: String, password: String) async throws -> StaffLogin {
        var request = URLRequest(url: StaffPolicy.apiBase.appendingPathComponent("login"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("ios", forHTTPHeaderField: "x-client-platform")
        request.httpBody = try JSONSerialization.data(withJSONObject: ["username": username, "password": password])
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        guard (200..<300).contains(http.statusCode) else {
            let failure = try? JSONDecoder().decode(JSONValue.self, from: data)
            throw APIError.service(failure?.firstText("error", "message") ?? "管理账号登录失败")
        }
        let result = try JSONDecoder().decode(StaffLogin.self, from: data)
        guard !result.token.isEmpty, StaffPolicy.allows(result.user.role) else { throw APIError.denied }
        return result
    }

    public func staffMusic(id: Int, token: String) async throws -> Data {
        guard let url = StaffPolicy.musicURL(id) else { throw APIError.invalidResponse }
        var request = URLRequest(url: url)
        request.setValue("Bearer " + token, forHTTPHeaderField: "Authorization")
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse else { throw APIError.invalidResponse }
        if http.statusCode == 401 { throw APIError.sessionExpired }
        if http.statusCode == 403 { throw APIError.denied }
        guard http.statusCode == 200, data.count <= 64 * 1024 * 1024,
              http.mimeType?.hasPrefix("audio/") == true else { throw APIError.service("音乐文件暂时无法播放") }
        return data
    }

}
