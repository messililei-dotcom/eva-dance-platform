import SwiftUI
import EvaCore

struct EventDetailView: View {
    @EnvironmentObject private var session: Session
    @StateObject private var store = SiteStore()
    let id: String
    @State private var panel = 0
    @State private var query = ""
    @State private var page = 1
    private let panels = ["赛事","组别","选手","评委","成绩"]
    private var event: JSONValue { store.data["competition"] }
    private var rows: [JSONValue] { store.data[panel == 1 ? "groups" : panel == 2 ? "players" : panel == 3 ? "judges" : "rankings"].list.filter { EventUI.matches($0, query: query) } }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                LoadState(store: store) { Task { await load() } }
                if event != .null {
                    hero
                    NavigationLink { JudgeWorkspaceView(eventID: id) } label: { Text("评委入口").font(.headline).frame(maxWidth: .infinity, minHeight: 44) }.buttonStyle(.borderedProminent).tint(EvaBrand.red)
                    EventSection { HStack { metric(EventUI.count(event, key: "groupCount", fallback: store.data["groups"].list.count),"组别"); Divider(); metric(event["registrationPublic"].bool ? EventUI.count(event,key: "approvedPlayerCount",fallback:store.data["players"].list.count) : "—","选手"); Divider(); metric(EventUI.count(event,key: "judgeCount",fallback:store.data["judges"].list.count),"评委") }.frame(minHeight: 48) }
                    ScrollView(.horizontal, showsIndicators: false) { HStack(spacing: 8) { ForEach(panels.indices, id: \.self) { index in Button { panel = index; page = 1; query = "" } label: { Text(panels[index]).font(.headline).padding(.horizontal,18).frame(minHeight:44).foregroundStyle(panel == index ? EvaBrand.onAccent : Color.primary).background(panel == index ? EvaBrand.red : EvaBrand.surface,in:Capsule()) }.buttonStyle(.plain).accessibilityAddTraits(panel == index ? .isSelected : []) } } }
                    if panel == 0 { overview } else { publicPanel }
                    if EventPresentation.state(event) == "报名中" { NavigationLink { AuthGate { EventRegistrationView(eventID: id, group: nil) } } label: { Text("立即报名").font(.headline).frame(maxWidth:.infinity,minHeight:48) }.buttonStyle(.borderedProminent).tint(EvaBrand.red) }
                    else { Text(EventPresentation.state(event)).foregroundStyle(.secondary).frame(maxWidth:.infinity,minHeight:48) }
                }
            }.frame(maxWidth:760).padding(12).frame(maxWidth:.infinity)
        }.eventPage().evaPageChrome().navigationTitle(event["name"].text).task { await load() }.refreshable { await load() }.onChange(of:query) { _ in page=1 }
    }
    private var hero: some View {
        GeometryReader { g in ZStack(alignment:.bottomLeading) {
            if let url=AppPolicy.secureMediaURL(event.firstText("coverUrl","cover_url")) { AsyncImage(url:url) { image in image.resizable().scaledToFill().frame(width:g.size.width,height:g.size.height).clipped() } placeholder: { Color(white:0.1) } } else { Color(white:0.1) }
            LinearGradient(colors:[.clear,.black.opacity(0.85)],startPoint:.top,endPoint:.bottom)
            VStack(alignment:.leading,spacing:10) { if !event["code"].text.isEmpty { Text(event["code"].text).font(.caption.bold()).foregroundStyle(EvaBrand.gold) }; Text(event["name"].text).font(.title2.bold()).foregroundStyle(.white); Text(EventPresentation.dateRange(event)+" · "+(event.firstText("location","venue","city").isEmpty ? "地点待定" : event.firstText("location","venue","city"))).font(.subheadline).foregroundStyle(.white.opacity(0.75)) }.padding(16)
        }.clipShape(RoundedRectangle(cornerRadius:14)) }.aspectRatio(4/3,contentMode:.fit).accessibilityElement(children:.combine)
    }
    private func metric(_ value:String,_ label:String)->some View { VStack(spacing:5) { Text(value).font(.title2.bold());Text(label).font(.subheadline).foregroundStyle(.secondary) }.frame(maxWidth:.infinity) }
    private var overview: some View {
        VStack(spacing:14) {
            EventSection(title:"赛事信息") { EventInfoRow(label:"主办方",value:event["organizer"].text.isEmpty ? "伊娃东方舞" : event["organizer"].text);EventInfoRow(label:"比赛地点",value:event.firstText("location","venue","city").isEmpty ? "地点待定" : event.firstText("location","venue","city"));EventInfoRow(label:"报名状态",value:EventPresentation.state(event),highlight:true);EventInfoRow(label:"报名费用",value:event["registrationFee"].number>0 ? "¥"+event["registrationFee"].text : "免费");Text(plain(event["description"].text.isEmpty ? "赛事介绍正在完善中。" : event["description"].text)).font(.body).foregroundStyle(.secondary).textSelection(.enabled) }
            if !store.data["sessions"].list.isEmpty { EventSection(title:"赛事日程") { ForEach(store.data["sessions"].rows) { row in VStack(alignment:.leading,spacing:6) { Text(row.value["name"].text).font(.headline);Text([row.value["startsAt"].text,row.value["venue"].text].filter{ !$0.isEmpty }.joined(separator:" · ")).font(.subheadline).foregroundStyle(.secondary);Divider() } } } }
            if session.token != nil { EventSection { NavigationLink("我的报名、音乐与缴费") { MyCompetitionsView() }.frame(minHeight:44) } }
        }
    }
    private var publicPanel: some View {
        EventSection(title: panels[panel]) {
            TextField(panel == 1 ? "搜索组别、舞种或年龄" : panel == 3 ? "搜索评委" : "搜索选手、编号或机构",text:$query).registrationInput(border:Color.gray.opacity(0.25))
            ForEach(JSONValue.array(Array(rows.dropFirst((min(page,max(1,Int(ceil(Double(rows.count)/20))))-1)*20).prefix(20))).rows) { row in
                if panel == 1 { NavigationLink { EventGroupView(eventID:id,groupID:row.id) } label: { HStack { VStack(alignment:.leading,spacing:6) { Text(row.value["name"].text).font(.headline);Text((row.value["rankingCount"].number>0 ? row.value["rankingCount"].text+" 项成绩" : "成绩待公布")+" · "+(row.value["playerCount"] == .null ? "报名信息未公开" : row.value["playerCount"].text+" 位选手")).font(.subheadline).foregroundStyle(.secondary) };Spacer();Image(systemName:"chevron.right").foregroundStyle(.secondary) }.frame(minHeight:60) }.buttonStyle(.plain) }
                else if panel == 3 { HStack(spacing:12) { EventAvatar(row:row.value);VStack(alignment:.leading,spacing:6) { Text(row.value["name"].text).font(.headline);Text([row.value["title"].text,row.value["organization"].text].filter{ !$0.isEmpty }.joined(separator:" · ")).font(.subheadline).foregroundStyle(.secondary);if !row.value["bio"].text.isEmpty { Text(plain(row.value["bio"].text)).font(.subheadline).foregroundStyle(.secondary) } } }.frame(maxWidth:.infinity,alignment:.leading) }
                else { NavigationLink { EventPlayerView(eventID:id,groupID:row.value["groupId"].text,playerID:row.value.firstText("playerId","id")) } label: { EventPersonRow(row:row.value,result:panel == 4) }.buttonStyle(.plain) }
                Divider()
            }
            if rows.isEmpty { Text(panel == 1 ? "没有找到符合条件的组别" : panel == 2 ? (event["registrationPublic"].bool ? "暂无报名信息" : "报名信息尚未公开") : panel == 3 ? "评委阵容暂未公布" : "成绩经统一平台审核发布后在这里公示").foregroundStyle(.secondary).frame(maxWidth:.infinity,minHeight:90) }
            EventPages(page:$page,total:rows.count)
        }
    }
    private func load() async { await store.load("/events/\(id)",session:session,publicRead:true) }
}
