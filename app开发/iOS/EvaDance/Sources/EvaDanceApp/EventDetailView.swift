import SwiftUI
import EvaCore

struct EventDetailView: View {
    @EnvironmentObject private var session: Session
    @StateObject private var store = SiteStore()
    let id: String
    @State private var panel = 1
    @State private var query = ""
    @State private var ageFilter = "全部"
    @Environment(\.dynamicTypeSize) private var typeSize
    @State private var page = 1
    private let panels = ["概览","组别","选手","评委","成绩"]
    private var event: JSONValue { store.data["competition"] }
    private var rows: [JSONValue] { (panel == 3 && !event["judgeScoresPublic"].bool ? [] : store.data[panel == 1 ? "groups" : panel == 2 ? "players" : panel == 3 ? "judges" : "rankings"].list).filter { EventUI.matches($0, query: query) && (panel != 1 || ageFilter == "全部" || EventUI.ageGroup($0) == ageFilter) } }
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                LoadState(store: store) { Task { await load() } }
                if event != .null {
                    hero
                    HStack(spacing: 0) {
                        ForEach(panels.indices, id: \.self) { index in
                            Button { panel = index; page = 1; query = "" } label: {
                                VStack(spacing: 10) { Text(panels[index]).font(.headline).fixedSize(horizontal: false, vertical: true); Capsule().fill(panel == index ? EvaBrand.red : .clear).frame(height: 3).padding(.horizontal, 12) }.padding(.top, 12).frame(maxWidth: .infinity, minHeight: 48).foregroundStyle(panel == index ? EvaBrand.red : Color.secondary)
                            }.buttonStyle(.plain).accessibilityAddTraits(panel == index ? .isSelected : [])
                        }
                    }.overlay(alignment: .bottom) { Divider().offset(y: 1) }
                    if panel == 0 { overview } else if panel == 1 { groupPanel } else { publicPanel }

                }
            }.frame(maxWidth:760).padding(12).frame(maxWidth:.infinity)
        }.safeAreaInset(edge: .bottom) { if event != .null { registrationBar } }
        #if os(iOS)
        .toolbar(.hidden, for: .tabBar)
        #endif
        .eventPage().evaPageChrome().navigationTitle("赛事详情").task { await load() }.refreshable { await load() }.onChange(of:query) { _ in page=1 }
    }
    private var hero: some View {
        VStack(alignment: .leading, spacing: 14) {
            GeometryReader { g in
                ZStack(alignment: .topLeading) {
                    if let url = AppPolicy.secureMediaURL(event.firstText("coverUrl", "cover_url")) {
                        AsyncImage(url: url) { phase in
                            if let image = phase.image { image.resizable().scaledToFill().frame(width: g.size.width, height: g.size.height).clipped() }
                            else { EvaBrand.softAccent }
                        }
                    } else { EvaBrand.softAccent }
                    Text(EventPresentation.state(event)).font(.caption.bold()).padding(8).foregroundStyle(EvaBrand.onAccent).background(EvaBrand.red, in: Capsule()).padding(10)
                }.frame(width: g.size.width, height: g.size.height).clipShape(RoundedRectangle(cornerRadius: 14))
            }.aspectRatio(2.4, contentMode: .fit).accessibilityHidden(true)
            if typeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 12) { eventTitle; eventMetrics }
            } else {
                HStack(alignment: .center, spacing: 12) { eventTitle.frame(maxWidth: .infinity, alignment: .leading); eventMetrics.frame(maxWidth: .infinity) }
            }
            Text(EventPresentation.dateRange(event) + " · " + (event.firstText("location", "venue", "city").isEmpty ? "地点待定" : event.firstText("location", "venue", "city"))).font(.subheadline).foregroundStyle(.secondary)
            Text("主办方：" + (event["organizer"].text.isEmpty ? "待公布" : event["organizer"].text)).font(.subheadline).foregroundStyle(.secondary)
        }
    }
    private var eventTitle: some View { Text(event["name"].text).font(.title2.bold()).fixedSize(horizontal: false, vertical: true) }
    private var eventMetrics: some View {
        HStack(spacing: 4) {
            metric(EventUI.count(event, key: "groupCount", fallback: store.data["groups"].list.count), "组别")
            Divider().frame(height: 32)
            metric(event["registrationPublic"].bool ? EventUI.count(event, key: "approvedPlayerCount", fallback: store.data["players"].list.count) : "—", "选手")
            Divider().frame(height: 32)
            metric(EventUI.count(event, key: "judgeCount", fallback: store.data["judges"].list.count), "评委")
        }
    }
    private func metric(_ value: String, _ label: String) -> some View {
        VStack(spacing: 5) { Text(value).font(.title3.bold()).monospacedDigit().lineLimit(1).minimumScaleFactor(0.75); Text(label).font(.caption).foregroundStyle(.secondary) }.frame(maxWidth: .infinity)
    }
    private var registrationBar: some View {
        HStack(spacing: 10) {
            NavigationLink { AuthGate { MyCompetitionsView() } } label: { Text("我的报名").font(.headline).frame(maxWidth: .infinity, minHeight: 48).foregroundStyle(.primary).background(EvaBrand.surface, in: RoundedRectangle(cornerRadius: 12)).overlay { RoundedRectangle(cornerRadius: 12).stroke(Color.secondary.opacity(0.5), lineWidth: 1) } }.buttonStyle(.plain)
            if EventPresentation.state(event) == "报名中" {
                NavigationLink { AuthGate { EventRegistrationView(eventID: id, group: nil) } } label: { Text("立即报名").font(.headline).frame(maxWidth: .infinity, minHeight: 48).foregroundStyle(EvaBrand.onAccent).background(EvaBrand.red, in: RoundedRectangle(cornerRadius: 12)) }.buttonStyle(.plain)
            } else { Text("报名已关闭").font(.headline).foregroundStyle(.secondary).frame(maxWidth: .infinity, minHeight: 48).background(EvaBrand.surface, in: RoundedRectangle(cornerRadius: 12)) }
        }.padding(.horizontal, 16).padding(.vertical, 10).background(EvaBrand.canvas).overlay(alignment: .top) { Divider() }
    }
    private var groupPanel: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack { Text("赛事组别").font(.title3.bold()); Spacer(); Text("共\(store.data["groups"].list.count)组").font(.subheadline).foregroundStyle(.secondary) }
            TextField("搜索组别、舞种或年龄", text: $query).registrationInput(border: Color.gray.opacity(0.25))
            HStack(spacing: 8) { ForEach(["全部", "成人", "青少年", "少儿"], id: \.self) { label in
                Button { ageFilter = label; page = 1 } label: { Text(label).font(.subheadline).frame(maxWidth: .infinity, minHeight: 44).foregroundStyle(ageFilter == label ? EvaBrand.onAccent : Color.secondary).background(ageFilter == label ? EvaBrand.red : EvaBrand.surface, in: Capsule()) }.buttonStyle(.plain).accessibilityAddTraits(ageFilter == label ? .isSelected : [])
            } }
            ForEach(JSONValue.array(Array(rows.dropFirst((min(page,max(1,Int(ceil(Double(rows.count)/20))))-1)*20).prefix(20))).rows) { row in
                NavigationLink { EventGroupView(eventID: id, groupID: row.id) } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "trophy").font(.title3).foregroundStyle(EvaBrand.gold).frame(width: 36, height: 46).background(EvaBrand.softAccent, in: RoundedRectangle(cornerRadius: 9))
                        VStack(alignment: .leading, spacing: 6) {
                            Text(row.value["name"].text).font(.headline).foregroundStyle(.primary).fixedSize(horizontal: false, vertical: true)
                            Text([row.value["ageRange"].text, row.value["playerCount"] == .null ? "报名信息未公开" : row.value["playerCount"].text + "位选手"].filter { !$0.isEmpty }.joined(separator: " · ")).font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
                        }.frame(maxWidth: .infinity, alignment: .leading)
                        Text(row.value["rankingCount"].number > 0 ? "已公示" + row.value["rankingCount"].text + "项得分" : EventPresentation.state(event) == "报名中" ? "报名中" : "成绩待公布").font(.caption).foregroundStyle(row.value["rankingCount"].number > 0 ? EvaBrand.gold : EvaBrand.red).padding(6).background(EvaBrand.softAccent, in: RoundedRectangle(cornerRadius: 8)).fixedSize(horizontal: false, vertical: true).frame(maxWidth: 72)
                        Image(systemName: "chevron.right").font(.caption).foregroundStyle(.secondary)
                    }.padding(12).frame(minHeight: 76).background(EvaBrand.surface, in: RoundedRectangle(cornerRadius: 14))
                }.buttonStyle(.plain)
            }
            if rows.isEmpty { Text("没有找到符合条件的组别").font(.subheadline).foregroundStyle(.secondary).frame(maxWidth: .infinity, minHeight: 80) }
            EventPages(page: $page, total: rows.count)
        }
    }
    private var overview: some View {
        VStack(spacing:14) {
            EventSection { NavigationLink { JudgeWorkspaceView(eventID: id) } label: { Label("评委入口", systemImage: "person.badge.key").frame(minHeight: 44) } }
            EventSection(title:"赛事信息") { EventInfoRow(label:"主办方",value:event["organizer"].text.isEmpty ? "待公布" : event["organizer"].text);EventInfoRow(label:"比赛地点",value:event.firstText("location","venue","city").isEmpty ? "地点待定" : event.firstText("location","venue","city"));EventInfoRow(label:"报名状态",value:EventPresentation.state(event),highlight:true);EventInfoRow(label:"报名费用",value:event["registrationFee"].number>0 ? "¥"+event["registrationFee"].text : "免费");Text(plain(event["description"].text.isEmpty ? "赛事介绍正在完善中。" : event["description"].text)).font(.body).foregroundStyle(.secondary).textSelection(.enabled) }
            if !store.data["sessions"].list.isEmpty { EventSection(title:"赛事日程") { ForEach(store.data["sessions"].rows) { row in VStack(alignment:.leading,spacing:6) { Text(row.value["name"].text).font(.headline);Text([row.value["startsAt"].text,row.value["venue"].text].filter{ !$0.isEmpty }.joined(separator:" · ")).font(.subheadline).foregroundStyle(.secondary);Divider() } } } }
            if session.token != nil { EventSection { NavigationLink("我的报名、音乐与缴费") { MyCompetitionsView() }.frame(minHeight:44) } }
        }
    }
    private var publicPanel: some View {
        EventSection(title: panel == 1 ? "赛事组别" : panels[panel]) {
            TextField(panel == 1 ? "搜索组别、舞种或年龄" : panel == 3 ? "搜索评委" : "搜索选手、编号或机构",text:$query).registrationInput(border:Color.gray.opacity(0.25))
            ForEach(JSONValue.array(Array(rows.dropFirst((min(page,max(1,Int(ceil(Double(rows.count)/20))))-1)*20).prefix(20))).rows) { row in
                if panel == 1 { NavigationLink { EventGroupView(eventID:id,groupID:row.id) } label: { HStack { VStack(alignment:.leading,spacing:6) { Text(row.value["name"].text).font(.headline);Text((row.value["rankingCount"].number>0 ? row.value["rankingCount"].text+" 项成绩" : "成绩待公布")+" · "+(row.value["playerCount"] == .null ? "报名信息未公开" : row.value["playerCount"].text+" 位选手")).font(.subheadline).foregroundStyle(.secondary) };Spacer();Image(systemName:"chevron.right").foregroundStyle(.secondary) }.frame(minHeight:60) }.buttonStyle(.plain) }
                else if panel == 3 { NavigationLink { EventJudgeProfileView(judge:row.value,eventName:event["name"].text) } label: { HStack(spacing:12) { EventAvatar(row:row.value);VStack(alignment:.leading,spacing:6) { Text(row.value["name"].text).font(.headline);Text(row.value["title"].text.isEmpty ? "赛事评委" : row.value["title"].text).font(.subheadline).foregroundStyle(.secondary);Text("查看评委详情").font(.subheadline).foregroundStyle(EvaBrand.red) };Spacer();Image(systemName:"chevron.right").foregroundStyle(.secondary) }.frame(maxWidth:.infinity,alignment:.leading) }.buttonStyle(.plain) }
                else { NavigationLink { EventPlayerView(eventID:id,groupID:row.value["groupId"].text,playerID:row.value.firstText("playerId","id")) } label: { EventPersonRow(row:row.value,result:panel == 4) }.buttonStyle(.plain) }
                Divider()
            }
            if rows.isEmpty { Text(panel == 1 ? "没有找到符合条件的组别" : panel == 2 ? (event["registrationPublic"].bool ? "暂无报名信息" : "报名信息尚未公开") : panel == 3 ? "评委阵容暂未公布" : "成绩经统一平台审核发布后在这里公示").foregroundStyle(.secondary).frame(maxWidth:.infinity,minHeight:90) }
            EventPages(page:$page,total:rows.count)
        }
    }
    private func load() async { await store.load("/events/\(id)",session:session,publicRead:true) }
}

struct EventJudgeProfileView: View {
    let judge: JSONValue
    let eventName: String
    var body: some View {
        ScrollView { VStack(spacing:20) {
            EventAvatar(row:judge);Text(judge["name"].text).font(.title.bold());Text(judge["title"].text.isEmpty ? "赛事评委" : judge["title"].text).foregroundStyle(EvaBrand.gold)
            EventSection(title:"评委介绍") { Text(judge["bio"].text.isEmpty ? "评委介绍暂未填写" : plain(judge["bio"].text)).frame(maxWidth:.infinity,alignment:.leading);if !judge["organization"].text.isEmpty { Text(judge["organization"].text).foregroundStyle(.secondary) } }
            EventSection(title:"受邀赛事") { Text(eventName).frame(maxWidth:.infinity,alignment:.leading) }
        }.padding(20).frame(maxWidth:680).frame(maxWidth:.infinity) }.eventPage().navigationTitle("评委详情")
    }
}
