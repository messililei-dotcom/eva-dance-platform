import SwiftUI
import EvaCore

struct LoginView: View {
    @EnvironmentObject private var session: Session
    @Environment(\.dismiss) private var dismiss
    @StateObject private var state = LoginState()
    @State private var showPassword = false
    @FocusState private var focused: Field?
    private enum Field { case phone, code, password }
    private enum Layout {
        static let fieldHeight: CGFloat = 48
        static let contentWidth: CGFloat = 440
    }
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    header
                    loginCard
                    Button("返回") { close() }
                        .font(.subheadline).padding(.horizontal, 24).frame(minHeight: 44)
                        .background(EvaBrand.softAccent, in: Capsule())
                        .accessibilityIdentifier("login.return")
                    Text("与官网、小程序共用学习账号")
                        .font(.footnote).foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: Layout.contentWidth)
                .padding(.horizontal, 24).padding(.top, 16).padding(.bottom, 28)
                .frame(maxWidth: .infinity)
            }
            .background(EvaBrand.canvas)
            .scrollDismissesKeyboard(.interactively)
            .evaPageChrome()
            #if os(iOS)
            .navigationBarTitleDisplayMode(.inline)
            #endif
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button { close() } label: {
                        Label("返回", systemImage: "chevron.left").labelStyle(.iconOnly)
                            .frame(minWidth: 44, minHeight: 44)
                    }.accessibilityIdentifier("login.close")
                }
                #if os(iOS)
                ToolbarItemGroup(placement: .keyboard) { Spacer(); Button("完成") { focused = nil } }
                #endif
            }
            .interactiveDismissDisabled(state.busy)
            .task { await state.refreshCarrier(session: session) }
            .onChange(of: state.phone) { _ in state.phoneChanged() }
            .onChange(of: state.method) { _ in state.methodChanged(); showPassword = false; focused = nil }
            .onDisappear { state.password = "" }
        }.tint(EvaBrand.red)
    }
    private func close() { state.cancel(); dismiss() }
    private var header: some View {
        VStack(spacing: 8) {
            Image("BrandLogo").resizable().scaledToFit().frame(width: 64, height: 64)
                .padding(8).background(.white, in: RoundedRectangle(cornerRadius: 18))
                .accessibilityHidden(true)
            Text("伊娃东方舞").font(.title.bold()).accessibilityAddTraits(.isHeader)
            Text("舞者成长系统").font(.subheadline).foregroundStyle(.secondary)
        }.frame(maxWidth: .infinity)
    }
    private var loginCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            carrierButton
            HStack(spacing: 12) {
                Rectangle().fill(Color.secondary.opacity(0.15)).frame(height: 1)
                Text(state.method == .password ? "或使用账号密码登录" : "或使用验证码登录")
                    .font(.footnote).foregroundStyle(.secondary).fixedSize()
                Rectangle().fill(Color.secondary.opacity(0.15)).frame(height: 1)
            }.accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 8) {
                Text("手机号").font(.subheadline.bold())
                phoneField.focused($focused, equals: .phone)
                    .padding(.horizontal, 14).frame(minHeight: Layout.fieldHeight)
                    .background(EvaBrand.canvas, in: RoundedRectangle(cornerRadius: 12))
                    .accessibilityIdentifier("login.phone")
            }
            if state.method == .password { passwordContent } else { smsContent }
            agreement
            if let error = state.error {
                Label(error, systemImage: "exclamationmark.circle.fill")
                    .font(.footnote).foregroundStyle(EvaBrand.red)
                    .fixedSize(horizontal: false, vertical: true).accessibilityIdentifier("login.error")
            }
            if let notice = state.notice {
                Label(notice, systemImage: "checkmark.circle")
                    .font(.footnote).foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true).accessibilityIdentifier("login.notice")
            }
            submitButton
            VStack(spacing: 2) {
                Text("授权失败时可使用短信验证码登录")
                    .font(.footnote).foregroundStyle(.secondary)
                    .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                Button(state.method == .password ? "使用验证码登录" : "使用账号密码登录") {
                    state.method = state.method == .password ? .sms : .password
                }.font(.footnote).frame(minHeight: 44).disabled(state.busy)
                    .accessibilityIdentifier("login.switchPassword")
            }.frame(maxWidth: .infinity)
        }
        .padding(22).frame(maxWidth: .infinity)
        .background(EvaBrand.surface, in: RoundedRectangle(cornerRadius: 20))
    }
    private var carrierButton: some View {
        VStack(spacing: 8) {
            Button {
                focused = nil
                state.method = .carrier
                state.submit(session: session)
            } label: {
                HStack(spacing: 8) {
                    if state.operation == .carrier { ProgressView().tint(EvaBrand.onAccent) }
                    Text(state.operation == .carrier ? "正在登录…" : "手机号一键登录")
                        .font(.headline).fixedSize(horizontal: false, vertical: true)
                }.frame(maxWidth: .infinity, minHeight: Layout.fieldHeight)
            }
            .buttonStyle(.plain)
            .foregroundStyle(carrierReady ? EvaBrand.onAccent : Color.secondary)
            .background(carrierReady ? EvaBrand.red : EvaBrand.softAccent, in: RoundedRectangle(cornerRadius: 12))
            .disabled(!carrierReady).accessibilityIdentifier("login.carrier")
            if state.carrierStatus != .ready {
                Text(state.carrierMessage).font(.caption).foregroundStyle(.secondary)
                    .multilineTextAlignment(.center).fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("login.carrierStatus")
            } else {
                Text("由运营商验证本机号码，登录前请先同意下方协议")
                    .font(.caption).foregroundStyle(.secondary).multilineTextAlignment(.center)
            }
            if state.carrierStatus == .failed {
                Button("重新检查") { Task { await state.refreshCarrier(session: session) } }
                    .font(.footnote).frame(minHeight: 44).disabled(state.busy)
            }
        }
    }
    private var carrierReady: Bool { state.carrierStatus == .ready && state.agreed && !state.busy }
    private var phoneField: some View {
        TextField("请输入手机号", text: $state.phone).textContentType(.telephoneNumber)
            #if os(iOS)
            .keyboardType(.phonePad).textInputAutocapitalization(.never)
            #endif
            .autocorrectionDisabled().disabled(state.busy)
    }
    private var smsContent: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("验证码").font(.subheadline.bold())
            ViewThatFits(in: .horizontal) {
                HStack(spacing: 10) { codeField; sendCodeButton }
                VStack(alignment: .leading, spacing: 10) { codeField; sendCodeButton }
            }
        }
    }
    private var codeField: some View {
        TextField("请输入验证码", text: $state.code).textContentType(.oneTimeCode)
            #if os(iOS)
            .keyboardType(.numberPad)
            #endif
            .focused($focused, equals: .code).autocorrectionDisabled().disabled(state.busy)
            .padding(.horizontal, 14).frame(minWidth: 100, minHeight: Layout.fieldHeight)
            .background(EvaBrand.canvas, in: RoundedRectangle(cornerRadius: 12))
            .accessibilityIdentifier("login.code")
    }
    private var sendCodeButton: some View {
        TimelineView(.periodic(from: .now, by: 1)) { context in
            let remaining = state.resendSeconds(now: context.date)
            Button {
                focused = nil
                state.sendCode(session: session)
            } label: {
                Text(state.operation == .sendCode ? "发送中…" : remaining > 0 ? "\(remaining) 秒后重发" : "获取验证码")
                    .font(.subheadline.bold()).fixedSize().frame(minWidth: 104, minHeight: Layout.fieldHeight)
            }
            .buttonStyle(.plain).foregroundStyle(EvaBrand.red)
            .padding(.horizontal, 12)
            .background(EvaBrand.softAccent, in: RoundedRectangle(cornerRadius: 12))
            .disabled(state.busy || !state.agreed || !LoginInputPolicy.validPhone(state.phone) || remaining > 0)
            .accessibilityIdentifier("login.sendCode")
        }
    }
    private var passwordContent: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("账号密码").font(.subheadline.bold())
            HStack(spacing: 8) {
                Group {
                    if showPassword { TextField("请输入账号密码", text: $state.password) }
                    else { SecureField("请输入账号密码", text: $state.password) }
                }
                .textContentType(.password)
                #if os(iOS)
                .textInputAutocapitalization(.never)
                #endif
                .autocorrectionDisabled().focused($focused, equals: .password).disabled(state.busy)
                .accessibilityIdentifier("login.password")
                Button(showPassword ? "隐藏密码" : "显示密码", systemImage: showPassword ? "eye.slash" : "eye") {
                    showPassword.toggle(); focused = .password
                }.labelStyle(.iconOnly).frame(width: 44, height: 44).disabled(state.busy)
            }.padding(.horizontal, 14).frame(minHeight: Layout.fieldHeight)
                .background(EvaBrand.canvas, in: RoundedRectangle(cornerRadius: 12))
            Button("忘记密码？使用短信验证登录") { state.method = .sms; focused = .phone }
                .font(.subheadline).frame(minHeight: 44).disabled(state.busy)
        }
    }
    private var agreement: some View {
        HStack(alignment: .center, spacing: 4) {
            Button { state.agreed.toggle() } label: {
                Image(systemName: state.agreed ? "checkmark.circle.fill" : "circle")
                    .font(.title3).foregroundStyle(state.agreed ? EvaBrand.red : .secondary)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain).disabled(state.busy)
            .accessibilityLabel("我已阅读并同意以下协议")
            .accessibilityValue(state.agreed ? "已同意" : "未同意")
            .accessibilityIdentifier("login.consent")
            VStack(alignment: .leading, spacing: 0) {
                Text("我已阅读并同意").font(.footnote).foregroundStyle(.secondary)
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: 8) { policyLinks }
                    VStack(alignment: .leading, spacing: 0) { policyLinks }
                }.font(.footnote)
            }
        }
    }
    @ViewBuilder private var policyLinks: some View {
        Link("《隐私政策》", destination: URL(string: "https://www.swod.com.cn/privacy")!).frame(minHeight: 44).fixedSize(horizontal: true, vertical: false)
        Link("《服务条款》", destination: URL(string: "https://www.swod.com.cn/terms")!).frame(minHeight: 44).fixedSize(horizontal: true, vertical: false)
    }
    private var submitButton: some View {
        let method: LoginMethod = state.method == .password ? .password : .sms
        let enabled = LoginInputPolicy.canSubmit(method, phone: state.phone, code: state.code,
                                                password: state.password, agreed: state.agreed,
                                                busy: state.busy, carrierReady: false)
        return Button {
            focused = nil
            state.method = method
            state.submit(session: session)
        } label: {
            HStack(spacing: 8) {
                if state.busy && state.operation != .sendCode { ProgressView().tint(EvaBrand.onAccent) }
                Text(state.busy && state.operation != .sendCode ? "正在登录…" : method == .password ? "密码登录" : "验证码登录")
                    .font(.headline).fixedSize(horizontal: false, vertical: true)
            }.frame(maxWidth: .infinity, minHeight: Layout.fieldHeight)
        }
        .buttonStyle(.plain)
        .foregroundStyle(enabled ? EvaBrand.onAccent : Color.secondary)
        .background(enabled ? EvaBrand.red : EvaBrand.softAccent, in: RoundedRectangle(cornerRadius: 12))
        .disabled(!enabled).accessibilityIdentifier("login.submit")
    }
}
