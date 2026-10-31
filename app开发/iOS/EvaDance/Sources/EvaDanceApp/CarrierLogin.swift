import Foundation
import EvaCore
struct CarrierAvailability: Decodable { let oneTapLogin: Bool? }
#if os(iOS)
import UIKit
import SwiftUI
#if canImport(ATAuthSDK)
import ATAuthSDK
#endif
@MainActor final class CarrierLogin {
    static let shared = CarrierLogin()
    static var componentAvailable: Bool {
        #if canImport(ATAuthSDK)
        return true
        #else
        return false
        #endif
    }
    static var configured: Bool { sdkSecret != nil }
    private static var sdkSecret: String? {
        guard let url = Bundle.main.url(forResource: "NumberAuth.local", withExtension: "plist"),
              let data = try? Data(contentsOf: url),
              let config = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: String],
              config["bundleID"] == Bundle.main.bundleIdentifier,
              let secret = config["sdkSecret"], !secret.isEmpty else { return nil }
        return secret
    }
    func cancel() { finish(.failure(CancellationError())) }
    private var pending: CheckedContinuation<String, Error>?
    private var timeoutTask: Task<Void, Never>?
    private var attempt = UUID()
    func token() async throws -> String {
        #if targetEnvironment(simulator)
        throw APIError.service("本机号码登录需要插有 SIM 卡的 iPhone，请在模拟器中使用短信登录。")
        #elseif canImport(ATAuthSDK)
        guard pending == nil else { throw APIError.service("正在获取本机号码，请稍候。") }
        guard let secret = Self.sdkSecret else {
            throw APIError.service("本机号码登录配置未就绪，请使用短信登录。")
        }
        guard let scene = UIApplication.shared.connectedScenes.first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene,
              var controller = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController else {
            throw APIError.service("请返回登录页后重试。")
        }
        while let presented = controller.presentedViewController { controller = presented }
        try Task.checkCancellation()
        let request = UUID(); attempt = request
        return try await withTaskCancellationHandler(operation: {
          try await withCheckedThrowingContinuation { continuation in
            pending = continuation
            timeoutTask = Task {
                do { try await Task.sleep(nanoseconds: 20_000_000_000) } catch { return }
                guard self.attempt == request else { return }
                self.finish(.failure(APIError.service("号码认证超时，请重试或使用短信登录。")))
            }
            TXCommonHandler.sharedInstance().setAuthSDKInfo(secret) { result in
                Task { @MainActor in
                    guard self.pending != nil, self.attempt == request else { return }
                    guard result["resultCode"] as? String == "600000" else {
                        self.finish(.failure(APIError.service("号码认证初始化失败，请使用短信登录。"))); return
                    }
                    let model = TXCustomModel()
                    let accent = UIColor(EvaBrand.red)
                    model.navTitle = NSAttributedString(string: "SWOD 本机号码登录", attributes: [.foregroundColor: UIColor.label])
                    model.navColor = .systemBackground
                    if let logo = UIImage(named: "BrandLogo") {
                        model.logoImage = UIGraphicsImageRenderer(size: CGSize(width: 80, height: 80)).image { context in
                            UIColor.white.setFill(); context.fill(CGRect(x: 0, y: 0, width: 80, height: 80))
                            logo.draw(in: CGRect(x: 6, y: 6, width: 68, height: 68))
                        }
                    }
                    model.loginBtnText = NSAttributedString(string: "本机号码一键登录", attributes: [.foregroundColor: UIColor(EvaBrand.onAccent), .font: UIFont.preferredFont(forTextStyle: .headline)])
                    model.changeBtnTitle = NSAttributedString(string: "使用短信验证登录", attributes: [.foregroundColor: accent])
                    model.privacyColors = [.secondaryLabel, accent]
                    model.loginBtnBgImgs = [accent, .systemGray4, accent.withAlphaComponent(0.85)].map { color in
                        UIGraphicsImageRenderer(size: CGSize(width: 1, height: 1)).image { context in
                            color.setFill(); context.fill(CGRect(x: 0, y: 0, width: 1, height: 1))
                        }
                    }
                    model.checkBoxIsChecked = false
                    model.privacyOne = ["隐私政策", "https://www.swod.com.cn/privacy"]
                    model.privacyTwo = ["服务条款", "https://www.swod.com.cn/terms"]
                    TXCommonHandler.sharedInstance().getLoginToken(withTimeout: 8, controller: controller, model: model) { result in
                        Task { @MainActor in
                            guard self.pending != nil, self.attempt == request else { return }
                            switch CarrierTokenEvent.parse(code: result["resultCode"] as? String ?? "", token: result["token"] as? String) {
                            case .token(let token): self.finish(.success(token))
                            case .cancelled: self.finish(.failure(CancellationError()))
                            case .progress: break
                            case .failed: self.finish(.failure(APIError.service("暂时无法获取本机号码，请使用短信验证登录。")))
                            }
                        }
                    }
                }
            }
          }
        }, onCancel: {
            Task { @MainActor in
                guard self.attempt == request else { return }
                self.finish(.failure(CancellationError()))
            }
        })
        #else
        throw APIError.service("当前构建不含号码认证组件，请使用短信登录。")
        #endif
    }
    private func finish(_ result: Result<String, Error>) {
        guard let continuation = pending else { return }
        pending = nil
        timeoutTask?.cancel(); timeoutTask = nil
        attempt = UUID()
        #if canImport(ATAuthSDK)
        TXCommonHandler.sharedInstance().cancelLoginVC(animated: true, complete: nil)
        #endif
        continuation.resume(with: result)
    }
}
#endif
