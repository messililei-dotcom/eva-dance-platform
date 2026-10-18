import SwiftUI
import EvaCore

struct MyCompetitionsView: View {
    @EnvironmentObject private var session: Session
    @StateObject private var store = SiteStore()
    private var entries: [SiteRow] { store.data["entries"].scopedRows("my-competitions") }
    var body: some View {
        List {
            LoadState(store: store) { Task { await load() } }
            ForEach(entries, id: \.listID) { entry in
                VStack(alignment: .leading, spacing: 10) {
                    Text(entry.value["competitionName"].text).font(.headline)
                    Text([entry.value["groupName"].text, entry.value["playerNo"].text.isEmpty ? "" : "选手号 " + entry.value["playerNo"].text].filter { !$0.isEmpty }.joined(separator: " · "))
                    if !entry.value["entrantName"].text.isEmpty { Text("参赛人：" + entry.value["entrantName"].text) }
                    if !entry.value["performanceTitle"].text.isEmpty { Text("节目：" + entry.value["performanceTitle"].text) }
                    Text([CompetitionRecord.audit(entry.value["auditStatus"].text), CompetitionRecord.paid(entry.value["paidStatus"].text), String(entry.value["startDate"].text.prefix(10))].filter { !$0.isEmpty }.joined(separator: " · ")).font(.subheadline).foregroundStyle(.secondary)
                    Text(CompetitionRecord.result(entry.value)).font(.body.weight(.semibold)).foregroundStyle(EvaBrand.red)
                    if !entry.value["competitionId"].text.isEmpty {
                        NavigationLink("赛事详情") { EventDetailView(id: entry.value["competitionId"].text) }.frame(minHeight: 44)
                    }
                }.padding(.vertical, 8)
            }
            if !store.busy && store.error == nil && entries.isEmpty { Text("暂无比赛报名和结果记录").foregroundStyle(.secondary) }
        }.evaCompactLayout().navigationTitle("我的比赛")
        .task(id: session.accountID) { await load() }.refreshable { await load() }
    }
    private func load() async { await store.load("/member/events", session: session) }
}
