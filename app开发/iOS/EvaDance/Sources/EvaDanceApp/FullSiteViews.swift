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
        if store.busy { ProgressView("正在加载…") }
        if let error = store.error { VStack(alignment: .leading, spacing: 8) { Text(error).foregroundStyle(.red); Button("重试", action: retry) } }
    }
}
struct AuthGate<Content: View>: View {
    @EnvironmentObject var session: Session
    @ViewBuilder var content: () -> Content
    var body: some View {
        if session.token != nil { content() }
        else { VStack(spacing: 20) { Image(systemName: "person.crop.circle").font(.system(size: 48)); Text("登录后查看个人学习与服务记录"); Button("手机号登录") { session.showLogin = true }.buttonStyle(.borderedProminent) }.padding() }
    }
}
struct CourseCard: View {
    let row: JSONValue
    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if let url = AppPolicy.secureMediaURL(row["cover_image"].text) {
                AsyncImage(url: url) { image in image.resizable().scaledToFill() } placeholder: { Color.gray.opacity(0.12) }
                    .frame(width: 96, height: 72).clipped().cornerRadius(8).accessibilityHidden(true)
            }
            VStack(alignment: .leading, spacing: 6) {
                Text(row.firstText("name", "title")).font(.headline)
                Text(row.firstText("subtitle", "teacher", "category")).font(.subheadline).foregroundStyle(.secondary)
                if !row["location"].text.isEmpty { Label(row["location"].text, systemImage: "mappin").font(.caption) }
            }
        }.padding(.vertical, 3)
    }
}
struct DiscoverView: View {
    @EnvironmentObject var session: Session
    @StateObject private var store = SiteStore()
    @State private var search = ""
    var rows: [SiteRow] { store.data.rows.filter { row in search.isEmpty || ["name", "subtitle", "teacher", "category"].contains { row.value[$0].text.localizedCaseInsensitiveContains(search) } } }
    var body: some View {
        List {
            if search.isEmpty && !store.data.list.isEmpty {
                Section("线上学院精选课程") { CourseCarousel(courses: Array(store.data.rows.prefix(5))).listRowInsets(EdgeInsets()) }
            }
            LearningShortcuts().listRowSeparator(.hidden)
            Section(search.isEmpty ? "课程列表 · 全部课程" : "搜索结果") {
                LoadState(store: store) { Task { await load() } }
                ForEach(rows) { row in NavigationLink { PublicCourseView(row: row.value) } label: { CourseCard(row: row.value) } }
                if !store.busy && store.error == nil && rows.isEmpty { Text("暂无匹配课程") }
            }
            Section("品牌与资讯") { NavigationLink("了解伊娃东方舞") { InformationView() } }
        }.evaCompactLayout().navigationTitle("线上学院").searchable(text: $search, prompt: "搜索课程、老师或分类")
        .task { await load() }.refreshable { await load() }
    }
    private func load() async { await store.load("/public/series", session: session, publicRead: true) }
}
struct PublicCourseView: View {
    @EnvironmentObject var session: Session
    let row: JSONValue
    var body: some View {
        List {
            CourseCard(row: row)
            if !row["description"].text.isEmpty { Text(plain(row["description"].text)).textSelection(.enabled) }
            Text("教师：\(row["teacher"].text)")
            Text("课节：\(row["total_courses"].text)")
            if let id = Int(row["id"].text), id > 0 {
                NavigationLink("查看课程目录") {
                    CatalogByIDView(id: id, title: row["name"].text)
                }
            }
            if session.token == nil { Button("登录查看学习权限") { session.showLogin = true } }
        }.evaCompactLayout().navigationTitle(row["name"].text)
    }
}
struct CatalogByIDView: View {
    @EnvironmentObject var session: Session
    @StateObject private var store = SiteStore()
    let id: Int
    let title: String
    var body: some View {
        List {
            LoadState(store: store) { Task { await load() } }
            ForEach(store.data.rows) { unit in
                Section(unit.value["name"].text) {
                    ForEach(unit.value["videos"].rows) { lesson in
                        if let lessonID = Int(lesson.id) {
                            NavigationLink(unit.value["name"].text + (unit.value["videos"].list.count > 1 ? " · " + lesson.value["name"].text : "")) {
                                AuthGate { PlayerView(lessonID: lessonID, title: unit.value["name"].text) }
                            }
                        }
                    }
                }
            }
        }.evaCompactLayout().navigationTitle(title).task { await load() }.refreshable { await load() }
    }
    private func load() async { await store.load("/public/series/\(id)/courses", session: session, publicRead: true) }
}
struct OfflineView: View {
    @EnvironmentObject var session: Session
    @StateObject private var store = SiteStore()
    @State private var search = ""
    var body: some View {
        List {
            BrandHeader(title: "线下课", subtitle: "报名获得课次 · 预约冻结课次 · 签到自动核销", icon: "calendar")
            NavigationLink("我的课次、预约与签到") { AuthGate { OfflineScheduleView() } }
            LoadState(store: store) { Task { await load() } }
            ForEach(store.data.rows.filter { search.isEmpty || $0.value["name"].text.localizedCaseInsensitiveContains(search) }) { row in
                NavigationLink { OfflineCourseDetailView(row: row.value) } label: { CourseCard(row: row.value) }
            }
            if !store.busy && store.error == nil && store.data.list.isEmpty { Text("暂无线下课程") }
        }.evaCompactLayout().navigationTitle("线下课程").searchable(text: $search, prompt: "搜索课程或期次").task { await load() }.refreshable { await load() }
    }
    private func load() async { await store.load("/public/offline-courses", session: session, publicRead: true) }
}
struct OfflineCourseDetailView: View {
    let row: JSONValue
    var body: some View {
        List {
            CourseCard(row: row)
            Text(plain(row["description"].text))
            Text("时间：\(row["start_date"].text) — \(row["end_date"].text)")
            ForEach(Array(row["outline"].list.enumerated()), id: \.offset) { Text($0.element.text) }
            if row["price"].number > 0 { NavigationLink("本期报名并付款") { AuthGate { OfflineCheckoutView(courseID:row["source_id"].text) } } }
            NavigationLink("查看可预约课表") { AuthGate { OfflineScheduleView(courseID: row["source_id"].text) } }
        }.evaCompactLayout().navigationTitle(row["name"].text)
    }
}
struct OfflineScheduleView: View {
    @EnvironmentObject var session: Session
    @StateObject private var store = SiteStore()
    var courseID = ""
    @State private var selectedBooking: SiteRow?
    @State private var checkin = ""
    @State private var confirmation: SiteRow?
    var body: some View {
        List {
            LoadState(store: store) { Task { await load() } }
            Section("可用课次") {
                ForEach(store.data["entitlements"].scopedRows("entitlements"), id: \.listID) { row in
                    LabeledContent(row.value["course_name"].text, value: "\(row.value["available_sessions"].text) 次")
                }
            }
            Section("可预约课表") {
                ForEach(store.data["sessions"].scopedRows("sessions"), id: \.listID) { row in VStack(alignment: .leading, spacing: 8) {
                    Text(row.value["course_name"].text).font(.headline)
                    Text("\(row.value["session_date"].text) \(row.value["start_time"].text) · \(row.value.firstText("teacher", "location"))")
                    Button(row.value["can_book"].bool ? "预约本节" : row.value["booking_reason"].text) { confirmation = row }
                        .disabled(!row.value["can_book"].bool || store.busy)
                } }
            }
            Section("我的预约") {
                ForEach(store.data["bookings"].scopedRows("bookings"), id: \.listID) { row in VStack(alignment: .leading, spacing: 8) {
                    Text(row.value["course_name"].text).font(.headline)
                    Text("\(row.value["session_date"].text) \(row.value["start_time"].text) · \(statusLabel(row.value["status"].text))")
                    if ["booked", "confirmed", "pending"].contains(row.value["status"].text) {
                        Button("签到或取消预约") { selectedBooking = row }
                    }
                } }
            }
        }.evaCompactLayout().navigationTitle("课表与预约").task { await load() }.refreshable { await load() }
        .confirmationDialog("确认预约此课程？", isPresented: Binding(get: {confirmation != nil}, set: {if !$0 {confirmation = nil}})) {
            if let row = confirmation { Button("确认预约") { Task { if await store.send("/offline/bookings", body: ["sessionId":Int(row.id) ?? 0], session: session) != nil { await load() } } } }
        }
        .sheet(item: $selectedBooking) { row in NavigationStack { Form {
            Text(row.value["course_name"].text)
            TextField("现场签到码", text: $checkin)
            Button("确认签到") { Task { if await store.send("/offline/checkin", body:["bookingId":Int(row.id) ?? 0,"checkinCode":checkin], session:session) != nil { selectedBooking = nil; await load() } } }.disabled(checkin.isEmpty || store.busy)
            Button("取消本次预约", role: .destructive) { Task { if await store.send("/offline/bookings/\(row.id)", method:"PATCH", body:["reason":"学员 App 取消"], session:session) != nil { selectedBooking = nil; await load() } } }.disabled(store.busy)
            if let error = store.error { Text(error).foregroundStyle(.red) }
        }.evaCompactLayout().navigationTitle("预约管理").toolbar { Button("关闭") { selectedBooking = nil } } } }
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
            NavigationLink("我的报名与成绩") { AuthGate { RecordListView(title: "赛事记录", path: "/member/events", collectionKey: "entries", fields: [("赛事","competitionName"),("姓名","name"),("组别","groupName"),("审核","auditStatus"),("成绩","totalScore")]) } }
            LoadState(store: store) { Task { await load() } }
            ForEach(store.data.rows.filter { search.isEmpty || $0.value["name"].text.localizedCaseInsensitiveContains(search) }) { row in
                NavigationLink { EventDetailView(id: row.id) } label: { VStack(alignment: .leading, spacing: 6) {
                    Text(row.value["name"].text).font(.headline)
                    Text("\(row.value.firstText("startDate","start_date")) · \(row.value.firstText("city","venue"))").foregroundStyle(.secondary)
                }.padding(.vertical, 3) }
            }
        }.evaCompactLayout().navigationTitle("东方舞赛事").searchable(text: $search).task { await load() }.refreshable { await load() }
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
