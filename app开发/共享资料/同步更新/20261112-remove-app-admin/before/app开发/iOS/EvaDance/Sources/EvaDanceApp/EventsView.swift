import SwiftUI
import EvaCore

struct EventsView: View {
    @EnvironmentObject private var session: Session
    @Environment(\.dynamicTypeSize) private var typeSize
    @StateObject private var store = SiteStore()
    @State private var search = ""
    private var events: [SiteRow] {
        let query = search.trimmingCharacters(in: .whitespacesAndNewlines)
        return store.data.rows.filter {
            query.isEmpty || ($0.value["name"].text + " " + $0.value.firstText("location", "city", "venue")).localizedCaseInsensitiveContains(query)
        }
    }
    private var loaded: Bool { if case .array = store.data { return true }; return false }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    EvaSearchField(text: $search, prompt: "搜索赛事或地点").accessibilityIdentifier("events.search")
                    NavigationLink { AuthGate { MyCompetitionsView() } } label: {
                        Label("我的比赛", systemImage: "person.crop.circle").labelStyle(.iconOnly).frame(width: 44, height: 44)
                    }
                    NavigationLink { StaffEventRootView() } label: {
                        Label("赛事管理", systemImage: "person.badge.key").labelStyle(.iconOnly).frame(width: 44, height: 44)
                    }
                }
                overview
                LoadState(store: store) { Task { await load() } }
                LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12, alignment: .top), count: typeSize.isAccessibilitySize ? 1 : 2), alignment: .leading, spacing: 14) {
                    ForEach(events) { row in
                        NavigationLink { EventDetailView(id: row.id) } label: { eventCard(row.value) }
                            .buttonStyle(.plain)
                    }
                }
                if loaded && !store.busy && store.error == nil && events.isEmpty {
                    Text(search.isEmpty ? "暂无公开赛事" : "未找到匹配赛事，请更换名称或地点。")
                        .font(.subheadline).foregroundStyle(.secondary).frame(maxWidth: .infinity, minHeight: 80)
                }
            }.frame(maxWidth: 760).padding(.horizontal, 16).padding(.vertical, 6).frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
        .background(EvaBrand.canvas).evaPageChrome(root: true)
        #if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
        #endif
        .task { await load() }.refreshable { await load() }
    }
    private var overview: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("AiwaRaks赛事平台").font(.title2.bold()).fixedSize(horizontal: false, vertical: true)
            HStack(spacing: 0) {
                metric(loaded ? String(store.data.list.count) : "—", "赛事总数")
                Divider().frame(height: 36)
                metric(loaded ? EventPresentation.aggregate(store.data.list, participant: true) : "—", "累计参赛")
                Divider().frame(height: 36)
                metric(loaded ? EventPresentation.aggregate(store.data.list, participant: false) : "—", "记录数据")
            }.padding(.vertical, 4)
        }.padding(.vertical, 8).foregroundStyle(.primary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
    private func metric(_ value: String, _ label: String) -> some View {
        VStack(spacing: 4) {
            Text(value).font(.headline).monospacedDigit().lineLimit(1).minimumScaleFactor(0.75)
            Text(label).font(.caption2)
        }.frame(maxWidth: .infinity)
    }
    private func eventCard(_ row: JSONValue) -> some View {
        let state = EventPresentation.state(row), open = state == "报名中"
        return VStack(alignment: .leading, spacing: 0) {
            GeometryReader { geometry in
                ZStack(alignment: .topLeading) {
                    ZStack {
                        if let url = AppPolicy.secureMediaURL(row.firstText("coverUrl", "cover_url")) {
                            AsyncImage(url: url) { phase in
                                if let image = phase.image { image.resizable().scaledToFill().frame(width: geometry.size.width, height: geometry.size.height).clipped() }
                                else { coverPlaceholder }
                            }
                        } else { coverPlaceholder }
                    }.frame(width: geometry.size.width, height: geometry.size.height)
                    Text(state).font(.caption2.bold()).padding(.horizontal, 8).padding(.vertical, 5)
                        .foregroundStyle(open ? EvaBrand.onAccent : Color.primary)
                        .background(open ? EvaBrand.red : EvaBrand.surface, in: Capsule()).padding(8)
                }
            }.aspectRatio(1.25, contentMode: .fit)
            VStack(alignment: .leading, spacing: 10) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(EventPresentation.dateRange(row))
                    Text(row.firstText("location", "city", "venue").isEmpty ? "地点待定" : row.firstText("location", "city", "venue"))
                }.font(.caption2).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .topLeading)
                Text(row["name"].text).font(.subheadline.bold()).foregroundStyle(.primary)
                    .frame(maxWidth: .infinity, alignment: .topLeading).fixedSize(horizontal: false, vertical: true)
                Divider()
                HStack(spacing: 2) {
                    eventMetric(EventPresentation.count(row, "groupCount"), "组别")
                    eventMetric(EventPresentation.count(row, "playerCount"), "选手")
                    eventMetric(EventPresentation.count(row, "judgeCount"), "评委")
                }
                Text(open ? "点击报名 ›" : "查看详情 ›").font(.subheadline.bold())
                    .foregroundStyle(open ? EvaBrand.onAccent : EvaBrand.red)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .background(open ? EvaBrand.red : EvaBrand.softAccent, in: RoundedRectangle(cornerRadius: 8))
            }.padding(.vertical, 8)
        }
    }
    private var coverPlaceholder: some View {
        VStack(spacing: 8) { Image(systemName: "trophy").font(.title); Text("暂无封面").font(.caption) }
            .foregroundStyle(.secondary).frame(maxWidth: .infinity, maxHeight: .infinity).background(EvaBrand.canvas)
    }
    private func eventMetric(_ value: Int?, _ label: String) -> some View {
        VStack(spacing: 4) {
            Text(value.map(String.init) ?? "未公开").font(.caption.bold()).foregroundStyle(EvaBrand.red).lineLimit(1).minimumScaleFactor(0.7)
            Text(label).font(.caption2).foregroundStyle(.secondary)
        }.frame(maxWidth: .infinity)
    }
    private func load() async { await store.load("/events", session: session, publicRead: true) }
}
