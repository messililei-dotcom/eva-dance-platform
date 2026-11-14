import SwiftUI
import EvaCore

struct MyCompetitionsView: View {
    @EnvironmentObject private var session: Session
    @StateObject private var store = SiteStore()
    @State private var query = ""
    @State private var page = 1
    private var entries: [SiteRow] { store.data["entries"].scopedRows("my-competitions").filter { query.isEmpty || ($0.value["competitionName"].text+" "+$0.value["groupName"].text+" "+$0.value["entrantName"].text).localizedCaseInsensitiveContains(query) } }
    var body: some View {
        ScrollView {
            VStack(alignment:.leading,spacing:14) {
                Text("我的比赛").font(.title2.bold())
                TextField("搜索赛事、组别或参赛人",text:$query).registrationInput(border:Color.gray.opacity(0.25))
                LoadState(store:store) { Task { await load() } }
                ForEach(Array(entries.dropFirst((min(page,max(1,Int(ceil(Double(entries.count)/20))))-1)*20).prefix(20)),id:\.listID) { entry in
                    EventSection(title:entry.value["competitionName"].text) {
                        Text(entry.value["groupName"].text).font(.headline)
                        Text([entry.value["entrantName"].text,entry.value["playerNo"].text.isEmpty ? "" : "编号 "+entry.value["playerNo"].text].filter { !$0.isEmpty }.joined(separator:" · ")).font(.subheadline)
                        if !entry.value["performanceTitle"].text.isEmpty { Text("节目："+entry.value["performanceTitle"].text).font(.subheadline) }
                        Text([CompetitionRecord.audit(entry.value["auditStatus"].text),CompetitionRecord.paid(entry.value["paidStatus"].text),String(entry.value["startDate"].text.prefix(10))].filter { !$0.isEmpty }.joined(separator:" · ")).font(.subheadline).foregroundStyle(.secondary)
                        Text(CompetitionRecord.result(entry.value)).font(.headline).foregroundStyle(EvaBrand.red)
                        if entry.value["resultPublished"].bool && !entry.value["judgeScores"].list.isEmpty {
                            DisclosureGroup("评委评分") { ForEach(entry.value["judgeScores"].rows) { score in EventInfoRow(label:score.value["judgeName"].text,value:EventUI.score(score.value["score"])) } }
                        }
                        if entry.value["canPay"].bool, let url=URL(string:"https://www.swod.com.cn/checkout/event/"+entry.value["playerId"].text) { Link("继续缴费 · 前往官方收银台",destination:url).frame(minHeight:44) }
                        if let id=Int(entry.value["playerId"].text),id>0 { NavigationLink("修改报名 / 补交音乐") { EventRegistrationView(eventID:"",group:nil,playerID:String(id)) }.frame(minHeight:44) }
                        if !entry.value["competitionId"].text.isEmpty { NavigationLink("赛事详情") { EventDetailView(id:entry.value["competitionId"].text) }.frame(minHeight:44) }
                    }
                }
                EventPages(page:$page,total:entries.count)
                if !store.busy && store.error == nil && entries.isEmpty { EventSection { Text(query.isEmpty ? "暂无比赛报名和结果记录" : "未找到匹配记录").foregroundStyle(.secondary) } }
            }.frame(maxWidth:760).padding(12).frame(maxWidth:.infinity)
        }.eventPage().evaPageChrome().navigationTitle("我的比赛").onChange(of:query) { _ in page=1 }.task(id:session.accountID) { await load() }.refreshable { await load() }
    }
    private func load() async { await store.load("/member/events",session:session) }
}
