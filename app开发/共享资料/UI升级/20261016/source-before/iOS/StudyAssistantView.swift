import SwiftUI
import EvaCore

struct StudyAssistantView: View {
    @EnvironmentObject var session: Session
    @State private var minutes = 20
    @State private var recent: [RecentLesson] = []
    @State private var courses: [Series] = []
    @State private var error: String?
    @State private var loading = false
    var body: some View {
        List {
            BrandHeader(title: "今天，从这里开始", subtitle: "结合最近学习记录，安排适合当前空闲时间的练习", icon: "sparkles")
            Section("可用时间") {
                Picker("今天练习多久", selection: $minutes) { ForEach([10,20,30,45,60], id: \.self) { Text("\($0) 分钟").tag($0) } }.pickerStyle(.segmented)
                let stages = PracticePlan.minutes(minutes)
                Label("热身准备 · \(stages[0]) 分钟", systemImage: "figure.flexibility")
                Label("课程练习 · \(stages[1]) 分钟", systemImage: "play.rectangle")
                Label("复习与记录 · \(stages[2]) 分钟", systemImage: "note.text")
                Text("按个人状态调整练习强度，计划不会自动产生打卡或完成记录。").font(.caption).foregroundStyle(.secondary)
            }
            Section("建议先练这一节") {
                if loading { ProgressView() }
                if let error { Text(error).foregroundStyle(.red); Button("重新加载建议") { Task { await load() } } }
                if let lesson = recent.first {
                    NavigationLink { PlayerView(lessonID: lesson.video_id, title: lesson.course_name) } label: {
                        VStack(alignment: .leading, spacing: 8) {
                            Text(lesson.course_name).font(.headline)
                            Text("因为这是你最近学习的课节，继续练习更容易保持连贯。").font(.subheadline).foregroundStyle(.secondary)
                        }
                    }
                } else if let course = courses.first {
                    NavigationLink { CatalogView(series: course) } label: { VStack(alignment: .leading, spacing: 8) {
                        Text(course.series_name).font(.headline)
                        Text("暂无最近学习记录，从已授权课程中选一节开始。").font(.subheadline).foregroundStyle(.secondary)
                    } }
                } else if !loading && error == nil { Text("还没有可用学习记录。可以先浏览学院，已授权课程会在登录后同步。") }
            }
            Section("练习工具") {
                NavigationLink { StudyItemsView(kind: "notes") } label: { Label("复习笔记", systemImage: "note.text") }
                NavigationLink { StudyItemsView(kind: "bookmarks") } label: { Label("练习收藏片段", systemImage: "bookmark") }
                NavigationLink { OfflineScheduleView() } label: { Label("查看预约与课表", systemImage: "calendar") }
                NavigationLink { GrowthView() } label: { Label("练习后打卡", systemImage: "checkmark.circle") }
            }
            Section("建议来源") { Text("由本机根据已授权课程、最近学习顺序和所选时间生成规则建议；不进行动作识别或 AI 教学评价。播放时仍会核验当前课程权限。").font(.caption).foregroundStyle(.secondary) }
        }.evaCompactLayout().navigationTitle("智能学习助手").task { await load() }.refreshable { await load() }
    }
    private func load() async {
        guard !loading, let token = session.token else { return }
        loading = true; error = nil; defer { loading = false }
        do {
            async let a: [RecentLesson] = session.api.request("/member/recent-courses", token: token)
            async let b: [Series] = session.api.request("/member/authorized-series", token: token)
            (recent, courses) = try await (a,b)
        } catch { recent = []; courses = []; self.error = error.localizedDescription }
    }
}

struct UnifiedSearchView: View {
    @EnvironmentObject var session: Session
    @StateObject private var courses = SiteStore()
    @StateObject private var offline = SiteStore()
    @StateObject private var events = SiteStore()
    @StateObject private var products = SiteStore()
    @EnvironmentObject var cart: ShoppingCart
    @State private var query = ""
    private func matching(_ rows: [SiteRow], fields: [String]) -> [SiteRow] {
        Array(rows.filter { PracticePlan.matches($0.value, query: query, fields: fields) }.prefix(30))
    }
    var body: some View {
        List {
            if query.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                Text("一次搜索课程、老师、赛事和商品。输入多个关键词可缩小范围。")
            } else {
                Section("线上课程") {
                    LoadState(store: courses) { Task { await courses.load("/public/series", session: session, publicRead: true) } }
                    let rows = matching(courses.data.scopedRows("search-courses"), fields: ["name","teacher","category","subtitle"])
                    ForEach(rows, id: \.listID) { row in NavigationLink { PublicCourseView(row: row.value) } label: { CourseCard(row: row.value) } }
                    if rows.isEmpty && !courses.busy && courses.error == nil { Text("没有匹配课程") }
                }
                Section("线下课程") {
                    LoadState(store: offline) { Task { await offline.load("/public/offline-courses", session: session, publicRead: true) } }
                    let rows = matching(offline.data.scopedRows("search-offline"), fields: ["name","teacher","location"])
                    ForEach(rows, id: \.listID) { row in NavigationLink { OfflineCourseDetailView(row: row.value) } label: { CourseCard(row: row.value) } }
                    if rows.isEmpty && !offline.busy && offline.error == nil { Text("没有匹配线下课") }
                }
                Section("赛事") {
                    LoadState(store: events) { Task { await events.load("/events", session: session, publicRead: true) } }
                    let rows = matching(events.data.scopedRows("search-events"), fields: ["name","city","venue","location"])
                    ForEach(rows, id: \.listID) { row in NavigationLink(row.value["name"].text) { EventDetailView(id: row.id) } }
                    if rows.isEmpty && !events.busy && events.error == nil { Text("没有匹配赛事") }
                }
                Section("商城商品") {
                    LoadState(store: products) { Task { await products.load("/shop/products", session: session, publicRead: true) } }
                    let rows = matching(products.data["products"].scopedRows("search-products"), fields: ["name","category","spec","color","size"])
                    ForEach(rows, id: \.listID) { row in NavigationLink { ProductView(product: row.value, cart: cart) } label: { ProductCard(product: row.value) } }
                    if rows.isEmpty && !products.busy && products.error == nil { Text("没有匹配商品") }
                }
            }
        }.evaCompactLayout().navigationTitle("全站搜索").searchable(text: $query, prompt: "课程、老师、赛事、商品")
            .task { await load() }.refreshable { await load() }
    }
    private func load() async {
        async let a: () = courses.load("/public/series", session: session, publicRead: true)
        async let b: () = events.load("/events", session: session, publicRead: true)
        async let c: () = products.load("/shop/products", session: session, publicRead: true)
        async let d: () = offline.load("/public/offline-courses", session: session, publicRead: true)
        _ = await (a,b,c,d)
    }
}
