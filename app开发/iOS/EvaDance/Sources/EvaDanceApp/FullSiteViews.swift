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
    var showCover = true
    @Environment(\.dynamicTypeSize) private var typeSize
    var body: some View {
        Group {
            if showCover { CourseCardSplitLayout() { artwork; details } }
            else { details }
        }.padding(.vertical, 4).frame(maxWidth: .infinity, alignment: .leading)
    }
    private var artwork: some View {
        ArtworkImage(url: AppPolicy.secureMediaURL(row["cover_image"].text), symbol: "play.rectangle", ratio: nil)
            .frame(maxWidth: .infinity, maxHeight: .infinity).accessibilityHidden(true)
    }
    private var details: some View {
            VStack(alignment: .leading, spacing: 7) {
                Text(row.firstText("name", "title")).font(.headline).foregroundStyle(.primary).lineLimit(showCover && !typeSize.isAccessibilitySize ? 2 : nil).fixedSize(horizontal: false, vertical: true)
                if !row.firstText("subtitle", "teacher", "category").isEmpty {
                    Text(row.firstText("subtitle", "teacher", "category")).font(.subheadline).foregroundStyle(.secondary).lineLimit(showCover && !typeSize.isAccessibilitySize ? 1 : nil).fixedSize(horizontal: false, vertical: true)
                }
                if !row["total_courses"].text.isEmpty {
                    Text([row["teacher"].text, "\(row["total_courses"].text) 节课"].filter { !$0.isEmpty }.joined(separator: " · ")).font(.caption).foregroundStyle(.secondary)
                }
                if !row["location"].text.isEmpty { Label(row["location"].text, systemImage: "mappin").font(.caption) }
                if row["price"] != .null { CoursePriceLine(online: online, row: row) }
            }
    }
}
struct DiscoverView: View {
    @EnvironmentObject var session: Session
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @Environment(\.dynamicTypeSize) private var typeSize
    @StateObject private var store = SiteStore()
    @State private var search = ""
    @State private var onlyUnlocked = false
    @State private var category = ""
    private var categories: [String] { Set(store.data.rows.map { $0.value["category"].text }.filter { !$0.isEmpty }).sorted() }
    var rows: [SiteRow] { store.data.rows.filter { row in
        let matches = search.isEmpty || ["name", "subtitle", "teacher", "category"].contains { row.value[$0].text.localizedCaseInsensitiveContains(search) }
        return matches && (category.isEmpty || row.value["category"].text == category)
            && (!onlyUnlocked || (session.courseAccessReady && session.isCourseUnlocked(row.value["id"].text)))
    } }
    private var courseColumns: [GridItem] {
        Array(repeating: GridItem(.flexible(), spacing: 16, alignment: .topLeading),
              count: horizontalSizeClass == .regular && !typeSize.isAccessibilitySize ? 2 : 1)
    }
    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 4) {
                VStack(alignment: .leading, spacing: 6) {
                        Text("伊娃东方舞").font(.title2.bold())
                        Text("线上学院 · 从基础到进阶，找到适合你的课程").font(.subheadline).foregroundStyle(.secondary)
                    }.padding(.vertical, 2)
                EvaSearchField(text: $search, prompt: "搜索课程、老师或分类")
                LearningShortcuts()
                HStack {
                    Text(search.isEmpty ? "课程列表" : "搜索结果").font(.title3.bold())
                    Spacer()
                    if !store.busy && store.error == nil { Text("\(rows.count) 门课程").font(.subheadline).foregroundStyle(.secondary) }
                    Menu {
                        Button("全部课程") { onlyUnlocked = false; category = "" }
                        Button("已解锁") { if session.token == nil { session.showLogin = true } else { onlyUnlocked = true } }
                        if !categories.isEmpty { Picker("课程分类", selection: $category) { Text("全部分类").tag(""); ForEach(categories, id: \.self) { Text($0).tag($0) } } }
                        Button("清除筛选") { onlyUnlocked = false; category = ""; search = "" }
                    } label: { Label("筛选", systemImage: "line.3.horizontal.decrease").frame(minWidth: 44, minHeight: 44) }
                        .accessibilityIdentifier("course.filter")
                        .accessibilityValue([onlyUnlocked ? "已解锁" : "全部课程", category].filter { !$0.isEmpty }.joined(separator: "，"))
                }
                if onlyUnlocked || !category.isEmpty { Text([onlyUnlocked ? "已解锁" : "", category].filter { !$0.isEmpty }.joined(separator: " · ")).font(.caption).foregroundStyle(EvaBrand.red) }
                LoadState(store: store) { Task { await load() } }
                LazyVGrid(columns: courseColumns, alignment: .leading, spacing: 8) {
                    ForEach(rows) { row in
                        VStack(spacing: 4) {
                            NavigationLink {
                                if session.isCourseUnlocked(row.value["id"].text), let id = Int(row.value["id"].text) {
                                    CatalogByIDView(id: id, title: row.value["name"].text)
                                } else {
                                    PublicCourseView(row: row.value)
                                }
                            } label: {
                                HStack(spacing: 4) {
                                    CourseCard(online: true, row: row.value)
                                    Image(systemName: "chevron.right").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                                }.contentShape(Rectangle())
                            }.buttonStyle(EvaPressStyle())
                            Divider()
                        }
                    }
                }
                if onlyUnlocked && !session.courseAccessReady {
                    Text("学习权益暂无法确认，请重试").foregroundStyle(.secondary)
                    Button("重新查询学习权益") { Task { await session.refreshCourseAccess() } }.frame(minHeight: 44)
                } else if !store.busy && store.error == nil && rows.isEmpty {
                    Label("暂无匹配课程，请换个关键词", systemImage: "magnifyingglass").foregroundStyle(.secondary).padding(.vertical, 12)
                    Button("清除搜索与筛选") { search = ""; category = ""; onlyUnlocked = false }.frame(minHeight: 44)
                }
                NavigationLink { InformationView() } label: { Label("了解伊娃东方舞", systemImage: "info.circle").font(.subheadline).frame(minHeight: 44) }.padding(.top, 4)
            }.padding(.horizontal, 16).padding(.vertical, 6)
                .frame(maxWidth: courseColumns.count == 2 ? 960 : 760).frame(maxWidth: .infinity)
        }.evaHomeLayout().evaCompactLayout().evaPageChrome(root: true)
        .task(id: session.accountID) { await load() }.refreshable { await load() }
    }
    private func load() async { await session.refreshCourseAccess(); await store.load("/public/series", session: session, publicRead: true) }
}
struct PublicCourseView: View {
    @EnvironmentObject var session: Session
    let row: JSONValue
    var body: some View {
        List {
            if let url = AppPolicy.secureMediaURL(row["cover_image"].text) {
                ArtworkImage(url: url, symbol: "play.rectangle", label: row["name"].text + "课程封面")
                    .frame(maxWidth: .infinity).listRowInsets(EdgeInsets())
            }
            CourseCard(online: true, row: row, showCover: false)
            if !row["description"].text.isEmpty { Text(plain(row["description"].text)).textSelection(.enabled) }
            Text("教师：\(row["teacher"].text)")
            Text("课节：\(row["total_courses"].text)")
            if let id = Int(row["id"].text), id > 0 {
                NavigationLink(session.isCourseUnlocked(row["id"].text) ? "继续学习" : "查看课程目录") {
                    if session.isCourseUnlocked(row["id"].text) { CatalogByIDView(id: id, title: row["name"].text) }
                    else { LessonCatalogView(id: id, title: row["name"].text) }
                }
            }
            NavigationLink("客服与售后") { CourseSupportView() }
            if session.token == nil { Button("登录查看学习权限") { session.showLogin = true } }
        }.evaCompactLayout().evaPageChrome().task(id: session.accountID) { await session.refreshCourseAccess() }
    }
}
struct CatalogByIDView: View {
    let id: Int
    let title: String
    var body: some View { CourseStudyEntryView(id: id, title: title) }
}
struct OfflineView: View {
    @EnvironmentObject var session: Session
    @StateObject private var store = SiteStore()
    @State private var search = ""
    @State private var calendarMode = false
    var body: some View {
        List {
            BrandHeader(title: "线下课", subtitle: "购买期次课时 · 到课核销扣减", icon: "calendar")
            NavigationLink("课时余额与核销记录") { AuthGate { OfflineScheduleView() } }
            LoadState(store: store) { Task { await load() } }
            Picker("课程视图", selection: $calendarMode) { Text("课程列表").tag(false); Text("课程日历").tag(true) }.pickerStyle(.segmented)
            if calendarMode && !store.busy && store.error == nil {
                OfflineMonthCalendar(courses: store.data.list).listRowInsets(EdgeInsets(top: 8, leading: 0, bottom: 8, trailing: 0))
            } else if !calendarMode {
            ForEach(JSONValue.array(CoursePresentation.grouped(store.data.list)).rows.filter { search.isEmpty || $0.value["name"].text.localizedCaseInsensitiveContains(search) }) { row in
                NavigationLink { OfflineCourseDetailView(row: row.value, periods: CoursePresentation.periods(store.data.list, for: row.value)) } label: { CourseCard(row: row.value) }
            }
            }
            if !store.busy && store.error == nil && store.data.list.isEmpty { Text("暂无线下课程") }
        }.evaCompactLayout().evaHomeLayout().evaPageChrome(root: true).evaSearch(text: $search, prompt: "搜索课程或期次").task { await load() }.refreshable { await load() }
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
        }.evaCompactLayout().evaPageChrome()
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
        }.evaCompactLayout().evaPageChrome().task { await load() }.refreshable { await load() }
    }
    private func load() async { await store.load("/offline/overview" + (courseID.isEmpty ? "" : "?course_ids=\(courseID)"), session: session) }
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
        }.evaCompactLayout().evaPageChrome().task { await load() }.refreshable { await load() }
    }
    private func load() async { await store.load("/events/\(id)", session: session, publicRead: true) }
}
struct EventRegistrationView: View {
    @EnvironmentObject var session: Session
    let eventID: String
    let group: SiteRow?
    var playerID: String? = nil
    @State private var countryCode = "+86"
    @State private var canEdit = false
    @State private var currentMusic = ""
    @State private var accountID: Int?
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
            Text(group?.value["name"].text ?? "修改报名 / 补交音乐").font(.headline)
            if !currentMusic.isEmpty { Text("当前音乐：" + currentMusic) }
            TextField("参赛姓名", text: $name)
            TextField("国家/地区区号", text: $countryCode).keyboardType(.phonePad)
            TextField("联系电话", text: $phone).keyboardType(.phonePad)
            TextField("机构（选填）", text: $organization); TextField("指导老师（选填）", text: $teacher)
            TextField("节目（音乐）名字", text: $performanceTitle)
            TextField("备注（选填）", text: $remark)
            Button(musicName.isEmpty ? "选择参赛音乐" : "更换音乐：" + musicName) { picker = true }.disabled(busy)
            if music != nil { Button("移除所选音乐") { music = nil; musicName = "" }.disabled(busy) }
            Text("音乐选填。支持 MP3、WAV、M4A、AAC、FLAC，单个文件不超过 10 MB。").font(.caption)
            if playerID == nil {
                Button("提交报名") { confirm = true }.disabled(!valid || busy || !result.isEmpty)
            } else {
                Button("保存报名资料") { Task { await submit(detailsOnly: true) } }.disabled(!valid || busy || !canEdit)
                Button("上传音乐") { confirm = true }.disabled(music == nil || performanceTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || busy || !canEdit)
            }
            if busy { ProgressView("正在处理…") }
            if !result.isEmpty { Text(result).foregroundStyle(.green) }
            if let error { Text(error).foregroundStyle(.red) }
        }.evaCompactLayout().evaPageChrome()
        .task(id: session.accountID) { await loadRegistration() }
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
        .confirmationDialog(playerID == nil ? "确认提交报名？" : "确认上传参赛音乐？", isPresented: $confirm) {
            Button("确认提交") { Task { await submit() } }
        }
    }
    private var valid: Bool {
        [name, phone, performanceTitle].allSatisfy { !$0.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    }
    private var registrationPath: String? {
        guard let playerID, let id = Int(playerID), id > 0 else { return nil }
        return "/member/event-registrations/\(id)"
    }
    private func loadRegistration() async {
        let account = session.accountID
        if accountID != account {
            name = ""; phone = ""; countryCode = "+86"; organization = ""; teacher = ""
            performanceTitle = ""; remark = ""; musicName = ""; music = nil; currentMusic = ""
            result = ""; error = nil; canEdit = false
        }
        accountID = account
        guard let path = registrationPath, let token = session.token else { return }
        busy = true; canEdit = false; defer { busy = false }
        do {
            let details: JSONValue = try await session.api.request(path, token: token)
            guard account == session.accountID, !Task.isCancelled else { return }
            let audio: JSONValue = try await session.api.request(path + "/music", token: token)
            guard account == session.accountID, !Task.isCancelled else { return }
            name = details["name"].text; phone = details["phone"].text
            countryCode = details["countryCode"].text.isEmpty ? "+86" : details["countryCode"].text
            organization = details["organization"].text; teacher = details["teacher"].text
            performanceTitle = details["performanceTitle"].text; remark = details["remark"].text
            currentMusic = audio["fileName"].text
            canEdit = details["canEdit"].bool == true
        } catch { self.error = error.localizedDescription }
    }
    private func submit(detailsOnly: Bool = false) async {
        guard !busy, accountID == session.accountID, let token = session.token else { return }
        let account = session.accountID
        busy = true; error = nil; result = ""; defer { busy = false }
        do {
            let fields = ["name": name.trimmingCharacters(in: .whitespacesAndNewlines), "phone": phone, "countryCode": countryCode, "organization": organization, "teacher": teacher, "performanceTitle": performanceTitle.trimmingCharacters(in: .whitespacesAndNewlines), "remark": remark]
            if let path = registrationPath, canEdit {
                if detailsOnly {
                    let _: JSONValue = try await session.api.request(path, token: token, method: "PUT", body: JSONEncoder().encode(fields))
                    guard account == session.accountID else { return }
                    result = "报名资料已保存。"
                } else if let music {
                    let form = try MultipartMusic(fields: ["performanceTitle": fields["performanceTitle"] ?? ""], filename: musicName, music: music)
                    let updated: JSONValue = try await session.api.request(path + "/music", token: token, method: "POST", body: form.body, contentType: form.contentType)
                    guard account == session.accountID else { return }
                    currentMusic = updated["fileName"].text
                    self.music = nil; musicName = ""; result = "音乐已更新。"
                }
            } else if let group, valid {
                var registration = fields; registration["groupId"] = group.id
                if let music {
                    let form = try MultipartMusic(fields: registration, filename: musicName, music: music)
                    let _: JSONValue = try await session.api.request("/events/\(eventID)/register", token: token, method: "POST", body: form.body, contentType: form.contentType)
                } else {
                    let _: JSONValue = try await session.api.request("/events/\(eventID)/register", token: token, method: "POST", body: JSONEncoder().encode(registration))
                }
                guard account == session.accountID else { return }
                result = "报名已提交，可在「我的比赛」查看进度、补交或更换音乐。"
                self.music = nil; musicName = ""
            }
        } catch {
            guard account == session.accountID else { return }
            self.error = error.localizedDescription
            if case APIError.sessionExpired = error { session.handle(error) }
        }
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
        }.evaCompactLayout().evaPageChrome().task { await load() }.refreshable { await load() }
    }
    private func load() async { await store.load(path, session: session) }
}
func plain(_ html: String) -> String {
    html.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression).replacingOccurrences(of: "&nbsp;", with: " ").replacingOccurrences(of: "&amp;", with: "&")
}
func statusLabel(_ status: String) -> String {
    ["pending":"待处理","paid":"已付款","shipped":"已发货","completed":"已完成","cancelled":"已取消","refunded":"已退款","refund_requested":"退款处理中","booked":"已预约","checked_in":"已签到","active":"有效","approved":"已通过","rejected":"未通过" ][status] ?? status
}
