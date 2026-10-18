import SwiftUI
import EvaCore
import UniformTypeIdentifiers

@MainActor final class SiteStore: ObservableObject {
    @Published var data: JSONValue = .null
    @Published var busy = false
    @Published var error: String?
    func load(_ path: String, session: Session, publicRead: Bool = false) async {
        guard !busy else { return }; busy = true; error = nil; defer { busy = false }
        do { data = try await session.api.request(path, token: publicRead ? nil : session.token) }
        catch { self.error = error.localizedDescription; if case APIError.sessionExpired = error { session.handle(error) } }
    }
    func send(_ path: String, method: String = "POST", body: [String: Any] = [:], session: Session) async -> JSONValue? {
        guard !busy else { return nil }; busy = true; error = nil; defer { busy = false }
        do { return try await session.api.request(path, token: session.token, method: method, body: JSONSerialization.data(withJSONObject: body)) }
        catch { self.error = error.localizedDescription; if case APIError.sessionExpired = error { session.handle(error) }; return nil }
    }
}
struct LoadState: View {
    @ObservedObject var store: SiteStore
    var retry: () -> Void
    var body: some View {
        if store.busy { HStack(spacing: 12) { ProgressView(); Text("正在加载…").font(.subheadline).foregroundStyle(.secondary) }.frame(maxWidth: .infinity, minHeight: 64) }
        if let error = store.error {
            VStack(alignment: .leading, spacing: 12) {
                Label("内容暂未加载", systemImage: "wifi.exclamationmark").font(.headline)
                Text(error).font(.subheadline).foregroundStyle(.secondary)
                Button("重新加载", action: retry).buttonStyle(.bordered).frame(minHeight: 44)
            }.padding(16).frame(maxWidth: .infinity, alignment: .leading).background(EvaBrand.surface, in: RoundedRectangle(cornerRadius: 14))
        }
    }
}
struct AuthGate<Content: View>: View {
    @EnvironmentObject var session: Session
    @ViewBuilder var content: () -> Content
    var body: some View {
        if session.token != nil { content() }
        else { VStack(spacing: 20) { Image(systemName: "person.crop.circle").font(.largeTitle).foregroundStyle(EvaBrand.red); Text("登录后查看个人学习与服务记录").font(.headline).multilineTextAlignment(.center); Button("手机号登录") { session.showLogin = true }.buttonStyle(.borderedProminent).controlSize(.large) }.padding(28).frame(maxWidth: .infinity, maxHeight: .infinity).background(EvaBrand.canvas) }
    }
}
struct CourseCard: View {
    var online = false
    let row: JSONValue
    var body: some View {
        HStack(alignment: .center, spacing: 14) {
            ZStack {
                EvaBrand.softAccent
                if let url = AppPolicy.secureMediaURL(row["cover_image"].text) {
                    AsyncImage(url: url) { image in image.resizable().scaledToFill() } placeholder: { Image(systemName: "play.rectangle").font(.title2).foregroundStyle(EvaBrand.red) }
                } else { Image(systemName: "play.rectangle").font(.title2).foregroundStyle(EvaBrand.red) }
            }.frame(width: 96, height: 88).clipped().clipShape(RoundedRectangle(cornerRadius: 12)).accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 7) {
                Text(row.firstText("name", "title")).font(.headline).foregroundStyle(.primary).fixedSize(horizontal: false, vertical: true)
                if !row.firstText("subtitle", "teacher", "category").isEmpty {
                    Text(row.firstText("subtitle", "teacher", "category")).font(.subheadline).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                }
                if !row["total_courses"].text.isEmpty {
                    Text([row["teacher"].text, "\(row["total_courses"].text) 节课"].filter { !$0.isEmpty }.joined(separator: " · ")).font(.caption).foregroundStyle(.secondary)
                }
                if !row["location"].text.isEmpty { Label(row["location"].text, systemImage: "mappin").font(.caption) }
                if row["price"] != .null { CoursePriceLine(online: online, row: row) }
            }
            Spacer(minLength: 0)
        }.padding(.vertical, 8).frame(maxWidth: .infinity, alignment: .leading)
    }
}
struct DiscoverView: View {
    @EnvironmentObject var session: Session
    @StateObject private var store = SiteStore()
    @State private var search = ""
    var rows: [SiteRow] { store.data.rows.filter { row in search.isEmpty || ["name", "subtitle", "teacher", "category"].contains { row.value[$0].text.localizedCaseInsensitiveContains(search) } } }
    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 20) {
                if search.isEmpty {
                    BrandHeader(title: "伊娃东方舞", subtitle: "线上学院 · 舞蹈作品 · 每天进步一点", icon: "play.rectangle")
                    LearningShortcuts()
                }
                HStack {
                    Text(search.isEmpty ? "探索课程" : "搜索结果").font(.title3.bold())
                    Spacer()
                    if !store.busy && store.error == nil { Text("\(rows.count) 门课程").font(.subheadline).foregroundStyle(.secondary) }
                }
                LoadState(store: store) { Task { await load() } }
                ForEach(rows) { row in NavigationLink {
                    if session.isCourseUnlocked(row.value["id"].text), let id = Int(row.value["id"].text) { CatalogByIDView(id: id, title: row.value["name"].text) }
                    else { PublicCourseView(row: row.value) }
                } label: {
                    HStack(spacing: 4) { CourseCard(online: true, row: row.value); Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(.secondary) }
                        .padding(.horizontal, 14).background(EvaBrand.surface, in: RoundedRectangle(cornerRadius: 16))
                }.buttonStyle(.plain) }
                if !store.busy && store.error == nil && rows.isEmpty { Label("暂无匹配课程，请换个关键词", systemImage: "magnifyingglass").foregroundStyle(.secondary).padding(.vertical, 24) }
                NavigationLink { InformationView() } label: { Label("了解伊娃东方舞", systemImage: "info.circle").font(.subheadline).frame(minHeight: 44) }.padding(.top, 4)
            }.padding(20).frame(maxWidth: 760).frame(maxWidth: .infinity)
        }.evaHomeLayout().navigationTitle("线上学院").evaSearch(text: $search, prompt: "搜索课程、老师或分类")
        .task(id: session.accountID) { await load() }.refreshable { await load() }
    }
    private func load() async { await session.refreshCourseAccess(); await store.load("/public/series", session: session, publicRead: true) }
}
struct PublicCourseView: View {
    @EnvironmentObject var session: Session
    let row: JSONValue
    var body: some View {
        List {
            CourseCard(online: true, row: row)
            if !row["description"].text.isEmpty { Text(plain(row["description"].text)).textSelection(.enabled) }
            Text("教师：\(row["teacher"].text)")
            Text("课节：\(row["total_courses"].text)")
            if let id = Int(row["id"].text), id > 0 {
                NavigationLink(session.isCourseUnlocked(row["id"].text) ? "继续学习" : "查看课程目录") {
                    CatalogByIDView(id: id, title: row["name"].text)
                }
            }
            if session.token == nil { Button("登录查看学习权限") { session.showLogin = true } }
        }.evaCompactLayout().navigationTitle(row["name"].text).task(id: session.accountID) { await session.refreshCourseAccess() }
    }
}
struct CatalogByIDView: View {
    let id: Int
    let title: String
    var body: some View { LessonCatalogView(id: id, title: title) }
}
struct OfflineView: View {
    @EnvironmentObject var session: Session
    @StateObject private var store = SiteStore()
    @State private var search = ""
    var body: some View {
        List {
            BrandHeader(title: "线下课", subtitle: "购买期次课时 · 到课核销扣减", icon: "calendar")
            NavigationLink("课时余额与核销记录") { AuthGate { OfflineScheduleView() } }
            LoadState(store: store) { Task { await load() } }
            ForEach(JSONValue.array(CoursePresentation.grouped(store.data.list)).rows.filter { search.isEmpty || $0.value["name"].text.localizedCaseInsensitiveContains(search) }) { row in
                NavigationLink { OfflineCourseDetailView(row: row.value, periods: CoursePresentation.periods(store.data.list, for: row.value)) } label: { CourseCard(row: row.value) }
            }
            if !store.busy && store.error == nil && store.data.list.isEmpty { Text("暂无线下课程") }
        }.evaCompactLayout().evaHomeLayout().navigationTitle("线下课程").evaSearch(text: $search, prompt: "搜索课程或期次").task { await load() }.refreshable { await load() }
    }
    private func load() async { await store.load("/public/offline-courses", session: session, publicRead: true) }
}
struct OfflineCourseDetailView: View {
    let row: JSONValue
    var periods: [JSONValue] = []
    private var availablePeriods: [JSONValue] { periods.isEmpty ? [row] : periods }
    var body: some View {
        List {
            CourseCard(row: row)
            Section("课程介绍") { Text(plain(CoursePresentation.description(row))).textSelection(.enabled) }
            let intro = CoursePresentation.introduction(row)
            if !intro["level"].text.isEmpty { Text("适合级别：\(intro["level"].text)") }
            let outline = intro["outline"].list.isEmpty ? row["outline"].list : intro["outline"].list
            if !outline.isEmpty { Section("课程大纲") { ForEach(Array(outline.enumerated()), id: \.offset) { Text("\($0.offset + 1). \($0.element.text)") } } }
            Section("课程期次 · 共 \(availablePeriods.count) 期") {
                ForEach(JSONValue.array(availablePeriods).rows) { period in
                    VStack(alignment: .leading, spacing: 10) {
                        Text(period.value.firstText("subtitle", "start_date")).font(.headline)
                        Text([period.value["start_date"].text,period.value["end_date"].text,period.value["location"].text].filter { !$0.isEmpty }.joined(separator: " · ")).font(.subheadline).foregroundStyle(.secondary)
                        Text("\(period.value["total_courses"].text) 课时 · ¥\(period.value["price"].text)")
                        Text("已报名 \(period.value["total_students"].text) 人（匿名）").font(.caption).foregroundStyle(.secondary)
                        if CoursePresentation.canPurchase(period.value) { NavigationLink("购买本期课时") { AuthGate { OfflineCheckoutView(courseID:period.value["source_id"].text) } }.frame(minHeight:44) }
                        else { Text("本期暂不可购买，请查看期次安排或咨询课程顾问").font(.caption).foregroundStyle(.secondary) }
                        NavigationLink("查看本期课时") { AuthGate { OfflineScheduleView(courseID:period.value["source_id"].text) } }.frame(minHeight:44)
                    }.padding(.vertical, 8)
                }
            }
        }.evaCompactLayout().navigationTitle(row["name"].text)
    }
}
struct OfflineScheduleView: View {
    @EnvironmentObject var session: Session
    @StateObject private var store = SiteStore()
    var courseID = ""
    var body: some View {
        List {
            LoadState(store: store) { Task { await load() } }
            Section("已购期次课时") {
                Text("购买课程期次的课时，到课后核销扣减，无需预约。")
                ForEach(store.data["entitlements"].scopedRows("entitlements"), id: \.listID) { row in
                    VStack(alignment: .leading) {
                        Text([row.value["course_name"].text,row.value["course_period"].text].filter { !$0.isEmpty }.joined(separator: " · "))
                        Text("剩余 \(row.value["available_sessions"].text) 课时 · 已核销 \(row.value["used_sessions"].text) 课时")
                    }
                }
            }
            Section("核销记录") {
                ForEach(store.data["consumes"].scopedRows("consumes"), id: \.listID) { row in
                    VStack(alignment: .leading) {
                        Text(row.value["course_name"].text)
                        Text("\(row.value["consume_date"].text) · 核销 \(row.value["count"].text) 课时")
                    }
                }
            }
        }.evaCompactLayout().navigationTitle("期次课时").task { await load() }.refreshable { await load() }
    }
    private func load() async { await store.load("/offline/overview" + (courseID.isEmpty ? "" : "?course_ids=\(courseID)"), session: session) }
}
struct EventsView: View {
    @EnvironmentObject var session: Session
    @StateObject private var store = SiteStore()
    @State private var search = ""
    var body: some View {
        List {
            BrandHeader(title: "AiwaRaks赛事平台", subtitle: "赛事、报名、赛程与成绩", icon: "trophy")
            NavigationLink("工作人员 · 赛事管理") { StaffEventRootView() }
            NavigationLink("我的比赛") { AuthGate { MyCompetitionsView() } }
            LoadState(store: store) { Task { await load() } }
            ForEach(store.data.rows.filter { search.isEmpty || $0.value["name"].text.localizedCaseInsensitiveContains(search) }) { row in
                NavigationLink { EventDetailView(id: row.id) } label: { VStack(alignment: .leading, spacing: 6) {
                    Text(row.value["name"].text).font(.headline)
                    Text("\(row.value.firstText("startDate","start_date")) · \(row.value.firstText("city","venue"))").foregroundStyle(.secondary)
                }.padding(.vertical, 3) }
            }
        }.evaCompactLayout().evaHomeLayout().navigationTitle("东方舞赛事").evaSearch(text: $search, prompt: "搜索赛事名称").task { await load() }.refreshable { await load() }
    }
    private func load() async { await store.load("/events", session: session, publicRead: true) }
}
struct EventDetailView: View {
    @EnvironmentObject var session: Session
    @StateObject private var store = SiteStore()
    let id: String
    @State private var groupSearch = ""
    var body: some View {
        List {
            LoadState(store: store) { Task { await load() } }
            let event = store.data["competition"]
            Section(event["name"].text) {
                Text("\(event.firstText("startDate","start_date")) · \(event["venue"].text)")
                Text(plain(event.firstText("description","introduction")))
            }
            Section("参赛组别") {
                TextField("搜索完整组别名称", text: $groupSearch)
                ForEach(store.data["groups"].scopedRows("groups").filter { PracticePlan.matches($0.value, query: groupSearch, fields: ["name"]) }, id: \.listID) { group in
                    NavigationLink { AuthGate { EventRegistrationView(eventID: id, group: group) } } label: {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(group.value["name"].text).fixedSize(horizontal: false, vertical: true)
                            if group.value["registrationFee"].number > 0 {
                                Text("报名费 ¥" + String(format: "%.2f", group.value["registrationFee"].number)).font(.caption).foregroundStyle(.secondary)
                            }
                        }
                    }
                }
                Text("能否报名及名额以提交时服务端核验为准。").font(.caption).foregroundStyle(.secondary)
            }
            Section("比赛日程") { ForEach(store.data["sessions"].scopedRows("sessions"), id: \.listID) { row in Text("\(row.value["name"].text) · \(row.value["startsAt"].text) · \(row.value["venue"].text)") } }
            Section("已发布成绩") { ForEach(store.data["rankings"].scopedRows("rankings"), id: \.listID) { row in
                Text("\(row.value["rankNo"].text)  \(row.value["playerName"].text)  \(row.value["groupName"].text)  \(row.value["publishedTotal"].text)")
            } }
        }.evaCompactLayout().navigationTitle("赛事详情").task { await load() }.refreshable { await load() }
    }
    private func load() async { await store.load("/events/\(id)", session: session, publicRead: true) }
}
struct EventRegistrationView: View {
    @EnvironmentObject var session: Session
    let eventID: String
    let group: SiteRow
    @State private var name = ""
    @State private var phone = ""
    @State private var organization = ""
    @State private var teacher = ""
    @State private var performanceTitle = ""
    @State private var remark = ""
    @State private var musicName = ""
    @State private var music: Data?
    @State private var picker = false
    @State private var busy = false
    @State private var error: String?
    @State private var result = ""
    @State private var confirm = false
    var body: some View {
        Form {
            Text(group.value["name"].text).font(.headline)
            TextField("参赛姓名", text: $name); TextField("联系电话", text: $phone)
            TextField("机构（选填）", text: $organization); TextField("指导老师（选填）", text: $teacher)
            TextField("节目名称", text: $performanceTitle)
            TextField("备注（选填）", text: $remark)
            Button(musicName.isEmpty ? "选择参赛音乐" : "更换音乐：" + musicName) { picker = true }.disabled(busy)
            Text("支持 MP3、WAV、M4A、AAC、FLAC，单个文件不超过10MB。报名、节目与音乐一同提交。").font(.caption)
            Button("提交报名及音乐") { confirm = true }.disabled(name.trimmingCharacters(in: .whitespaces).isEmpty || phone.range(of: "^1[3-9][0-9]{9}$", options: .regularExpression) == nil || performanceTitle.trimmingCharacters(in: .whitespaces).isEmpty || music == nil || busy || !result.isEmpty)
            if busy { ProgressView("正在上传报名与音乐…") }
            if !result.isEmpty { Text(result).foregroundStyle(.green) }
            if let error { Text(error).foregroundStyle(.red) }
        }.evaCompactLayout().navigationTitle("赛事报名")
        .fileImporter(isPresented: $picker, allowedContentTypes: [.audio, .data]) { selection in
            do {
                let url = try selection.get()
                let scope = url.startAccessingSecurityScopedResource(); defer { if scope { url.stopAccessingSecurityScopedResource() } }
                let size = try url.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                guard size > 0, size <= 10 * 1024 * 1024 else { throw APIError.service("音乐文件不能超过10MB") }
                let bytes = try Data(contentsOf: url)
                _ = try MultipartMusic(fields: [:], filename: url.lastPathComponent, music: bytes)
                music = bytes; musicName = url.lastPathComponent; error = nil
            } catch { self.error = error.localizedDescription }
        }
        .confirmationDialog("确认提交本组报名、节目名称与音乐？", isPresented: $confirm) { Button("确认上传并报名") { Task { await submit() } } }
    }
    private func submit() async {
        guard !busy, let music else { return }
        busy = true; error = nil; defer { busy = false }
        do {
            let form = try MultipartMusic(fields: ["groupId": group.id, "name": name.trimmingCharacters(in: .whitespacesAndNewlines), "phone": phone, "organization": organization, "teacher": teacher, "performanceTitle": performanceTitle.trimmingCharacters(in: .whitespacesAndNewlines), "remark": remark], filename: musicName, music: music)
            let submitted: JSONValue = try await session.api.request("/events/\(eventID)/register", token: session.token, method: "POST", body: form.body, contentType: form.contentType)
            result = submitted["auditStatus"].text == "approved" ? "报名与音乐已提交，付款状态请在赛事记录中查看。" : "报名与音乐已提交，请在赛事记录中查看处理进度。"
            self.music = nil
        } catch { self.error = error.localizedDescription; if case APIError.sessionExpired = error { session.handle(error) } }
    }
}
struct RecordListView: View {
    @EnvironmentObject var session: Session
    @StateObject private var store = SiteStore()
    let title: String, path: String
    var collectionKey = ""
    let fields: [(String, String)]
    var rows: [SiteRow] { collectionKey.isEmpty ? store.data.rows : (store.data[collectionKey].list.isEmpty ? store.data.rows : store.data[collectionKey].rows) }
    var body: some View {
        List {
            LoadState(store: store) { Task { await load() } }
            ForEach(rows) { row in VStack(alignment: .leading, spacing: 8) {
                ForEach(fields.indices, id: \.self) { i in
                    if !row.value[fields[i].1].text.isEmpty { LabeledContent(fields[i].0, value: row.value[fields[i].1].text) }
                }
            }.padding(.vertical, 3) }
            if !store.busy && store.error == nil && rows.isEmpty { Text("暂无记录") }
        }.evaCompactLayout().navigationTitle(title).task { await load() }.refreshable { await load() }
    }
    private func load() async { await store.load(path, session: session) }
}
func plain(_ html: String) -> String {
    html.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression).replacingOccurrences(of: "&nbsp;", with: " ").replacingOccurrences(of: "&amp;", with: "&")
}
func statusLabel(_ status: String) -> String {
    ["pending":"待处理","paid":"已付款","shipped":"已发货","completed":"已完成","cancelled":"已取消","refunded":"已退款","refund_requested":"退款处理中","booked":"已预约","checked_in":"已签到","active":"有效","approved":"已通过","rejected":"未通过" ][status] ?? status
}
