import SwiftUI
import EvaCore

@main struct EvaDanceApp: App {
    @StateObject private var session = Session()
    #if os(iOS)
    @UIApplicationDelegateAdaptor(AppPushDelegate.self) private var pushDelegate
    #endif
    @Environment(\.scenePhase) private var scenePhase
    var body: some Scene {
        WindowGroup {
            MainTabs().id(session.accountID ?? 0)
            .sheet(isPresented: $session.showLogin) { LoginView().environmentObject(session) }
            .environmentObject(session)
            .environmentObject(session.notifications)
            .tint(EvaBrand.red)
            .task(id: "\(session.accountID ?? 0)-\(scenePhase)") {
                guard scenePhase == .active else { return }
                #if os(iOS)
                AppPushDelegate.attach(session.notifications)
                #endif
                while !Task.isCancelled {
                    await session.refreshCourseAccess()
                    await session.notifications.refresh()
                    do { try await Task.sleep(nanoseconds: 30_000_000_000) } catch { return }
                }
            }
            .alert("提示", isPresented: Binding(get: { session.error != nil }, set: { if !$0 { session.error = nil } })) {
                Button("知道了") { session.error = nil }
            } message: { Text(session.error ?? "") }
        }
    }
}
struct MainTabs: View {
    @EnvironmentObject var session: Session
    @EnvironmentObject var notifications: AppNotifications
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
            NavigationStack { AccountView() }.tabItem { Label("个人中心", systemImage: "person.crop.circle") }.badge(notifications.unread)
        }
        #endif
        }.environmentObject(cart)
        .sheet(item: $notifications.destination) { target in
            NavigationStack { MessageDetailView(recipientID: target.id).toolbar { Button("关闭") { session.notifications.destination = nil } } }.environmentObject(session)
        }
        .overlay(alignment: .top) { MessageNoticeView(notifications: session.notifications) }
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
                    NavigationLink { CatalogView(series: item) } label: {
                        VStack(alignment: .leading, spacing: 6) { Text(item.series_name); Text("✓ 已解锁").font(.caption).foregroundStyle(.green); Text("继续学习").font(.subheadline).foregroundStyle(.green) }
                    }
                }
                if !loading && series.isEmpty { Text("暂无已解锁课程，下拉刷新查看最新内容。").foregroundStyle(.secondary) }
            }
        }.evaCompactLayout().evaPageChrome()
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
    let series: Series
    var body: some View { CourseStudyEntryView(id: series.id, title: series.series_name) }
}
struct MessagesView: View {
    @EnvironmentObject var session: Session
    @EnvironmentObject var notifications: AppNotifications
    @State private var items: [InboxMessage] = []
    @State private var cursor = 0
    @State private var more = false
    @State private var busy = false
    @State private var failure: String?
    var body: some View {
        List {
            Section {
                Button("系统通知设置") { Task { await session.notifications.enable() } }
                Text(notifications.permission).font(.caption).foregroundStyle(.secondary)
            }
            ForEach(items) { item in
                NavigationLink { MessageDetailView(recipientID: item.recipientId) } label: {
                    HStack(alignment: .top, spacing: 10) {
                        if item.status == "unread" { Circle().fill(EvaBrand.red).frame(width: 8, height: 8).padding(.top, 7).accessibilityLabel("未读") }
                        VStack(alignment: .leading, spacing: 5) { Text(item.title).font(.headline); Text(item.content).lineLimit(2).foregroundStyle(.secondary); Text(item.createdAt).font(.caption).foregroundStyle(.secondary) }
                    }
                }
            }
            if let failure { Text(failure); Button("重试") { Task { await load(reset: true) } } }
            if more { Button("加载更多") { Task { await load(reset: false) } }.disabled(busy) }
            if busy { ProgressView() }
            if !busy && items.isEmpty && failure == nil { Text("暂无学习消息") }
        }.evaCompactLayout().evaPageChrome()
        .toolbar { Button("全部已读") { Task { await session.notifications.clearAll(); await load(reset: true) } }.disabled(busy || items.isEmpty) }
        .task { await load(reset: true) }.refreshable { await load(reset: true) }
        .onChange(of: notifications.unread) { _ in Task { await load(reset: true) } }
        .onChange(of: notifications.destination?.id) { next in
            if next == nil { Task { await load(reset: true) } }
        }
    }
    private func load(reset: Bool) async {
        guard !busy, let member = session.accountID else { return }; busy = true; failure = nil; defer { busy = false }
        do {
            let result: InboxPage = try await session.api.request("/member/messages?limit=20&cursor=\(reset ? 0 : cursor)", token: session.token)
            guard session.accountID == member, !Task.isCancelled else { return }
            if reset { items = result.items } else { let existing = Set(items.map(\.id)); items += result.items.filter { !existing.contains($0.id) } }
            cursor = result.nextCursor; more = result.hasMore
            await session.notifications.refresh()
        } catch { if session.accountID == member { failure = error.localizedDescription } }
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
                Text("伊娃东方舞 \(Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.1")")
            }
            Button("退出登录", role: .destructive) { confirmLogout = true }
        }.evaCompactLayout().evaPageChrome()
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
        }.evaCompactLayout().evaPageChrome().task { await load() }.refreshable { await load() }
    }
    private func load() async {
        loading = true; defer { loading = false }
        do { items = try await session.api.request("/certificates", token: session.token) }
        catch { session.handle(error) }
    }
}
