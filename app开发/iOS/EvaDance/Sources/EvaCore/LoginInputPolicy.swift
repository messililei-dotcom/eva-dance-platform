import Foundation

public enum LoginMethod: String, CaseIterable, Identifiable {
    case carrier, sms, password
    public var id: String { rawValue }
    public var title: String {
        switch self {
        case .carrier: return "一键登录"
        case .sms: return "短信验证"
        case .password: return "账号密码"
        }
    }
}

public enum LoginInputPolicy {
    public static func phone(_ input: String) -> String {
        let compact = input.filter { !$0.isWhitespace && $0 != "-" }
        return compact.hasPrefix("+86") ? String(compact.dropFirst(3)) : compact
    }
    public static func validPhone(_ input: String) -> Bool {
        phone(input).range(of: "^1[0-9]{10}$", options: .regularExpression) != nil
    }
    public static func code(_ input: String) -> String { input.trimmingCharacters(in: .whitespacesAndNewlines) }
    public static func validCode(_ input: String) -> Bool {
        code(input).range(of: "^[0-9]{6}$", options: .regularExpression) != nil
    }
    public static func canSubmit(_ method: LoginMethod, phone: String, code: String, password: String,
                                 agreed: Bool, busy: Bool, carrierReady: Bool) -> Bool {
        guard agreed && !busy else { return false }
        switch method {
        case .carrier: return carrierReady
        case .sms: return validPhone(phone) && validCode(code)
        case .password: return validPhone(phone) && !password.isEmpty
        }
    }
    public static func resendSeconds(sentAt: Date?, now: Date) -> Int {
        guard let sentAt else { return 0 }
        return max(0, min(60, Int(ceil(60 - now.timeIntervalSince(sentAt)))))
    }
}

/// SDK page/checkbox events must never create a member session.
/// https://help.aliyun.com/zh/pnvs/developer-reference/error-code-2/
public enum CarrierTokenEvent: Equatable {
    case token(String), cancelled, progress, failed
    public static func parse(code: String, token: String?) -> Self {
        if code == "600000" {
            guard let token, (16...8192).contains(token.utf8.count), token.rangeOfCharacter(from: .whitespacesAndNewlines) == nil else { return .failed }
            return .token(token)
        }
        if ["700000", "700001", "700010", "700020"].contains(code) { return .cancelled }
        if ["600001", "700002", "700003", "700004", "700006", "700007", "700008", "700009"].contains(code) { return .progress }
        return .failed
    }
}
