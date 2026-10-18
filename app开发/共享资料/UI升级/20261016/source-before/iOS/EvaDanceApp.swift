import SwiftUI
import EvaCore

@main struct EvaDanceApp: App {
    @StateObject private var session = Session()
    var body: some Scene {
        WindowGroup {
            MainTabs().id(session.accountID ?? 0)
            .sheet(isPresented: $session.showLogin) { LoginView().environmentObject(session) }
            .environmentObject(session)
            .safeAreaInset(edge: .top) {
                if session.isFixture { Text("本地测试数据 · 非真实课程").font(.caption).frame(maxWidth: .infinity).padding(6).background(.yellow.opacity(0.25)) }
            }
            .tint(Color(red: 0.62, green: 0.11, blue: 0.13))
            .alert("提示", isPresented: Binding(get: { session.error != nil }, set: { if !$0 { session.error = nil } })) {
                Button("知道了") { session.error = nil }
            } message: { Text(session.error ?? "") }
        }
    }
}
struct LoginView: View {
    @EnvironmentObject var session: Session
    @State private var phone = ""
    @State private var code = ""
    @State private var agreed = false
    @State private var busy = false
    @State private var sentAt: Date?
    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Image("BrandLogo").resizable().scaledToFit().frame(width: 88, height: 88)
                        .accessibilityLabel("伊娃东方舞 SWOD 标志")
                    Text("伊娃东方舞").font(.largeTitle.bold())
                    Text("让每一次练习都有收获").foregroundStyle(.secondary)
                }
                #if os(iOS)
                Section {
                    Button(busy ? "处理中…" : "本机号码一键登录") {
                        perform {
                            let availability: CarrierAvailability = try await session.transport.request("/config")
                            guard availability.oneTapLogin == true else { throw APIError.service("本机号码登录暂未开放，请使用短信验证码。") }
                            let token = try await CarrierLogin.shared.token()
                            try await session.loginWithCarrier(token: token)
                        }
                    }.disabled(busy || !agreed)
                    Text("请先勾选下方协议；不支持时可使用短信验证码登录。").font(.caption).foregroundStyle(.secondary)
                }
                #endif
                Section("手机号登录") {
                    TextField("请输入手机号", text: $phone).textContentType(.telephoneNumber)
                    TextField("短信验证码", text: $code).textContentType(.oneTimeCode)
                    TimelineView(.periodic(from: .now, by: 1)) { context in
                        let remaining = max(0, 60 - Int(context.date.timeIntervalSince(sentAt ?? .distantPast)))
                        Button(remaining > 0 ? "\(remaining) 秒后重发" : "获取验证码") {
                            perform {
                                let body = try JSONSerialization.data(withJSONObject: ["phone": phone])
                                let _: Empty = try await session.api.request("/send-code", method: "POST", body: body)
                                sentAt = .now
                            }
                        }.disabled(busy || !validPhone || !agreed || remaining > 0)
                    }
                    Toggle("我已阅读并同意服务条款和隐私政策", isOn: $agreed)
                    Link("隐私政策", destination: URL(string: "https://www.swod.com.cn/privacy")!)
                    Link("服务条款", destination: URL(string: "https://www.swod.com.cn/terms")!)
                    Button(busy ? "处理中…" : "登录并开始学习") {
                        perform { try await session.login(phone: phone, code: code) }
                    }.disabled(busy || !agreed || !validPhone || code.isEmpty)
                }
            }.evaCompactLayout().navigationTitle("欢迎回来")
        }
    }
    private var validPhone: Bool { phone.range(of: "^1[0-9]{10}$", options: .regularExpression) != nil }
    private func perform(_ operation: @escaping () async throws -> Void) {
        busy = true
        Task { defer { busy = false }; do { try await operation() } catch is CancellationError {} catch { session.handle(error) } }
    }
}
struct MainTabs: View {
    @StateObject private var cart = ShoppingCart()
    @State private var selected = 0
    var body: some View {
        Group {
        #if os(macOS)
        VStack(spacing: 0) {
            Picker("导航", selection: $selected) {
                Text("线上学院").tag(0); Text("线下课").tag(1); Text("赛事").tag(2); Text("商城").tag(3); Text("个人中心").tag(4)
            }.pickerStyle(.segmented).padding()
            NavigationStack { selectedContent }.id(selected)
        }
        #else
        TabView {
            NavigationStack { DiscoverView() }.tabItem { Label("线上学院", systemImage: "play.rectangle") }
            NavigationStack { OfflineView() }.tabItem { Label("线下课", systemImage: "calendar") }
            NavigationStack { EventsView() }.tabItem { Label("赛事", systemImage: "trophy") }
            NavigationStack { ShopView() }.tabItem { Label("商城", systemImage: "bag") }
            NavigationStack { AccountView() }.tabItem { Label("个人中心", systemImage: "person.crop.circle") }
        }
        #endif
        }.environmentObject(cart)
    }
    @ViewBuilder private var selectedContent: some View {
        switch selected {
        case 1: OfflineView()
        case 2: EventsView()
        case 3: ShopView()
        case 4: AccountView()
        default: DiscoverView()
        }
    }
}
struct CoursesView: View {
    @EnvironmentObject var session: Session
    @State private var series: [Series] = []
    @State private var recent: [RecentLesson] = []
    @State private var loading = false
    var body: some View {
        List {
            if loading { ProgressView("正在加载课程") }
            if !recent.isEmpty {
                Section("继续学习") {
                    ForEach(recent) { item in
                        NavigationLink { PlayerView(lessonID: item.video_id, title: item.course_name) } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                Text(item.course_name).font(.headline)
                                Text(item.series_name ?? "").font(.subheadline).foregroundStyle(.secondary)
                            }.padding(.vertical, 6)
                        }
                    }
                }
            }
            Section("我的课程") {
                ForEach(series) { item in
                    NavigationLink(item.series_name) { CatalogView(series: item) }
                }
                if !loading && series.isEmpty { Text("暂无已授权课程，下拉刷新查看最新内容。").foregroundStyle(.secondary) }
            }
        }.evaCompactLayout().navigationTitle("线上学院")
        .toolbar { Button("刷新") { Task { await load() } }.disabled(loading) }
        .task { await load() }.refreshable { await load() }
    }
    private func load() async {
        guard let token = session.token else { return }; loading = true; defer { loading = false }
        do {
            async let courses: [Series] = session.api.request("/member/authorized-series", token: token)
            async let records: [RecentLesson] = session.api.request("/member/recent-courses", token: token)
            (series, recent) = try await (courses, records)
        } catch { session.handle(error) }
    }
}
struct CatalogView: View {
    @EnvironmentObject var session: Session
    let series: Series
    @State private var units: [CourseUnit] = []
    @State private var loading = true
    var body: some View {
        List {
            if loading { ProgressView("加载课程目录") }
            ForEach(units) { unit in
                Section(unit.name) {
                    ForEach(unit.videos) { lesson in
                        // The current mini-program catalog uses the edited OnlineCourse name.
                        NavigationLink(unit.videos.count == 1 ? unit.name : "\(unit.name) · \(lesson.name)") {
                            PlayerView(lessonID: lesson.id, title: unit.name, playlist: units.flatMap { $0.videos })
                        }
                    }
                }
            }
            if !loading && units.isEmpty { Text("暂无可展示的课节") }
        }.evaCompactLayout().navigationTitle(series.series_name).task { await load() }.refreshable { await load() }
    }
    private func load() async {
        loading = true; defer { loading = false }
        do { units = try await session.api.request("/public/series/\(series.id)/courses", token: session.token) }
        catch { session.handle(error) }
    }
}
struct MessagesView: View {
    @EnvironmentObject var session: Session
    @State private var items: [InboxMessage] = []
    @State private var cursor = 0
    @State private var more = false
    @State private var busy = false
    var body: some View {
        List {
            ForEach(items) { item in
                NavigationLink {
                    ScrollView { VStack(alignment: .leading, spacing: 16) {
                        Text(item.title).font(.title2.bold())
                        Text(item.createdAt).font(.caption).foregroundStyle(.secondary)
                        Text(item.content).textSelection(.enabled)
                    }.padding() }
                    .task {
                        do {
                            let _: Empty = try await session.api.request("/member/messages/\(item.recipientId)/read", token: session.token, method: "PATCH", body: Data("{}".utf8))
                        } catch { session.handle(error) }
                    }
                } label: { VStack(alignment: .leading) { Text(item.title).font(.headline); Text(item.content).lineLimit(2).foregroundStyle(.secondary) } }
            }
            if more { Button("加载更多") { Task { await load(reset: false) } }.disabled(busy) }
            if busy { ProgressView() }
            if !busy && items.isEmpty { Text("暂无消息") }
        }.evaCompactLayout().navigationTitle("学习消息").task { await load(reset: true) }.refreshable { await load(reset: true) }
    }
    private func load(reset: Bool) async {
        guard !busy else { return }; busy = true; defer { busy = false }
        do {
            let result: InboxPage = try await session.api.request("/member/messages?limit=20&cursor=\(reset ? 0 : cursor)", token: session.token)
            if reset { items = result.items } else {
                let existing = Set(items.map(\.id)); items += result.items.filter { !existing.contains($0.id) }
            }
            cursor = result.nextCursor; more = result.hasMore
        } catch { session.handle(error) }
    }
}
struct ProfileView: View {
    @EnvironmentObject var session: Session
    @State private var confirmLogout = false
    var body: some View {
        List {
            Section("学习服务") { NavigationLink("我的证书") { CertificatesView() } }
            Section("关于") {
                Link("隐私政策", destination: URL(string: "https://www.swod.com.cn/privacy")!)
                Link("服务条款", destination: URL(string: "https://www.swod.com.cn/terms")!)
                Text("伊娃东方舞 1.0.0")
            }
            Button("退出登录", role: .destructive) { confirmLogout = true }
        }.evaCompactLayout().navigationTitle("个人中心")
        .confirmationDialog("退出当前账号？", isPresented: $confirmLogout) {
            Button("退出登录", role: .destructive) { session.logout() }
        }
    }
}
struct CertificatesView: View {
    @EnvironmentObject var session: Session
    @State private var items: [Certificate] = []
    @State private var loading = true
    var body: some View {
        List {
            if loading { ProgressView() }
            ForEach(items) { item in
                VStack(alignment: .leading, spacing: 8) {
                    Text(item.courseName).font(.headline)
                    Text(item.certificateNo).font(.caption)
                    if let name = item.memberName, !name.isEmpty { Text("持证人：\(name)") }
                    Text("\(item.issueDate) · \(item.status == "active" ? "有效" : item.status)")
                    if item.status == "active", let raw = item.pdfUrl, let url = AppPolicy.certificatePreviewURL(raw) { Link("查看电子证书", destination: url) }
                    if let url = AppPolicy.certificateURL(item.verifyUrl) { Link("查看证书验证结果", destination: url) }
                }.padding(.vertical, 6)
            }
            if !loading && items.isEmpty { Text("暂无已颁发证书") }
        }.evaCompactLayout().navigationTitle("我的证书").task { await load() }.refreshable { await load() }
    }
    private func load() async {
        loading = true; defer { loading = false }
        do { items = try await session.api.request("/certificates", token: session.token) }
        catch { session.handle(error) }
    }
}
