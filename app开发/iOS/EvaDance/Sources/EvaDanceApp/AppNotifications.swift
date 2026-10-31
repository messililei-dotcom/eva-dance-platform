import SwiftUI
import EvaCore
#if os(iOS)
import UIKit
import UserNotifications
#if canImport(CloudPushSDK)
import CloudPushSDK
#endif
#endif

struct MessageDestination: Identifiable { let id: String }
struct UnreadMessages: Decodable { let count: Int }

@MainActor final class AppNotifications: ObservableObject {
    @Published private(set) var unread = 0
    @Published var destination: MessageDestination?
    @Published var notice: String?
    @Published private(set) var permission = "未开启"
    @Published private(set) var remoteReady = false
    private weak var session: Session?
    private var account: Int?
    private var sessionID: String?
    private var didLoad = false
    private var deviceID = ""
    private var registering = false
    private var sdkStarted = false
    private let installation: String = {
        let key = "swod.push.installation"
        if let value = UserDefaults.standard.string(forKey: key), value.count == 64 { return value }
        let value = UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased() + UUID().uuidString.replacingOccurrences(of: "-", with: "").lowercased()
        UserDefaults.standard.set(value, forKey: key); return value
    }()
    func attach(_ session: Session) { self.session = session }
    func revoke(sessionID: String?) {
        guard let sessionID, !sessionID.isEmpty else { return }
        let prior = UserDefaults.standard.stringArray(forKey: "swod.push.pending-revocations") ?? []
        UserDefaults.standard.set(Array(Set(prior + [sessionID])).suffix(20).map { $0 }, forKey: "swod.push.pending-revocations")
        Task { await flushRevocations() }
    }
    private func flushRevocations() async {
        guard let session else { return }
        for id in UserDefaults.standard.stringArray(forKey: "swod.push.pending-revocations") ?? [] {
            do {
                let body = try JSONSerialization.data(withJSONObject: ["installationId": installation, "pushSessionId": id])
                let _: Empty = try await session.transport.request("/push/unbind", method: "POST", body: body)
                let remaining = (UserDefaults.standard.stringArray(forKey: "swod.push.pending-revocations") ?? []).filter { $0 != id }
                UserDefaults.standard.set(remaining, forKey: "swod.push.pending-revocations")
            } catch { return }
        }
    }
    func reset() {
        unread = 0; destination = nil; notice = nil; account = nil; sessionID = nil; didLoad = false
        #if os(iOS)
        UNUserNotificationCenter.current().removeAllDeliveredNotifications()
        UIApplication.shared.applicationIconBadgeNumber = 0
        #endif
    }
    func refresh() async {
        await flushRevocations()
        guard let session, let member = session.accountID, let token = session.token else { reset(); return }
        if account != member || sessionID != session.credentials?.sessionId { reset(); account = member; sessionID = session.credentials?.sessionId }
        let binding = sessionID
        do {
            let result: UnreadMessages = try await session.api.request("/member/messages/unread-count", token: token)
            guard session.accountID == member, session.credentials?.sessionId == binding else { return }
            let count = max(0, result.count)
            if didLoad && count > unread { notice = "你有新的学习消息" }
            unread = count; didLoad = true
            #if os(iOS)
            UIApplication.shared.applicationIconBadgeNumber = count
            let settings = await UNUserNotificationCenter.current().notificationSettings()
            guard session.accountID == member else { return }
            permission = settings.authorizationStatus == .denied ? "系统通知已关闭" : settings.authorizationStatus == .notDetermined ? "未开启" : "系统通知已允许"
            if settings.authorizationStatus == .denied && !deviceID.isEmpty { revoke(sessionID: binding); deviceID = "" }
            if settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional { await registerRemote() }
            #endif
        } catch { /* Keep the last successful count; the message list has an explicit retry action. */ }
    }
    func enable() async {
        guard session?.token != nil else { session?.showLogin = true; return }
        #if os(iOS)
        do {
            let config: JSONValue = try await session!.api.request("/config")
            remoteReady = config["push"]["enabled"].bool
            guard remoteReady else { notice = "系统通知正在配置中，学习消息可在 App 内查看。"; return }
            let center = UNUserNotificationCenter.current()
            if try await center.requestAuthorization(options: [.alert, .badge, .sound]) { await registerRemote() }
            else { permission = "系统通知已关闭"; notice = "可前往系统设置开启通知；App 内消息继续保留。" }
        } catch { session?.handle(error) }
        #else
        notice = "请在 iPhone 或 iPad 上设置系统通知。"
        #endif
    }
    #if os(iOS)
    private func registerRemote() async {
        guard let session, !session.isFixture, !registering, session.token != nil else { return }
        registering = true; defer { registering = false }
        let member = session.accountID, binding = session.credentials?.sessionId
        do {
            let config: JSONValue = try await session.api.request("/config")
            remoteReady = config["push"]["enabled"].bool
            guard remoteReady, session.accountID == member, session.credentials?.sessionId == binding else { return }
            let permit = try JSONSerialization.data(withJSONObject: ["installationId": installation])
            let _: Empty = try await session.api.request("/push/permits", token: session.token, method: "POST", body: permit)
            guard session.accountID == member, session.credentials?.sessionId == binding else { return }
            #if canImport(CloudPushSDK)
            if !sdkStarted {
                guard let url = Bundle.main.url(forResource: "Push.local", withExtension: "plist"), let data = try? Data(contentsOf: url), let values = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: String], let key = values["appKey"], let secret = values["appSecret"], !key.isEmpty, !secret.isEmpty else { notice = "通知配置尚未完成"; return }
                let started: Bool = await withCheckedContinuation { continuation in
                    CloudPushSDK.setLogLevel(.none)
                    CloudPushSDK.start(withAppkey: key, appSecret: secret) { result in continuation.resume(returning: result.success) }
                }
                guard started else { notice = "通知连接失败，请稍后重试"; return }; sdkStarted = true
            }
            deviceID = CloudPushSDK.getDeviceId() ?? ""
            UIApplication.shared.registerForRemoteNotifications()
            guard !deviceID.isEmpty, session.accountID == member, session.credentials?.sessionId == binding else { return }
            let body = try JSONSerialization.data(withJSONObject: ["installationId": installation, "deviceId": deviceID, "enabled": true])
            let _: Empty = try await session.api.request("/push/devices", token: session.token, method: "PUT", body: body)
            #else
            remoteReady = false
            #endif
        } catch { notice = "通知连接暂不可用，可在 App 内查看消息。" }
    }
    #endif
    func open(recipientID: String) {
        guard recipientID.range(of: "^[1-9][0-9]{0,15}$", options: .regularExpression) != nil, session?.token != nil else { return }
        destination = MessageDestination(id: recipientID)
        Task { await refresh() }
    }
    func clearAll() async {
        guard let session, let member = session.accountID else { return }
        do {
            let _: Empty = try await session.api.request("/member/messages/read-all", token: session.token, method: "POST", body: Data("{}".utf8))
            guard session.accountID == member else { return }
            #if os(iOS)
            UNUserNotificationCenter.current().removeAllDeliveredNotifications()
            #endif
            await refresh()
        } catch { session.handle(error) }
    }
}
