import SwiftUI
import EvaCore

struct CoursePriceLine: View {
    @EnvironmentObject var session: Session
    var online = false
    let row: JSONValue
    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 8) {
            if online && session.isCourseUnlocked(row["id"].text) {
                Text("✓ 已解锁").font(.headline).foregroundStyle(.green)
                Text("继续学习").font(.subheadline).foregroundStyle(.green)
            } else if online && session.token != nil && !session.courseAccessReady {
                Text("学习权益确认中").font(.caption).foregroundStyle(.secondary)
            } else {
            Text(CoursePresentation.price(row)).font(.headline).foregroundStyle(EvaBrand.red)
            if let original = CoursePresentation.originalPrice(row) { Text(original).font(.caption).strikethrough().foregroundStyle(.secondary) }
            }
        }.accessibilityElement(children: .combine)
    }
}
struct LessonCatalogView: View {
    @EnvironmentObject var session: Session
    @StateObject private var store = SiteStore()
    @State private var query = ""
    @State private var page = 1
    @State private var progress = JSONValue.null
    @State private var selectedID: String?
    @State private var showPlayer = false
    let id: Int
    let title: String
    private var lessons: [JSONValue] { CoursePresentation.catalog(store.data, progress: progress) }
    private var filtered: [JSONValue] { lessons.filter { query.trimmingCharacters(in: .whitespaces).isEmpty || $0["name"].text.localizedCaseInsensitiveContains(query.trimmingCharacters(in: .whitespaces)) } }
    private var pages: Int { max(1, (filtered.count + 49) / 50) }
    private var visible: [JSONValue] { Array(filtered.dropFirst((min(page, pages) - 1) * 50).prefix(50)) }
    var body: some View {
        ScrollViewReader { proxy in
            List {
                LoadState(store: store) { Task { await load() } }
                Section {
                    HStack {
                        VStack(alignment: .leading, spacing: 6) { Text("课节目录").font(.headline); Text("共 \(lessons.count) 节").font(.subheadline).foregroundStyle(.secondary) }
                        Spacer()
                        if let selectedID { Button("定位当前") {
                            query = ""; if let index = lessons.firstIndex(where: { $0["id"].text == selectedID }) { page = index / 50 + 1 }
                            Task { @MainActor in await Task.yield(); proxy.scrollTo(selectedID, anchor: .center) }
                        }.frame(minHeight: 44) }
                    }.id("catalog-top")
                    TextField("搜索课节名称", text: $query).accessibilityLabel("搜索课节名称").frame(minHeight: 44).onChange(of: query) { _ in page = 1 }
                    if pages > 1 { pagination(proxy) }
                    ForEach(JSONValue.array(visible).rows) { lesson in
                        Button {
                            selectedID = lesson.id; showPlayer = true
                        } label: {
                            HStack(alignment: .top, spacing: 12) {
                                Text(lesson.value["ordinal"].text).font(.subheadline.monospacedDigit()).frame(width: 30, height: 30).background(selectedID == lesson.id ? EvaBrand.softAccent : EvaBrand.canvas, in: RoundedRectangle(cornerRadius: 8))
                                VStack(alignment: .leading, spacing: 8) {
                                    Text(lesson.value["name"].text).font(.body.weight(selectedID == lesson.id ? .semibold : .regular)).fixedSize(horizontal: false, vertical: true)
                                    HStack { Text(duration(lesson.value["duration"].number)); if selectedID == lesson.id { Text("当前课节").foregroundStyle(EvaBrand.red) } }.font(.caption).foregroundStyle(.secondary)
                                }.frame(maxWidth: .infinity, alignment: .leading)
                                Text(status(lesson.value)).font(.caption).foregroundStyle(.secondary)
                            }.foregroundStyle(selectedID == lesson.id ? EvaBrand.red : .primary).padding(.vertical, 10).frame(minHeight: 64)
                        }.buttonStyle(.plain).listRowBackground(selectedID == lesson.id ? EvaBrand.softAccent : EvaBrand.surface).id(lesson.id)
                    }
                    if !store.busy && store.error == nil && visible.isEmpty { Text(query.isEmpty ? "暂无课节" : "未找到匹配课节").foregroundStyle(.secondary); if !query.isEmpty { Button("清空搜索") { query = "" } } }
                    if pages > 1 { pagination(proxy) }
                }
            }.navigationDestination(isPresented: $showPlayer) {
                if let selectedID, let lessonID = Int(selectedID), let lesson = lessons.first(where: { $0["id"].text == selectedID }) { AuthGate { PlayerView(lessonID: lessonID, title: lesson["name"].text) } }
            }
        }.evaCompactLayout().navigationTitle(title).task { await load() }.refreshable { await load() }
    }
    private func pagination(_ proxy: ScrollViewProxy) -> some View {
        HStack {
            Button("上一页") { page -= 1; proxy.scrollTo("catalog-top", anchor: .top) }.disabled(page <= 1).frame(minWidth: 60, minHeight: 44)
            Spacer(); Text("第 \(min(page, pages)) / \(pages) 页").font(.subheadline.monospacedDigit()); Spacer()
            Button("下一页") { page += 1; proxy.scrollTo("catalog-top", anchor: .top) }.disabled(page >= pages).frame(minWidth: 60, minHeight: 44)
        }.buttonStyle(.borderless)
    }
    private func duration(_ seconds: Double) -> String { seconds > 0 ? String(format: "%d:%02d", Int(seconds) / 60, Int(seconds) % 60) : "时长待更新" }
    private func status(_ lesson: JSONValue) -> String { lesson["percent"] == .null ? "进度待同步" : lesson["percent"].number >= 100 ? "已学完" : lesson["percent"].number > 0 ? "已学 \(lesson["percent"].text)%" : "未开始" }
    private func load() async {
        await store.load("/public/series/\(id)/courses", session: session, publicRead: true)
        if let token = session.token { progress = (try? await session.api.request("/public/series/\(id)/progress", token: token)) ?? .null } else { progress = .null }
        page = min(page, pages)
    }
}
