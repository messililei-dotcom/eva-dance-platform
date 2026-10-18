import Foundation
import EvaCore
struct CarrierAvailability: Decodable { let oneTapLogin: Bool? }
#if os(iOS)
import UIKit
#if canImport(ATAuthSDK)
import ATAuthSDK
#endif
@MainActor final class CarrierLogin {
    static let shared = CarrierLogin()
    private var pending: CheckedContinuation<String, Error>?
    func token() async throws -> String {
        #if targetEnvironment(simulator)
        throw APIError.service("本机号码登录需要插有 SIM 卡的 iPhone，请在模拟器中使用短信登录。")
        #elseif canImport(ATAuthSDK)
        guard pending == nil else { throw APIError.service("正在获取本机号码，请稍候。") }
        guard let url = Bundle.main.url(forResource: "NumberAuth.local", withExtension: "plist"),
              let data = try? Data(contentsOf: url),
              let config = try? PropertyListSerialization.propertyList(from: data, format: nil) as? [String: String],
              config["bundleID"] == Bundle.main.bundleIdentifier,
              let secret = config["sdkSecret"], !secret.isEmpty else {
            throw APIError.service("本机号码登录配置未就绪，请使用短信登录。")
        }
        guard let scene = UIApplication.shared.connectedScenes.first(where: { $0.activationState == .foregroundActive }) as? UIWindowScene,
              var controller = scene.windows.first(where: { $0.isKeyWindow })?.rootViewController else {
            throw APIError.service("请返回登录页后重试。")
        }
        while let presented = controller.presentedViewController { controller = presented }
        return try await withCheckedThrowingContinuation { continuation in
            pending = continuation
            TXCommonHandler.sharedInstance().setAuthSDKInfo(secret) { result in
                Task { @MainActor in
                    guard self.pending != nil else { return }
                    guard result["resultCode"] as? String == "600000" else {
                        self.finish(.failure(APIError.service("号码认证初始化失败，请使用短信登录。"))); return
                    }
                    let model = TXCustomModel()
                    model.navTitle = NSAttributedString(string: "本机号码登录")
                    model.loginBtnText = NSAttributedString(string: "一键登录")
                    model.checkBoxIsChecked = false
                    model.privacyOne = ["隐私政策", "https://www.swod.com.cn/privacy"]
                    model.privacyTwo = ["服务条款", "https://www.swod.com.cn/terms"]
                    TXCommonHandler.sharedInstance().getLoginToken(withTimeout: 8, controller: controller, model: model) { result in
                        Task { @MainActor in
                            let code = result["resultCode"] as? String ?? ""
                            if code == "600000", let token = result["token"] as? String, !token.isEmpty {
                                self.finish(.success(token))
                            } else if ["700000", "700001"].contains(code) {
                                self.finish(.failure(CancellationError()))
                            } else if code == "600001" || code.hasPrefix("700") {
                                // Presentation, checkbox and agreement events are not a login result.
                            } else {
                                self.finish(.failure(APIError.service("暂时无法获取本机号码，请使用短信验证码登录。")))
                            }
                        }
                    }
                }
            }
        }
        #else
        throw APIError.service("当前构建不含号码认证组件，请使用短信登录。")
        #endif
    }
    private func finish(_ result: Result<String, Error>) {
        guard let continuation = pending else { return }
        pending = nil
        #if canImport(ATAuthSDK)
        TXCommonHandler.sharedInstance().cancelLoginVC(animated: true, complete: nil)
        #endif
        continuation.resume(with: result)
    }
}
#endif
