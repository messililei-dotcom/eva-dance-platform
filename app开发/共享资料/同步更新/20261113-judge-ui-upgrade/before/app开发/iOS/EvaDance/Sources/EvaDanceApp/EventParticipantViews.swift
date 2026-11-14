import SwiftUI
import EvaCore

struct EventGroupView: View {
    @EnvironmentObject private var session: Session
    @StateObject private var store=SiteStore()
    let eventID:String, groupID:String
    @State private var query=""
    @State private var page=1
    private var group:JSONValue { store.data["group"] }
    private var players:[JSONValue] { store.data["players"].list.filter { EventUI.matches($0,query:query) } }
    private var published:Bool { group["rankingCount"].number>0 || store.data["players"].list.contains { $0["resultPublished"].bool } }
    var body:some View {
        ScrollView { VStack(alignment:.leading,spacing:14) {
            LoadState(store:store) { Task { await load() } }
            if group != .null {
                VStack(alignment: .leading, spacing: 14) {
                    Text(store.data["competition"]["name"].text).font(.subheadline).foregroundStyle(.secondary)
                    Text(group["name"].text).font(.title.bold()).fixedSize(horizontal: false, vertical: true)
                    Text(["category","ageRange","danceType","entryType"].map { group[$0].text }.filter { !$0.isEmpty }.joined(separator: " · ")).font(.subheadline).foregroundStyle(.secondary)
                    Text((store.data["competition"]["registrationPublic"].bool ? String(store.data["players"].list.count) : "—") + " 位选手 · " + group["rankingCount"].text + " 项已公布成绩").font(.subheadline).foregroundStyle(EvaBrand.red)
                    Divider()
                }.padding(.vertical, 12).frame(maxWidth: .infinity, alignment: .leading)
                if !podium.isEmpty {
                    VStack(spacing: 6) { Text("荣誉榜").font(.title2.bold()).foregroundStyle(EvaBrand.red); Text("成绩经赛事平台审核发布").font(.subheadline).foregroundStyle(.secondary) }.frame(maxWidth: .infinity)
                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 92), spacing: 8, alignment: .bottom)], alignment: .center, spacing: 10) {
                        ForEach(JSONValue.array(podium).rows) { row in
                            NavigationLink { EventPlayerView(eventID: eventID, groupID: groupID, playerID: row.id) } label: {
                                VStack(spacing: 10) {
                                    EventAvatar(row: row.value, size: 64)
                                    Label(EventUI.rank(row.value), systemImage: "trophy.fill").font(.subheadline.bold()).foregroundStyle(EvaBrand.gold)
                                    Text(row.value["name"].text).font(.headline).foregroundStyle(.primary).fixedSize(horizontal: false, vertical: true)
                                    Text(EventUI.score(row.value["publishedTotal"]) + " 分").font(.headline).monospacedDigit().foregroundStyle(EvaBrand.red)
                                }.padding(.horizontal, 6).padding(.bottom, 16).padding(.top, row.value["rankNo"].number == 1 ? 30 : 14).frame(maxWidth: .infinity).background(row.value["rankNo"].number == 1 ? EvaBrand.softAccent : EvaBrand.surface, in: RoundedRectangle(cornerRadius: 14))
                            }.buttonStyle(.plain)
                        }
                    }
                }
                EventSection(title:published ? "成绩排名" : "参赛选手") {
                    TextField("搜索选手、编号或机构",text:$query).registrationInput(border:Color.gray.opacity(0.25))
                    ForEach(JSONValue.array(Array(players.dropFirst((min(page,max(1,Int(ceil(Double(players.count)/20))))-1)*20).prefix(20))).rows) { row in NavigationLink { EventPlayerView(eventID:eventID,groupID:groupID,playerID:row.id) } label: { EventPersonRow(row:row.value,result:published) }.buttonStyle(.plain);Divider() }
                    if players.isEmpty { Text(query.isEmpty ? (store.data["competition"]["registrationPublic"].bool ? "该组别暂无报名选手" : "报名信息尚未公开") : "未找到匹配选手").foregroundStyle(.secondary).frame(maxWidth:.infinity,minHeight:80) }
                    EventPages(page:$page,total:players.count)
                }
            }
        }.frame(maxWidth:760).padding(12).frame(maxWidth:.infinity) }.eventPage().evaPageChrome().navigationTitle(group["name"].text).task { await load() }.refreshable { await load() }.onChange(of:query) { _ in page=1 }
    }
    private var podium:[JSONValue] { store.data["players"].list.filter { $0["rankNo"].number>0 && $0["rankNo"].number<=3 }.sorted { ([2.0,1.0,3.0].firstIndex(of: $0["rankNo"].number) ?? 3) < ([2.0,1.0,3.0].firstIndex(of: $1["rankNo"].number) ?? 3) } }
    private func load()async { await store.load("/events/\(eventID)/groups/\(groupID)",session:session,publicRead:true) }
}
struct EventPlayerView: View {
    @EnvironmentObject private var session:Session
    @StateObject private var store=SiteStore()
    let eventID:String,groupID:String,playerID:String
    private var player:JSONValue { store.data["player"] }
    var body:some View {
        ScrollView { VStack(spacing:14) {
            LoadState(store:store) { Task { await load() } }
            if player != .null {
                VStack(spacing:12) { EventAvatar(row:player);Text(player["name"].text).font(.title2.bold());Text(store.data["competition"]["name"].text).font(.subheadline);NavigationLink(store.data["group"]["name"].text+" ›") { EventGroupView(eventID:eventID,groupID:groupID) }.frame(minHeight:44) }.padding(20).frame(maxWidth:.infinity).foregroundStyle(EvaBrand.gold).background(Color(red:0.09,green:0.16,blue:0.24),in:RoundedRectangle(cornerRadius:14))
                EventSection(title:"参赛详情") { EventInfoRow(label:"编号",value:player["playerNo"].text.isEmpty ? "未编号" : player["playerNo"].text);if !player["organization"].text.isEmpty { EventInfoRow(label:"机构 / 舞蹈室",value:player["organization"].text) };if !player["teacher"].text.isEmpty { EventInfoRow(label:"指导老师",value:player["teacher"].text) };EventInfoRow(label:"节目名称",value:player["performanceTitle"].text.isEmpty ? "未填写" : player["performanceTitle"].text) }
                EventSection { VStack(spacing:8) { Text(EventUI.rank(player)).foregroundStyle(EvaBrand.gold);Text(EventUI.score(player["publishedTotal"])).font(.largeTitle.bold()).foregroundStyle(EvaBrand.red);Text("最终得分").font(.subheadline).foregroundStyle(.secondary) }.frame(maxWidth:.infinity) }
                EventSection(title:"评委评分") { if !store.data["competition"]["judgeScoresPublic"].bool { Text("个人评分未公开，评委身份可通过评委入口查看。").font(.subheadline).foregroundStyle(.secondary) };ForEach(store.data["judgeScores"].rows) { row in HStack { EventAvatar(row:row.value);VStack(alignment:.leading) { Text(row.value["name"].text).font(.headline);Text(row.value["title"].text).font(.subheadline).foregroundStyle(.secondary) };Spacer();Text(row.value["score"] == .null ? "未公开" : EventUI.score(row.value["score"])).foregroundStyle(EvaBrand.red) };Divider() };if store.data["judgeScores"].list.isEmpty { Text("评分发布后在此展示").foregroundStyle(.secondary) } }
            }
        }.frame(maxWidth:760).padding(12).frame(maxWidth:.infinity) }.eventPage().evaPageChrome().navigationTitle(player["name"].text+" · 参赛详情").task { await load() }.refreshable { await load() }
    }
    private func load()async { await store.load("/events/\(eventID)/groups/\(groupID)/players/\(playerID)",session:session,publicRead:true) }
}
