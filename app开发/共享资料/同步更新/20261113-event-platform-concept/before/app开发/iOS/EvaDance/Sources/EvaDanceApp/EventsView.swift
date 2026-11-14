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

                }
                overview
                LoadState(store: store) { Task { await load() } }
                LazyVGrid(columns: typeSize.isAccessibilitySize ? [GridItem(.flexible())] : [GridItem(.adaptive(minimum: 280), spacing: 16, alignment: .top)], alignment: .leading, spacing: 14) {
                    ForEach(events) { row in
                        VStack(spacing: 4) {
                            ZStack(alignment: .topLeading) {
                                NavigationLink { EventDetailView(id: row.id) } label: { eventCard(row.value) }.buttonStyle(.plain)
                                if EventPresentation.state(row.value) == "报名中" {
                                    NavigationLink { AuthGate { EventRegistrationView(eventID: row.id, group: nil) } } label: {
                                        Text("报名中 · 点击报名").font(.subheadline.bold()).padding(.horizontal, 12).frame(minHeight: 44)
                                            .foregroundStyle(EvaBrand.onAccent).background(EvaBrand.red, in: Capsule())
                                    }.buttonStyle(.plain).padding(8)
                                        .accessibilityLabel("报名：" + row.value["name"].text)
                                        .accessibilityIdentifier("event.register.badge." + row.id)
                                }
                            }
                            if EventPresentation.state(row.value) == "报名中" {
                                NavigationLink { AuthGate { EventRegistrationView(eventID: row.id, group: nil) } } label: { Text("点击报名 ›").font(.headline).frame(maxWidth: .infinity, minHeight: 48) }.buttonStyle(.borderedProminent).tint(EvaBrand.red)
                            } else {
                                NavigationLink { EventDetailView(id: row.id) } label: { Text("查看赛事 ›").font(.headline).frame(maxWidth: .infinity, minHeight: 48) }.buttonStyle(.bordered).tint(EvaBrand.red)
                            }
                            Divider().padding(.top, 10)
                        }
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
            Text(label).font(.subheadline)
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
                    if !open { Text(state).font(.subheadline.bold()).padding(.horizontal, 8).padding(.vertical, 5)
                        .foregroundStyle(open ? EvaBrand.onAccent : Color.primary)
                        .background(open ? EvaBrand.red : EvaBrand.surface, in: Capsule()).padding(8) }
                }
            }.aspectRatio(2.15, contentMode: .fit)
            VStack(alignment: .leading, spacing: 10) {
                Text(row["name"].text).font(.subheadline.bold()).foregroundStyle(.primary)
                    .frame(maxWidth: .infinity, alignment: .topLeading).fixedSize(horizontal: false, vertical: true)
                VStack(alignment: .leading, spacing: 3) {
                    Text(EventPresentation.dateRange(row))
                    Text(row.firstText("location", "city", "venue").isEmpty ? "地点待定" : row.firstText("location", "city", "venue"))
                }.font(.subheadline).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .topLeading)
                Divider()
                HStack(spacing: 2) {
                    eventMetric(EventPresentation.count(row, "groupCount"), "组别")
                    eventMetric(EventPresentation.count(row, "playerCount"), "选手")
                    eventMetric(EventPresentation.count(row, "judgeCount"), "评委")
                }

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
            Text(label).font(.subheadline).foregroundStyle(.secondary)
        }.frame(maxWidth: .infinity)
    }
    private func load() async { await store.load("/events", session: session, publicRead: true) }
}
