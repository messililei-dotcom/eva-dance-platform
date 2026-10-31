import SwiftUI
import EvaCore

@MainActor final class LoginState: ObservableObject {
    @Published var phone = ""
    @Published var code = ""
    @Published var password = ""
    @Published var method: LoginMethod = .sms
    @Published var agreed = false
    @Published private(set) var operation: Operation?
    @Published private(set) var error: String?
    @Published private(set) var notice: String?
    @Published private(set) var carrierStatus: CarrierStatus = .checking
    @Published private(set) var sentDates: [String: Date] = [:]
    var methodChosen = false
    private var work: Task<Void, Never>?
    private var attempt = UUID()
    enum Operation { case sendCode, sms, password, carrier }
    enum CarrierStatus { case checking, ready, simulator, unavailable, unconfigured, missingComponent, failed }
    var busy: Bool { operation != nil }
    var canSubmit: Bool {
        LoginInputPolicy.canSubmit(method, phone: phone, code: code, password: password,
                                  agreed: agreed, busy: busy, carrierReady: carrierStatus == .ready)
    }
    var carrierMessage: String {
        switch carrierStatus {
        case .checking: return "正在检查本机号码登录是否可用…"
        case .ready: return "无需填写手机号和验证码，在运营商授权页确认后即可登录。"
        case .simulator: return "模拟器无法进行 SIM 卡认证，请使用短信验证或账号密码登录。"
        case .unavailable: return "本机号码登录暂未开放，请使用短信验证或账号密码登录。"
        case .unconfigured, .missingComponent: return "此版本暂不支持本机号码登录，请使用短信验证或账号密码登录。"
        case .failed: return "暂时无法检查登录服务，可重新检查，或使用短信验证、账号密码登录。"
        }
    }
    func refreshCarrier(session: Session) async {
        carrierStatus = .checking
        do {
            let config: CarrierAvailability = try await session.transport.request("/config")
            try Task.checkCancellation()
            #if os(iOS)
            #if targetEnvironment(simulator)
            carrierStatus = .simulator
            #else
            if !CarrierLogin.componentAvailable { carrierStatus = .missingComponent }
            else if !CarrierLogin.configured { carrierStatus = .unconfigured }
            else { carrierStatus = config.oneTapLogin == true ? .ready : .unavailable }
            #endif
            #else
            carrierStatus = .missingComponent
            #endif
            if carrierStatus == .ready && !methodChosen && phone.isEmpty { method = .carrier }
        } catch is CancellationError {} catch { carrierStatus = .failed }
    }
    func phoneChanged() { code = ""; error = nil; notice = nil }
    func methodChanged() { methodChosen = true; password = ""; error = nil; notice = nil }
    func resendSeconds(now: Date) -> Int {
        LoginInputPolicy.resendSeconds(sentAt: sentDates[LoginInputPolicy.phone(phone)], now: now)
    }
    func sendCode(session: Session) {
        guard agreed, !busy, LoginInputPolicy.validPhone(phone), resendSeconds(now: .now) == 0 else { return }
        let target = LoginInputPolicy.phone(phone)
        perform(.sendCode) {
            let body = try JSONSerialization.data(withJSONObject: ["phone": target])
            let _: Empty = try await session.transport.request("/send-code", method: "POST", body: body)
            try Task.checkCancellation()
            self.sentDates[target] = .now
            self.notice = "验证码已发送，请查收短信。"
        }
    }
    func submit(session: Session) {
        guard canSubmit else { return }
        let phone = LoginInputPolicy.phone(phone), code = LoginInputPolicy.code(code), secret = password
        switch method {
        case .sms: perform(.sms) { try await session.login(phone: phone, code: code) }
        case .password: perform(.password) {
            defer { self.password = "" }
            try await session.loginWithPassword(phone: phone, password: secret)
        }
        case .carrier:
            perform(.carrier) {
                #if os(iOS)
                // Recheck service before asking the user to authorize their SIM number.
                let config: CarrierAvailability = try await session.transport.request("/config")
                guard config.oneTapLogin == true else {
                    self.carrierStatus = .unavailable
                    throw APIError.service("本机号码登录暂未开放，请改用短信验证。")
                }
                let token = try await CarrierLogin.shared.token()
                try Task.checkCancellation()
                try await session.loginWithCarrier(token: token)
                #else
                throw APIError.service("当前设备不支持本机号码登录。")
                #endif
            }
        }
    }
    func cancel() {
        attempt = UUID(); work?.cancel(); work = nil; operation = nil; password = ""; code = ""
        #if os(iOS)
        CarrierLogin.shared.cancel()
        #endif
    }
    private func perform(_ kind: Operation, operation action: @escaping () async throws -> Void) {
        guard !busy else { return }
        let request = UUID(); attempt = request
        operation = kind; error = nil; notice = nil
        work = Task {
            defer { if self.attempt == request { self.operation = nil; self.work = nil } }
            do { try await action() }
            catch is CancellationError {
                if self.attempt == request && kind == .carrier {
                    self.method = .sms
                    self.notice = "已取消本机号码登录，可使用短信验证。"
                }
            } catch {
                guard self.attempt == request else { return }
                if case APIError.sessionExpired = error {
                    self.error = kind == .password ? "手机号或密码不正确，可切换短信验证登录。" : "验证未通过或已过期，请重新验证。"
                } else { self.error = error.localizedDescription }
            }
        }
    }
}
